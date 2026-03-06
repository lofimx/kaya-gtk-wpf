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
import { SearchService } from "../services/search_service.js";
import { SearchResult } from "../models/search_result.js";
import { Meta } from "../models/meta.js";

Gio._promisify(
  Gio.File.prototype,
  "load_contents_async",
  "load_contents_finish"
);

const SEARCH_DEBOUNCE_MS = 300;

const TYPE_ICONS: Record<string, string> = {
  bookmark: "globe-symbolic",
  note: "document-text-symbolic",
  file: "text-x-generic-symbolic",
};

export class Window extends Adw.ApplicationWindow {
  private declare _fileService: FileService;
  private declare _searchService: SearchService;
  private declare _angaText: Gtk.Entry;
  private declare _noteText: Gtk.TextView;
  private declare _saveButton: Gtk.Button;
  private declare _toastOverlay: Adw.ToastOverlay;
  private declare _searchEntry: Gtk.SearchEntry;
  private declare _noteRevealer: Gtk.Revealer;
  private declare _noteToggle: Gtk.ToggleButton;
  private declare _resultsStack: Gtk.Stack;
  private declare _searchResultsFlowBox: Gtk.FlowBox;

  private _searchTimeoutId: number | null = null;

  static {
    GObject.registerClass(
      {
        Template: "resource:///ca/deobald/Kaya/window.ui",
        InternalChildren: [
          "angaText",
          "noteText",
          "saveButton",
          "toastOverlay",
          "searchEntry",
          "noteRevealer",
          "noteToggle",
          "resultsStack",
          "searchResultsFlowBox",
        ],
      },
      this
    );

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
    this._searchService = new SearchService();
    this._fileService.ensureKayaDirectories();
    this._angaText.connect("activate", () => this.onSave());
    this._setupDropTarget();
    this._setupSearch();
    this._setupNoteToggle();
    this._performSearch();
    console.log("🔵 INFO Window initialized with search");
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
        for (const file of files) {
          this._handleDroppedFile(file);
        }
        return true;
      }
    );

    this.add_controller(dropTarget);
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
      this._searchService.invalidateCache();
      this._performSearch();
      this.showSuccess();
    } catch (e: unknown) {
      this.showFailure(e);
    }
  }

  private _setupSearch(): void {
    this._searchEntry.connect("search-changed", () => {
      if (this._searchTimeoutId !== null) {
        GLib.source_remove(this._searchTimeoutId);
        this._searchTimeoutId = null;
      }
      this._searchTimeoutId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        SEARCH_DEBOUNCE_MS,
        () => {
          this._performSearch();
          this._searchTimeoutId = null;
          return GLib.SOURCE_REMOVE;
        }
      );
    });
  }

  private _performSearch(): void {
    const query = this._searchEntry.text.trim();
    const results = this._searchService.search(query);

    if (results.length === 0 && !query) {
      this._resultsStack.set_visible_child_name("empty");
      return;
    }

    if (results.length === 0) {
      this._resultsStack.set_visible_child_name("no-results");
      return;
    }

    this._populateResults(results);
    this._resultsStack.set_visible_child_name("results");
  }

  private _populateResults(results: SearchResult[]): void {
    // Clear existing children
    let child = this._searchResultsFlowBox.get_first_child();
    while (child !== null) {
      const next = child.get_next_sibling();
      this._searchResultsFlowBox.remove(child);
      child = next;
    }

    for (const result of results) {
      const card = this._createResultCard(result);
      this._searchResultsFlowBox.append(card);
    }
  }

  private _createResultCard(result: SearchResult): Gtk.Widget {
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 6,
    });
    box.add_css_class("card");
    box.add_css_class("search-result-card");

    // Type icon
    const icon = new Gtk.Image({
      icon_name: TYPE_ICONS[result.type] || "text-x-generic-symbolic",
      pixel_size: 32,
    });
    icon.add_css_class("dim-label");
    box.append(icon);

    // Content preview
    if (result.contentPreview) {
      const preview = new Gtk.Label({
        label: result.contentPreview,
        wrap: true,
        wrap_mode: 2, // WORD_CHAR
        lines: 2,
        ellipsize: 3, // END
        xalign: 0,
      });
      preview.add_css_class("caption");
      box.append(preview);
    }

    // Display title
    const title = new Gtk.Label({
      label: result.displayTitle,
      ellipsize: 3, // END
      xalign: 0,
    });
    title.add_css_class("heading");
    box.append(title);

    // Date
    const date = new Gtk.Label({
      label: result.date,
      xalign: 0,
    });
    date.add_css_class("dim-label");
    date.add_css_class("caption");
    box.append(date);

    return box;
  }

  private _setupNoteToggle(): void {
    this._noteToggle.connect("toggled", () => {
      this._noteRevealer.reveal_child = this._noteToggle.active;
    });
  }

  onSave() {
    console.log("🔵 INFO on_save fired");
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
      this._searchService.invalidateCache();
      this._performSearch();
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
    console.error(`🔴 ERROR Failed to save bookmark: ${e as string}`, [e]);
    const toast = new Adw.Toast({
      title: `Failed to save bookmark: ${e as string}`,
      timeout: 5,
    });
    this._toastOverlay.add_toast(toast);
  }
}
