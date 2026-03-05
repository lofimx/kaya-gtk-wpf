import Gio from "gi://Gio";
import GLib from "gi://GLib";

const DEFAULT_SERVER_URL = "https://kaya.town";
const SECRET_SCHEMA_NAME = "ca.deobald.Kaya";

// Platform detection: KAYA_PLATFORM is set by platform-specific shell launchers
const KAYA_PLATFORM = GLib.getenv("KAYA_PLATFORM");
const IS_MACOS = KAYA_PLATFORM === "macos";
const IS_WINDOWS = KAYA_PLATFORM === "windows";

// --- macOS Keychain helpers (use `security` CLI) ---

const KEYCHAIN_SERVICE = "ca.deobald.Kaya";
const KEYCHAIN_ACCOUNT = "kaya-server-password";

function _macosGetPassword(): string | null {
  try {
    const [ok, stdout] = GLib.spawn_sync(
      null,
      [
        "security",
        "find-generic-password",
        "-s",
        KEYCHAIN_SERVICE,
        "-a",
        KEYCHAIN_ACCOUNT,
        "-w",
      ],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null
    );
    if (ok && stdout) {
      const decoder = new TextDecoder("utf-8");
      return decoder.decode(stdout).trim();
    }
    return null;
  } catch {
    return null;
  }
}

function _macosSetPassword(password: string): boolean {
  try {
    const [ok] = GLib.spawn_sync(
      null,
      [
        "security",
        "add-generic-password",
        "-U",
        "-s",
        KEYCHAIN_SERVICE,
        "-a",
        KEYCHAIN_ACCOUNT,
        "-w",
        password,
      ],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null
    );
    return ok;
  } catch {
    return false;
  }
}

function _macosClearPassword(): boolean {
  try {
    const [ok] = GLib.spawn_sync(
      null,
      [
        "security",
        "delete-generic-password",
        "-s",
        KEYCHAIN_SERVICE,
        "-a",
        KEYCHAIN_ACCOUNT,
      ],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null
    );
    return ok;
  } catch {
    return false;
  }
}

// --- Windows Credential Manager helpers (use PowerShell + PasswordVault) ---

const WINCRED_RESOURCE = "ca.deobald.Kaya";
const WINCRED_USERNAME = "kaya-server-password";

// Common prefix to load the WinRT PasswordVault type in PowerShell
const PS_VAULT_INIT =
  "[Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]|Out-Null;" +
  "$v=New-Object Windows.Security.Credentials.PasswordVault;";

function _windowsGetPassword(): string | null {
  try {
    const cmd =
      PS_VAULT_INIT +
      `$c=$v.Retrieve('${WINCRED_RESOURCE}','${WINCRED_USERNAME}');` +
      "$c.RetrievePassword();" +
      "Write-Output $c.Password";
    const [ok, stdout] = GLib.spawn_sync(
      null,
      ["powershell.exe", "-NoProfile", "-Command", cmd],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null
    );
    if (ok && stdout) {
      const decoded = new TextDecoder("utf-8").decode(stdout).trim();
      return decoded || null;
    }
    return null;
  } catch {
    return null;
  }
}

function _windowsSetPassword(password: string): boolean {
  try {
    // Remove existing credential first (PasswordVault throws if duplicate)
    const cmd =
      PS_VAULT_INIT +
      `try{$old=$v.Retrieve('${WINCRED_RESOURCE}','${WINCRED_USERNAME}');$v.Remove($old)}catch{};` +
      `$c=New-Object Windows.Security.Credentials.PasswordCredential('${WINCRED_RESOURCE}','${WINCRED_USERNAME}','${password.replace(/'/g, "''")}');` +
      "$v.Add($c)";
    const [ok] = GLib.spawn_sync(
      null,
      ["powershell.exe", "-NoProfile", "-Command", cmd],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null
    );
    return ok;
  } catch {
    return false;
  }
}

function _windowsClearPassword(): boolean {
  try {
    const cmd =
      PS_VAULT_INIT +
      `$c=$v.Retrieve('${WINCRED_RESOURCE}','${WINCRED_USERNAME}');` +
      "$v.Remove($c)";
    const [ok] = GLib.spawn_sync(
      null,
      ["powershell.exe", "-NoProfile", "-Command", cmd],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null
    );
    return ok;
  } catch {
    return false;
  }
}

