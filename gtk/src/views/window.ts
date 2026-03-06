import Adw from "gi://Adw";
import Gdk from "gi://Gdk?version=4.0";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { SystemClock } from "../models/clock.js";
import { Anga } from "../models/anga.js";
import { Dropped } from "../models/dropped.js";
import { FileService } from "../services/file_service.js";
import { Meta } from "../models/meta.js";

Gio._promisify(
  Gio.File.prototype,
  "load_contents_async",
  "load_contents_finish"
);

export class Window extends Adw.ApplicationWindow {
  private declare _fileService: FileService;
  private declare _angaText: Gtk.Entry;
  private declare _noteText: Gtk.TextView;
  private declare _saveButton: Gtk.Button;
  private declare _toastOverlay: Adw.ToastOverlay;
  private declare _dropTargetFrame: Gtk.Frame;

  static {
    GObject.registerClass(
      {
        Template: "resource:///ca/deobald/Kaya/window.ui",
        InternalChildren: [
          "angaText",
          "noteText",
          "saveButton",
          "toastOverlay",
          "dropTargetFrame",
        ],
      },
      this
    );

    // Widgets allow you to directly add shortcuts to them when subclassing
    Gtk.Widget.add_shortcut(
      new Gtk.Shortcut({
        action: new Gtk.NamedAction({ action_name: "window.close" }),
        trigger: Gtk.ShortcutTrigger.parse_string("<Control>w"),
      })
    );
  }

  constructor(params?: Partial<Adw.ApplicationWindow.ConstructorProps>) {
    super(params);
    this.icon_name = "ca.deobald.Kaya";
    this._fileService = new FileService();
    this._fileService.ensureKayaDirectories();
    this._angaText.connect("activate", () => this.onSave()); // "return" is pressed
    this._setupDropTarget();
  }

  private _setupDropTarget(): void {
    const dropTarget = new Gtk.DropTarget({
      actions: Gdk.DragAction.COPY,
    });
    dropTarget.set_gtypes([Gdk.FileList.$gtype]);

    dropTarget.connect("drop", (_target, value: GObject.Object) => {
      const fileList = value as unknown as Gdk.FileList;
      const files = fileList.get_files();
      for (const file of files) {
        this._handleDroppedFile(file);
      }
      return true;
    });

    this._dropTargetFrame.add_controller(dropTarget);
  }

  private _handleDroppedFile(file: Gio.File): void {
    const filename = file.get_basename();
    if (!filename) {
      this.showFailure("Could not determine filename");
      return;
    }

    try {
      // Use synchronous load because portal files may be revoked after the drop handler returns
      const [, contents] = file.load_contents(null);
      const droppedFile = new Dropped(
        filename,
        contents,
        new SystemClock()
      ).toDroppedFile();
      this._fileService.saveDroppedFile(droppedFile);
      this.showSuccess();
    } catch (e: unknown) {
      this.showFailure(e);
    }
  }

  onSave() {
    console.log("on_save fired");
    const text = this._angaText.text;
    const clock = new SystemClock();
    const angaFile = new Anga(text, clock).toAngaFile();

    // Get note text from the TextView buffer
    const buffer = this._noteText.get_buffer();
    const startIter = buffer.get_start_iter();
    const endIter = buffer.get_end_iter();
    const noteText = buffer.get_text(startIter, endIter, false).trim();

    try {
      this._fileService.save(angaFile);

      // Save metadata if there's a note
      if (noteText.length > 0) {
        const metaFile = new Meta(
          angaFile.filename,
          noteText,
          clock
        ).toMetaFile();
        this._fileService.saveMeta(metaFile);
      }

      this._angaText.set_text("");
      buffer.set_text("", 0);
      this.showSuccess();
    } catch (e: unknown) {
      this.showFailure(e);
    }
  }

  private showSuccess() {
    const toast = new Adw.Toast({
      title: `Saved!`,
      timeout: 1,
    });
    this._toastOverlay.add_toast(toast);
  }

  private showFailure(e: unknown) {
    console.error(`Failed to save bookmark: ${e as string}`, [e]);
    const toast = new Adw.Toast({
      title: `Failed to save bookmark: ${e as string}`,
      timeout: 5,
    });
    this._toastOverlay.add_toast(toast);
  }
}
