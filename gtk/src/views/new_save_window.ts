import Adw from "gi://Adw";
import Gdk from "gi://Gdk?version=4.0";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { SystemClock } from "../models/clock.js";
import { Anga } from "../models/anga.js";
import { Dropped } from "../models/dropped.js";
import { FileService } from "../services/file_service.js";
import { Meta } from "../models/meta.js";

Gio._promisify(Gtk.FileDialog.prototype, "open", "open_finish");

const IMAGE_PREVIEW_SIZE = 256;

export class NewSaveWindow extends Adw.Window {
  private declare _angaText: Gtk.Entry;
  private declare _tagsContainer: Gtk.Box;
  private declare _tagsEntry: Gtk.Entry;
  private declare _noteText: Gtk.TextView;
  private declare _saveButton: Gtk.Button;
  private declare _cancelButton: Gtk.Button;
  private declare _openFileButton: Gtk.Button;
  private declare _removeFileButton: Gtk.Button;
  private declare _toastOverlay: Adw.ToastOverlay;
  private declare _contentStack: Gtk.Stack;
  private declare _filePreviewContent: Gtk.Box;

  private _tags: string[] = [];
  private _droppedFileData: {
    filename: string;
    contents: Uint8Array;
  } | null = null;
  private _fileService: FileService;
  private _onSaveComplete: (() => void) | null = null;

  static {
    GObject.registerClass(
      {
        Template: "resource:///ca/deobald/Kaya/new_save_window.ui",
        InternalChildren: [
          "angaText",
          "tagsContainer",
          "tagsEntry",
          "noteText",
          "saveButton",
          "cancelButton",
          "openFileButton",
          "removeFileButton",
          "toastOverlay",
          "contentStack",
          "filePreviewContent",
        ],
      },
      this
    );
  }

  constructor(
    params: Partial<Adw.Window.ConstructorProps>,
    onSaveComplete: () => void
  ) {
    super(params);
    this._fileService = new FileService();
    this._fileService.ensureKayaDirectories();
    this._onSaveComplete = onSaveComplete;

    this._cancelButton.connect("clicked", () => this._onCancel());
    this._saveButton.connect("clicked", () => this._onSave());
    this._openFileButton.connect("clicked", () => this._onOpenFile());
    this._removeFileButton.connect("clicked", () => this._onRemoveFile());
    this._angaText.connect("activate", () => this._onSave());

    this._setupTagsInput();
    this._setupTabOrder();
    this._setupDropTarget();
    this._setupEscape();
    this._setupKeyboardFocus();

    // Focus the bookmark entry when the window is shown
    this.connect("map", () => {
      this._angaText.grab_focus();
    });

    console.log("🔵 INFO NewSaveWindow initialized");
  }

  private _setupEscape(): void {
    // Use close-request to handle window close gracefully
    this.connect("close-request", () => {
      this.destroy();
      return true;
    });

    // Bind Escape key via an event controller
    const keyController = new Gtk.EventControllerKey();
    keyController.connect(
      "key-pressed",
      (_controller: Gtk.EventControllerKey, keyval: number) => {
        if (keyval === Gdk.KEY_Escape) {
          this.close();
          return true;
        }
        return false;
      }
    );
    this.add_controller(keyController);
  }

  private _setupTabOrder(): void {
    const tabOrder: Gtk.Widget[] = [
      this._angaText,
      this._tagsEntry,
      this._noteText,
      this._cancelButton,
      this._openFileButton,
      this._saveButton,
    ];

    const keyController = new Gtk.EventControllerKey();
    keyController.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
    keyController.connect(
      "key-pressed",
      (_controller: Gtk.EventControllerKey, keyval: number) => {
        if (keyval !== Gdk.KEY_Tab && keyval !== Gdk.KEY_ISO_Left_Tab) {
          return false;
        }

        const focusWidget = this.get_focus();
        if (!focusWidget) return false;

        // Let tagsEntry's own CAPTURE handler deal with Tab when there's text
        if (
          (focusWidget === this._tagsEntry ||
            focusWidget.is_ancestor(this._tagsEntry)) &&
          this._tagsEntry.text.trim().length > 0
        ) {
          return false;
        }

        // Find which tab-order widget currently has focus
        const currentIndex = tabOrder.findIndex(
          (w) => w === focusWidget || focusWidget.is_ancestor(w)
        );
        if (currentIndex === -1) return false;

        const forward = keyval === Gdk.KEY_Tab;
        const nextIndex = forward
          ? (currentIndex + 1) % tabOrder.length
          : (currentIndex - 1 + tabOrder.length) % tabOrder.length;
        tabOrder[nextIndex].grab_focus();
        return true;
      }
    );
    this.add_controller(keyController);
  }

