import Adw from "gi://Adw";
import Gdk from "gi://Gdk?version=4.0";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { SearchService } from "../services/search_service.js";
import { SearchResult } from "../models/search_result.js";

const SEARCH_DEBOUNCE_MS = 300;

const TYPE_ICONS: Record<string, string> = {
  bookmark: "globe-symbolic",
  note: "document-text-symbolic",
  file: "text-x-generic-symbolic",
};

export class EverythingWindow extends Adw.ApplicationWindow {
  private declare _searchService: SearchService;
  private declare _toastOverlay: Adw.ToastOverlay;
  private declare _searchEntry: Gtk.SearchEntry;
  private declare _resultsStack: Gtk.Stack;
  private declare _searchResultsFlowBox: Gtk.FlowBox;

  private _searchTimeoutId: number | null = null;

  static {
    GObject.registerClass(
      {
        Template: "resource:///ca/deobald/Kaya/everything_window.ui",
        InternalChildren: [
          "toastOverlay",
          "searchEntry",
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
    this._searchService = new SearchService();
    this._setupSearch();
    this._setupKeyboardFocus();
    this._performSearch();
    console.log("🔵 INFO EverythingWindow initialized");
  }

  refreshSearch(): void {
    this._searchService.invalidateCache();
    this._performSearch();
    console.log("🔵 INFO Search refreshed");
  }

  focusSearch(): void {
    this._searchEntry.grab_focus();
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

  private _setupKeyboardFocus(): void {
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

        // If search entry doesn't have focus, grab it
        if (!this._searchEntry.has_focus) {
          this._searchEntry.grab_focus();
        }
        return false;
      }
    );
    this.add_controller(keyController);
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

    const icon = new Gtk.Image({
      icon_name: TYPE_ICONS[result.type] || "text-x-generic-symbolic",
      pixel_size: 32,
    });
    icon.add_css_class("dim-label");
    box.append(icon);

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

    const title = new Gtk.Label({
      label: result.displayTitle,
      ellipsize: 3, // END
      xalign: 0,
    });
    title.add_css_class("heading");
    box.append(title);

    const date = new Gtk.Label({
      label: result.date,
      xalign: 0,
    });
    date.add_css_class("dim-label");
    date.add_css_class("caption");
    box.append(date);

    return box;
  }
}