// --- Linux libsecret (conditional import) ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Secret: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let passwordSchema: any = null;

if (!IS_MACOS && !IS_WINDOWS) {
  try {
    Secret = (await import("gi://Secret")).default;
    Gio._promisify(Secret, "password_store", "password_store_finish");
    Gio._promisify(Secret, "password_lookup", "password_lookup_finish");
    Gio._promisify(Secret, "password_clear", "password_clear_finish");
    passwordSchema = new Secret.Schema(
      SECRET_SCHEMA_NAME,
      Secret.SchemaFlags.NONE,
      {
        application: Secret.SchemaAttributeType.STRING,
      }
    );
  } catch (e) {
    console.error(`libsecret not available: ${e as string}`);
  }
}

export class SettingsService {
  private _settings: Gio.Settings;

  constructor() {
    this._settings = new Gio.Settings({ schema_id: "ca.deobald.Kaya" });
  }

  get serverUrl(): string {
    return this._settings.get_string("sync-server-url") || DEFAULT_SERVER_URL;
  }

  set serverUrl(value: string) {
    this._settings.set_string("sync-server-url", value || DEFAULT_SERVER_URL);
  }

  get email(): string {
    return this._settings.get_string("sync-email") || "";
  }

  set email(value: string) {
    this._settings.set_string("sync-email", value || "");
  }

  get syncEnabled(): boolean {
    return this._settings.get_boolean("sync-enabled");
  }

  set syncEnabled(value: boolean) {
    this._settings.set_boolean("sync-enabled", value);
  }

  get lastSyncError(): string {
    return this._settings.get_string("sync-last-error") || "";
  }

  set lastSyncError(value: string) {
    this._settings.set_string("sync-last-error", value || "");
  }

  get lastSyncSuccess(): string {
    return this._settings.get_string("sync-last-success") || "";
  }

  set lastSyncSuccess(value: string) {
    this._settings.set_string("sync-last-success", value || "");
  }

  isCustomServerConfigured(): boolean {
    const url = this.serverUrl;
    return url !== DEFAULT_SERVER_URL && url.length > 0;
  }

  shouldSync(): boolean {
    if (!this.isCustomServerConfigured()) {
      return false;
    }
    if (!this.email) {
      return false;
    }
    return true;
  }

  async getPassword(): Promise<string | null> {
    if (IS_MACOS) {
      return _macosGetPassword();
    }
    if (IS_WINDOWS) {
      return _windowsGetPassword();
    }
    if (!Secret || !passwordSchema) return null;
    try {
      const password = await Secret.password_lookup(
        passwordSchema,
        { application: SECRET_SCHEMA_NAME },
        null
      );
      return password;
    } catch (e) {
      console.error(
        `Failed to retrieve password from keyring: ${e as string}`,
        [e]
      );
      return null;
    }
  }

  async setPassword(password: string): Promise<boolean> {
    if (IS_MACOS) {
      return _macosSetPassword(password);
    }
    if (IS_WINDOWS) {
      return _windowsSetPassword(password);
    }
    if (!Secret || !passwordSchema) return false;
    try {
      const success = await Secret.password_store(
        passwordSchema,
        { application: SECRET_SCHEMA_NAME },
        Secret.COLLECTION_DEFAULT,
        "Kaya Server Password",
        password,
        null
      );
      return success;
    } catch (e) {
      console.error(`Failed to store password in keyring: ${e as string}`, [e]);
      return false;
    }
  }

  async clearPassword(): Promise<boolean> {
    if (IS_MACOS) {
      return _macosClearPassword();
    }
    if (IS_WINDOWS) {
      return _windowsClearPassword();
    }
    if (!Secret || !passwordSchema) return false;
    try {
      const success = await Secret.password_clear(
        passwordSchema,
        { application: SECRET_SCHEMA_NAME },
        null
      );
      return success;
    } catch (e) {
      console.error(`Failed to clear password from keyring: ${e as string}`, [
        e,
      ]);
      return false;
    }
  }

  connectChanged(callback: () => void): number {
    return this._settings.connect("changed", callback);
  }

  disconnectChanged(handlerId: number): void {
    this._settings.disconnect(handlerId);
  }
}