  private _setupKeyboardFocus(): void {
    // Use BUBBLE phase (default) so text widgets process keys first
    const keyController = new Gtk.EventControllerKey();
    keyController.connect(
      "key-pressed",
      (
        _controller: Gtk.EventControllerKey,
        keyval: number,
        _keycode: number,
        state: number
      ) => {
        // Ignore if modifier keys are held (except Shift for uppercase)
        const modifiers =
          state &
          (Gtk.accelerator_get_default_mod_mask() &
            ~Gdk.ModifierType.SHIFT_MASK);
        if (modifiers !== 0) return false;

        // Only forward printable characters
        const unichar = Gdk.keyval_to_unicode(keyval);
        if (unichar === 0) return false;

        // Check if any text input widget already has focus
        const focusWidget = this.get_focus();
        if (
          focusWidget instanceof Gtk.Entry ||
          focusWidget instanceof Gtk.TextView
        ) {
          return false;
        }

        // Focus the bookmark entry and let the key pass through
        this._angaText.grab_focus();
        return false;
      }
    );
    this.add_controller(keyController);
  }

  private _setupTagsInput(): void {
    const keyController = new Gtk.EventControllerKey();
    keyController.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
    keyController.connect(
      "key-pressed",
      (_controller: Gtk.EventControllerKey, keyval: number) => {
        // Comma creates a tag pill
        if (keyval === Gdk.KEY_comma) {
          this._finalizeTagEntry();
          return true; // Prevent comma from being inserted
        }

        // Tab with pending text: finalize as pill, consume Tab
        if (
          (keyval === Gdk.KEY_Tab || keyval === Gdk.KEY_ISO_Left_Tab) &&
          this._tagsEntry.text.trim().length > 0
        ) {
          this._finalizeTagEntry();
          return true;
        }

        // Backspace when entry is empty removes the last tag
        if (
          keyval === Gdk.KEY_BackSpace &&
          this._tagsEntry.text.length === 0 &&
          this._tags.length > 0
        ) {
          this._removeLastTag();
          return true;
        }

        console.log("default return false");
        return false;
      }
    );
    this._tagsEntry.add_controller(keyController);
  }

  private _finalizeTagEntry(): void {
    const text = this._tagsEntry.text.trim();
    if (text.length > 0) {
      this._addTagPill(text);
      this._tagsEntry.set_text("");
    }
  }

  private _addTagPill(tagText: string): void {
    this._tags.push(tagText);

    const pill = new Gtk.Box({
      spacing: 4,
      valign: Gtk.Align.CENTER,
    });
    pill.add_css_class("tag-pill");

    const label = new Gtk.Label({ label: tagText });
    pill.append(label);

    // Insert pill before the entry (which is always the last child)
    this._tagsContainer.insert_child_after(pill, this._getLastPill());
    console.log(`🟢 DEBUG Tag added: "${tagText}"`);
  }

  private _getLastPill(): Gtk.Widget | null {
    // Find the last pill (child before tagsEntry)
    let lastPill: Gtk.Widget | null = null;
    let child = this._tagsContainer.get_first_child();
    while (child !== null) {
      if (child === this._tagsEntry) break;
      lastPill = child;
      child = child.get_next_sibling();
    }
    return lastPill;
  }

  private _removeLastTag(): void {
    const removed = this._tags.pop();
    const lastPill = this._getLastPill();
    if (lastPill) {
      this._tagsContainer.remove(lastPill);
    }
    console.log(`🟢 DEBUG Tag removed: "${removed}"`);
  }

  private _setupDropTarget(): void {
    const dropTarget = new Gtk.DropTarget({
      actions: Gdk.DragAction.COPY,
    });
    dropTarget.set_gtypes([Gdk.FileList.$gtype]);

    dropTarget.connect(
      "drop",
      (_target: Gtk.DropTarget, value: GObject.Object) => {
        const fileList = value as unknown as Gdk.FileList;
        const files = fileList.get_files();
        if (files.length > 0) {
          this._handleDroppedFile(files[0]);
        }
        return true;
      }
    );

    this.add_controller(dropTarget);
  }

