import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { SettingsService } from "../services/settings_service.js";
import { SyncService } from "../services/sync_service.js";

export class PreferencesWindow extends Adw.PreferencesWindow {
  private declare _serverUrlEntry: Adw.EntryRow;
  private declare _emailEntry: Adw.EntryRow;
  private declare _passwordEntry: Adw.PasswordEntryRow;
  private declare _syncStatusRow: Adw.ActionRow;
  private declare _forceSyncButton: Gtk.Button;

  private _settingsService: SettingsService;
  private _syncService: SyncService;
  private _passwordLoaded = false;
  private _settingsChangedId: number | null = null;

  static {
    GObject.registerClass(
      {
        Template: "resource:///ca/deobald/Kaya/preferences.ui",
        InternalChildren: [
          "serverUrlEntry",
          "emailEntry",
          "passwordEntry",
          "syncStatusRow",
          "forceSyncButton",
        ],
      },
      this
    );
  }

  constructor(params?: Partial<Adw.PreferencesWindow.ConstructorProperties>) {
    super(params);
    this._settingsService = new SettingsService();
    this._syncService = new SyncService(this._settingsService);
    this._loadSettings();
    this._connectSignals();

    // Listen for settings changes (e.g., from sync errors)
    this._settingsChangedId = this._settingsService.connectChanged(() => {
      this._updateSyncStatus();
    });

    // Clean up when window is closed
    this.connect("close-request", () => {
      if (this._settingsChangedId !== null) {
        this._settingsService.disconnectChanged(this._settingsChangedId);
        this._settingsChangedId = null;
      }
      return false;
    });
  }

  private _loadSettings(): void {
    this._serverUrlEntry.text = this._settingsService.serverUrl;
    this._emailEntry.text = this._settingsService.email;

    this._settingsService
      .getPassword()
      .then((password) => {
        if (password) {
          this._passwordEntry.text = password;
        }
        this._passwordLoaded = true;
        this._updateSyncStatus();
      })
      .catch((e) => {
        console.error(`Failed to load password: ${e as string}`, [e]);
        this._passwordLoaded = true;
        this._updateSyncStatus();
      });

    this._updateSyncStatus();
  }

  private _connectSignals(): void {
    this._serverUrlEntry.connect("changed", () => {
      this._settingsService.serverUrl = this._serverUrlEntry.text;
      this._updateSyncStatus();
    });

    this._emailEntry.connect("changed", () => {
      this._settingsService.email = this._emailEntry.text;
      this._updateSyncStatus();
    });

    this._passwordEntry.connect("changed", () => {
      if (!this._passwordLoaded) return;

      const password = this._passwordEntry.text;
      if (password) {
        this._settingsService.setPassword(password).catch((e) => {
          console.error(`Failed to save password: ${e as string}`, [e]);
        });
      } else {
        this._settingsService.clearPassword().catch((e) => {
          console.error(`Failed to clear password: ${e as string}`, [e]);
        });
      }
      this._updateSyncStatus();
    });

    this._forceSyncButton.connect("clicked", () => {
      this._forceSync();
    });
  }

  private _forceSync(): void {
    if (!this._settingsService.shouldSync()) {
      return;
    }

    this._forceSyncButton.sensitive = false;
    this._syncStatusRow.subtitle = "Syncing...";

    this._syncService
      .sync()
      .then((result) => {
        if (result.errors.length > 0) {
          const errorMsg = result.errors
            .map((e) => `${e.operation} ${e.file}: ${e.error}`)
            .join("; ");
          this._settingsService.lastSyncError = errorMsg;
        } else {
          this._settingsService.lastSyncError = "";
          this._settingsService.lastSyncSuccess = new Date().toISOString();
        }
        this._updateSyncStatus();
      })
      .catch((e) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        this._settingsService.lastSyncError = errorMessage;
        this._updateSyncStatus();
      })
      .finally(() => {
        this._forceSyncButton.sensitive = true;
      });
  }

  private _updateSyncStatus(): void {
    const serverUrl = this._serverUrlEntry.text;
    const email = this._emailEntry.text;
    const hasPassword = this._passwordEntry.text.length > 0;

    const isDefaultServer = serverUrl === "https://kaya.town";
    const hasCredentials = email.length > 0 && hasPassword;

    const lastError = this._settingsService.lastSyncError;
    const lastSuccess = this._settingsService.lastSyncSuccess;

    let status: string;
    if (lastError) {
      status = `Error: ${lastError}`;
    } else if (isDefaultServer) {
      status = "Sync disabled (default server not yet available)";
    } else if (!serverUrl) {
      status = "Not configured - enter a server URL";
    } else if (!hasCredentials) {
      status = "Not configured - enter email and password";
    } else if (lastSuccess) {
      const successDate = new Date(lastSuccess);
      status = `Last sync: ${successDate.toLocaleString()}`;
    } else {
      status = `Ready to sync with ${serverUrl}`;
    }

    this._syncStatusRow.subtitle = status;
  }
}
