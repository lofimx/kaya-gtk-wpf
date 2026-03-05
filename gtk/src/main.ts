import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

import { Window } from "./views/window.js";
import { PreferencesWindow } from "./views/preferences.js";
import { SyncManager } from "./services/sync_manager.js";

export class Application extends Adw.Application {
  #window?: Window;
  #syncManager?: SyncManager;

  static {
    GObject.registerClass(this);
  }

  constructor() {
    super({
      application_id: "ca.deobald.Kaya",
      flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });

    const quit_action = new Gio.SimpleAction({ name: "quit" });
    quit_action.connect("activate", () => {
      this.#syncManager?.stop();
      this.quit();
    });

    this.add_action(quit_action);
    this.set_accels_for_action("app.quit", ["<Control>q"]);

    const show_about_action = new Gio.SimpleAction({ name: "about" });
    show_about_action.connect("activate", () => {
      const aboutDialog = new Adw.AboutDialog({
        application_name: _("Kaya"),
        application_icon: "ca.deobald.Kaya",
        developer_name: "Steven Deobald",
        version: "0.1.14",
        developers: ["Steven Deobald <sdeobald@gnome.org>"],
        copyright: "© 2026 Steven Deobald",
      });

      aboutDialog.present(this.active_window);
    });

    this.add_action(show_about_action);

    const show_preferences_action = new Gio.SimpleAction({
      name: "preferences",
    });
    show_preferences_action.connect("activate", () => {
      const preferencesWindow = new PreferencesWindow({
        transient_for: this.active_window,
        modal: true,
      });
      preferencesWindow.present();
    });

    this.add_action(show_preferences_action);
    this.set_accels_for_action("app.preferences", ["<Control>comma"]);

    Gio._promisify(Gio.File.prototype, "read_async", "read_finish");
    Gio._promisify(Gtk.UriLauncher.prototype, "launch", "launch_finish");
  }

  vfunc_activate(): void {
    if (!this.#window) {
      this.#createWindow();
      this.#startSyncManager();
      return;
    }
    this.#window.present();
  }

  #createWindow() {
    this.#window = new Window({ application: this });
    this.#window.present();
  }

  #startSyncManager() {
    if (!this.#syncManager) {
      this.#syncManager = new SyncManager();
      this.#syncManager.start();
    }
  }
}

export function main(argv: string[]): Promise<number> {
  const app = new Application();
  // @ts-expect-error gi.ts can't generate this, but it exists.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
  return app.runAsync(argv);
}