  private _handleDroppedFile(file: Gio.File): void {
    const filename = file.get_basename();
    if (!filename) {
      this._showFailure("Could not determine filename");
      return;
    }

    try {
      const [, contents] = file.load_contents(null);
      this._droppedFileData = { filename, contents };
      this._showFilePreview(filename, contents);
      console.log(`🔵 INFO File dropped: "${filename}"`);
    } catch (e: unknown) {
      this._showFailure(e);
    }
  }

  private _showFilePreview(filename: string, contents: Uint8Array): void {
    // Clear existing preview content
    let child = this._filePreviewContent.get_first_child();
    while (child !== null) {
      const next = child.get_next_sibling();
      this._filePreviewContent.remove(child);
      child = next;
    }

    // Detect content type
    const [contentType] = Gio.content_type_guess(filename, contents);
    const isImage = contentType !== null && contentType.startsWith("image/");

    if (isImage) {
      // Show image preview
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const bytes = GLib.Bytes.new(contents);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const texture = Gdk.Texture.new_from_bytes(bytes);
      const picture = new Gtk.Picture({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        paintable: texture,
        can_shrink: true,
        content_fit: Gtk.ContentFit.CONTAIN,
        width_request: IMAGE_PREVIEW_SIZE,
        height_request: IMAGE_PREVIEW_SIZE,
      });
      this._filePreviewContent.append(picture);
    } else {
      // Show icon + filename
      const gicon = Gio.content_type_get_symbolic_icon(contentType);
      const icon = new Gtk.Image({
        gicon: gicon,
        pixel_size: 64,
      });
      icon.add_css_class("dim-label");
      this._filePreviewContent.append(icon);
    }

    // Always show filename label
    const label = new Gtk.Label({
      label: filename,
      ellipsize: 3, // END
      wrap: true,
    });
    label.add_css_class("title-3");
    this._filePreviewContent.append(label);

    this._contentStack.set_visible_child_name("file-preview");
  }

  private _onOpenFile(): void {
    const dialog = new Gtk.FileDialog();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const openPromise = (
      dialog as unknown as {
        open: (
          parent: Gtk.Window | null,
          cancellable: Gio.Cancellable | null
        ) => Promise<Gio.File>;
      }
    ).open(this, null);
    openPromise
      .then((file: Gio.File) => {
        this._handleDroppedFile(file);
      })
      .catch((e: unknown) => {
        // User cancelled — not an error
        const error = e as GLib.Error;
        if (error.matches?.(Gtk.DialogError, Gtk.DialogError.DISMISSED)) {
          return;
        }
        this._showFailure(e);
      });
  }

  private _onRemoveFile(): void {
    this._droppedFileData = null;
    this._contentStack.set_visible_child_name("form");
    console.log("🔵 INFO File removed from New Save");
  }

  private _onCancel(): void {
    this.close();
  }

  private _onSave(): void {
    console.log("🔵 INFO NewSaveWindow on_save fired");
    const clock = new SystemClock();

    try {
      let angaFilename: string;

      if (this._droppedFileData) {
        // Save dropped/selected file
        const droppedFile = new Dropped(
          this._droppedFileData.filename,
          this._droppedFileData.contents,
          clock
        ).toDroppedFile();
        this._fileService.saveDroppedFile(droppedFile);
        angaFilename = droppedFile.filename;
      } else {
        // Save bookmark or note
        const text = this._angaText.text;
        const angaFile = new Anga(text, clock).toAngaFile();
        this._fileService.save(angaFile);
        angaFilename = angaFile.filename;
      }

      // Get note text
      const buffer = this._noteText.get_buffer();
      const startIter = buffer.get_start_iter();
      const endIter = buffer.get_end_iter();
      const noteText = buffer.get_text(startIter, endIter, false).trim();

      // Finalize any pending tag text
      const pendingTag = this._tagsEntry.text.trim();
      if (pendingTag.length > 0) {
        this._tags.push(pendingTag);
      }

      // Save metadata if there's a note or tags
      if (noteText.length > 0 || this._tags.length > 0) {
        const metaFile = new Meta(
          angaFilename,
          noteText,
          this._tags,
          clock
        ).toMetaFile();
        this._fileService.saveMeta(metaFile);
      }

      this._onSaveComplete?.();
      this.close();
    } catch (e: unknown) {
      this._showFailure(e);
    }
  }

  private _showFailure(e: unknown): void {
    console.error(`🔴 ERROR Failed to save: ${e as string}`, [e]);
    const toast = new Adw.Toast({
      title: `Failed to save: ${e as string}`,
      timeout: 5,
    });
    this._toastOverlay.add_toast(toast);
  }
}
