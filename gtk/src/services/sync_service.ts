import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Soup from "gi://Soup";
import { Filename } from "../models/filename.js";
import { SettingsService } from "./settings_service.js";

Gio._promisify(
  Soup.Session.prototype,
  "send_and_read_async",
  "send_and_read_finish"
);

const LOCAL_ANGA_DIR = GLib.build_filenamev([
  GLib.get_home_dir(),
  ".kaya",
  "anga",
]);

const LOCAL_WORDS_DIR = GLib.build_filenamev([
  GLib.get_home_dir(),
  ".kaya",
  "words",
]);

const LOCAL_META_DIR = GLib.build_filenamev([
  GLib.get_home_dir(),
  ".kaya",
  "meta",
]);

interface SyncResult {
  downloaded: string[];
  uploaded: string[];
  errors: Array<{ file: string; operation: string; error: string }>;
}

export class SyncService {
  private _settingsService: SettingsService;
  private _session: Soup.Session;
  private _isSyncing = false;

  constructor(settingsService: SettingsService) {
    this._settingsService = settingsService;
    this._session = new Soup.Session();
    // Disable proxy resolver to avoid portal access issues in Flatpak
    this._session.set_proxy_resolver(null);
  }

  get isSyncing(): boolean {
    return this._isSyncing;
  }

  async sync(): Promise<SyncResult> {
    if (this._isSyncing) {
      console.log("Sync already in progress, skipping");
      return { downloaded: [], uploaded: [], errors: [] };
    }

    if (!this._settingsService.shouldSync()) {
      console.log("Sync not configured or disabled");
      return { downloaded: [], uploaded: [], errors: [] };
    }

    const password = await this._settingsService.getPassword();
    if (!password) {
      console.log("No password configured, skipping sync");
      return { downloaded: [], uploaded: [], errors: [] };
    }

    this._isSyncing = true;
    const result: SyncResult = {
      downloaded: [],
      uploaded: [],
      errors: [],
    };

    try {
      const baseUrl = this._settingsService.serverUrl;
      const email = this._settingsService.email;

      console.log(`Starting sync with ${baseUrl} for ${email}`);

      const serverFiles = await this._fetchServerFiles(
        baseUrl,
        email,
        password
      );
      const localFiles = this._fetchLocalFiles();

      const toDownload = serverFiles.filter((f) => !localFiles.includes(f));
      const toUpload = localFiles.filter((f) => !serverFiles.includes(f));

      console.log(
        `Anga - Server: ${serverFiles.length}, Local: ${localFiles.length}, Download: ${toDownload.length}, Upload: ${toUpload.length}`
      );

      for (const filename of toDownload) {
        try {
          await this._downloadFile(baseUrl, email, password, filename);
          result.downloaded.push(filename);
          console.log(`[DOWNLOAD] ${filename}`);
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          result.errors.push({ file: filename, operation: "download", error });
          console.error(`[DOWNLOAD FAILED] ${filename}: ${error}`);
        }
      }

      for (const filename of toUpload) {
        try {
          const filenameValidator = new Filename(filename);
          if (!filenameValidator.isValid()) {
            console.error(
              `Filename contains URL-invalid characters: '${filename}'. Skipping upload.`
            );
            result.errors.push({
              file: filename,
              operation: "upload",
              error: "Filename contains URL-illegal characters",
            });
            continue;
          }
          await this._uploadFile(baseUrl, email, password, filename);
          result.uploaded.push(filename);
          console.log(`[UPLOAD] ${filename}`);
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          result.errors.push({ file: filename, operation: "upload", error });
          console.error(`[UPLOAD FAILED] ${filename}: ${error}`);
        }
      }

      await this._syncMeta(baseUrl, email, password, result);

      await this._syncWords(baseUrl, email, password, result);

      console.log(
        `Sync complete: ${result.downloaded.length} downloaded, ${result.uploaded.length} uploaded, ${result.errors.length} errors`
      );
    } finally {
      this._isSyncing = false;
    }

    return result;
  }

  private _createAuthHeader(email: string, password: string): string {
    const credentials = `${email}:${password}`;
    const encoded = GLib.base64_encode(new TextEncoder().encode(credentials));
    return `Basic ${encoded}`;
  }

  private async _fetchServerFiles(
    baseUrl: string,
    email: string,
    password: string
  ): Promise<string[]> {
    const encodedEmail = encodeURIComponent(email);
    const url = `${baseUrl}/api/v1/${encodedEmail}/anga`;

    const message = new Soup.Message({
      method: "GET",
      uri: GLib.Uri.parse(url, GLib.UriFlags.NONE),
    });

    message.request_headers.append(
      "Authorization",
      this._createAuthHeader(email, password)
    );

    const bytes = await this._session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null
    );

    if (message.status_code !== Soup.Status.OK) {
      throw new Error(
        `Failed to fetch server files: ${message.status_code} ${message.reason_phrase}`
      );
    }

    const decoder = new TextDecoder("utf-8");
    const data = bytes.get_data();
    if (!data) {
      throw new Error("Failed to get data from server response");
    }
    const response = decoder.decode(data);

    return response
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }

  private _fetchLocalFiles(): string[] {
    const dir = Gio.File.new_for_path(LOCAL_ANGA_DIR);
    if (!dir.query_exists(null)) {
      return [];
    }

    const files: string[] = [];
    const enumerator = dir.enumerate_children(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      null
    );

    let fileInfo: Gio.FileInfo | null;
    while ((fileInfo = enumerator.next_file(null)) !== null) {
      const name = fileInfo.get_name();
      if (
        !name.startsWith(".") &&
        fileInfo.get_file_type() === Gio.FileType.REGULAR
      ) {
        files.push(name);
      }
    }

    return files;
  }

  private async _downloadFile(
    baseUrl: string,
    email: string,
    password: string,
    filename: string
  ): Promise<void> {
    const encodedEmail = encodeURIComponent(email);
    const encodedFilename = encodeURIComponent(filename);
    const url = `${baseUrl}/api/v1/${encodedEmail}/anga/${encodedFilename}`;

    const message = new Soup.Message({
      method: "GET",
      uri: GLib.Uri.parse(url, GLib.UriFlags.NONE),
    });

    message.request_headers.append(
      "Authorization",
      this._createAuthHeader(email, password)
    );

    const bytes = await this._session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null
    );

    if (message.status_code !== Soup.Status.OK) {
      throw new Error(`${message.status_code} ${message.reason_phrase}`);
    }

    const data = bytes.get_data();
    if (!data) {
      throw new Error(`Failed to get data for file: ${filename}`);
    }

    const localPath = GLib.build_filenamev([LOCAL_ANGA_DIR, filename]);
    const file = Gio.File.new_for_path(localPath);
    file.replace_contents(
      data,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null
    );
  }

  private async _uploadFile(
    baseUrl: string,
    email: string,
    password: string,
    filename: string
  ): Promise<void> {
    const localPath = GLib.build_filenamev([LOCAL_ANGA_DIR, filename]);
    const file = Gio.File.new_for_path(localPath);
    const [, contents] = file.load_contents(null);

    const encodedEmail = encodeURIComponent(email);
    const encodedFilename = encodeURIComponent(filename);
    const url = `${baseUrl}/api/v1/${encodedEmail}/anga/${encodedFilename}`;

    const contentType = this._mimeTypeFor(filename);
    const boundary = `----KayaSyncBoundary${GLib.uuid_string_random()}`;

    const bodyParts: string[] = [];
    bodyParts.push(`--${boundary}`);
    bodyParts.push(
      `Content-Disposition: form-data; name="file"; filename="${filename}"`
    );
    bodyParts.push(`Content-Type: ${contentType}`);
    bodyParts.push("");

    const headerBytes = new TextEncoder().encode(
      bodyParts.join("\r\n") + "\r\n"
    );
    const footerBytes = new TextEncoder().encode(`\r\n--${boundary}--\r\n`);

    const fullBody = new Uint8Array(
      headerBytes.length + contents.length + footerBytes.length
    );
    fullBody.set(headerBytes, 0);
    fullBody.set(contents, headerBytes.length);
    fullBody.set(footerBytes, headerBytes.length + contents.length);

    const message = new Soup.Message({
      method: "POST",
      uri: GLib.Uri.parse(url, GLib.UriFlags.NONE),
    });

    message.request_headers.append(
      "Authorization",
      this._createAuthHeader(email, password)
    );
    message.request_headers.append(
      "Content-Type",
      `multipart/form-data; boundary=${boundary}`
    );

    message.set_request_body_from_bytes(
      `multipart/form-data; boundary=${boundary}`,
      new GLib.Bytes(fullBody)
    );

    const bytes = await this._session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null
    );

    if (
      message.status_code !== Soup.Status.CREATED &&
      message.status_code !== Soup.Status.OK &&
      message.status_code !== 409 // Conflict - file already exists
    ) {
      throw new Error(`${message.status_code} ${message.reason_phrase}`);
    }

    // Silence unused variable warning
    void bytes;
  }

  private async _syncMeta(
    baseUrl: string,
    email: string,
    password: string,
    result: SyncResult
  ): Promise<void> {
    this._ensureMetaDir();

    const serverMetaFiles = await this._fetchServerMetaFiles(
      baseUrl,
      email,
      password
    );
    const localMetaFiles = this._fetchLocalMetaFiles();

    const metaFilesToDownload = serverMetaFiles.filter(
      (f) => !localMetaFiles.includes(f)
    );
    const metaFilesToUpload = localMetaFiles.filter(
      (f) => !serverMetaFiles.includes(f)
    );

    console.log(
      `Meta - Server: ${serverMetaFiles.length}, Local: ${localMetaFiles.length}, Download: ${metaFilesToDownload.length}, Upload: ${metaFilesToUpload.length}`
    );

    for (const filename of metaFilesToDownload) {
      try {
        await this._downloadMetaFile(baseUrl, email, password, filename);
        result.downloaded.push(filename);
        console.log(`[META DOWNLOAD] ${filename}`);
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        result.errors.push({ file: filename, operation: "download", error });
        console.error(`[META DOWNLOAD FAILED] ${filename}: ${error}`);
      }
    }

    for (const filename of metaFilesToUpload) {
      try {
        const filenameValidator = new Filename(filename);
        if (!filenameValidator.isValid()) {
          console.error(
            `Filename contains URL-invalid characters: ${filename}. Skipping upload.`
          );
          result.errors.push({
            file: filename,
            operation: "upload",
            error: "Filename contains URL-illegal characters",
          });
          continue;
        }
        await this._uploadMetaFile(baseUrl, email, password, filename);
        result.uploaded.push(filename);
        console.log(`[META UPLOAD] ${filename}`);
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        result.errors.push({ file: filename, operation: "upload", error });
        console.error(`[META UPLOAD FAILED] ${filename}: ${error}`);
      }
    }
  }

  private _ensureMetaDir(): void {
    const dir = Gio.File.new_for_path(LOCAL_META_DIR);
    if (!dir.query_exists(null)) {
      dir.make_directory_with_parents(null);
    }
  }

  private async _fetchServerMetaFiles(
    baseUrl: string,
    email: string,
    password: string
  ): Promise<string[]> {
    const encodedEmail = encodeURIComponent(email);
    const url = `${baseUrl}/api/v1/${encodedEmail}/meta`;

    const message = new Soup.Message({
      method: "GET",
      uri: GLib.Uri.parse(url, GLib.UriFlags.NONE),
    });

    message.request_headers.append(
      "Authorization",
      this._createAuthHeader(email, password)
    );

    const bytes = await this._session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null
    );

    if (message.status_code !== Soup.Status.OK) {
      console.error(
        `Failed to fetch server meta files: ${message.status_code} ${message.reason_phrase}`
      );
      return [];
    }

    const decoder = new TextDecoder("utf-8");
    const data = bytes.get_data();
    if (!data) {
      return [];
    }

    const response = decoder.decode(data);
    return response
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }

  private _fetchLocalMetaFiles(): string[] {
    const dir = Gio.File.new_for_path(LOCAL_META_DIR);
    if (!dir.query_exists(null)) {
      return [];
    }

    const files: string[] = [];
    const enumerator = dir.enumerate_children(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      null
    );

    let fileInfo: Gio.FileInfo | null;
    while ((fileInfo = enumerator.next_file(null)) !== null) {
      const name = fileInfo.get_name();
      if (
        !name.startsWith(".") &&
        fileInfo.get_file_type() === Gio.FileType.REGULAR &&
        name.endsWith(".toml")
      ) {
        files.push(name);
      }
    }

    return files;
  }

  private async _downloadMetaFile(
    baseUrl: string,
    email: string,
    password: string,
    filename: string
  ): Promise<void> {
    const encodedEmail = encodeURIComponent(email);
    const encodedFilename = encodeURIComponent(filename);
    const url = `${baseUrl}/api/v1/${encodedEmail}/meta/${encodedFilename}`;

    const message = new Soup.Message({
      method: "GET",
      uri: GLib.Uri.parse(url, GLib.UriFlags.NONE),
    });

    message.request_headers.append(
      "Authorization",
      this._createAuthHeader(email, password)
    );

    const bytes = await this._session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null
    );

    if (message.status_code !== Soup.Status.OK) {
      throw new Error(`${message.status_code} ${message.reason_phrase}`);
    }

    const data = bytes.get_data();
    if (!data) {
      throw new Error(`Failed to get data for meta file: ${filename}`);
    }

    const localPath = GLib.build_filenamev([LOCAL_META_DIR, filename]);
    const file = Gio.File.new_for_path(localPath);
    file.replace_contents(
      data,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null
    );
  }

  private async _uploadMetaFile(
    baseUrl: string,
    email: string,
    password: string,
    filename: string
  ): Promise<void> {
    const localPath = GLib.build_filenamev([LOCAL_META_DIR, filename]);
    const file = Gio.File.new_for_path(localPath);
    const [, contents] = file.load_contents(null);

    const encodedEmail = encodeURIComponent(email);
    const encodedFilename = encodeURIComponent(filename);
    const url = `${baseUrl}/api/v1/${encodedEmail}/meta/${encodedFilename}`;

    const boundary = `----KayaSyncBoundary${GLib.uuid_string_random()}`;

    const bodyParts: string[] = [];
    bodyParts.push(`--${boundary}`);
    bodyParts.push(
      `Content-Disposition: form-data; name="file"; filename="${filename}"`
    );
    bodyParts.push("Content-Type: application/toml");
    bodyParts.push("");

    const headerBytes = new TextEncoder().encode(
      bodyParts.join("\r\n") + "\r\n"
    );
    const footerBytes = new TextEncoder().encode(`\r\n--${boundary}--\r\n`);

    const fullBody = new Uint8Array(
      headerBytes.length + contents.length + footerBytes.length
    );
    fullBody.set(headerBytes, 0);
    fullBody.set(contents, headerBytes.length);
    fullBody.set(footerBytes, headerBytes.length + contents.length);

    const message = new Soup.Message({
      method: "POST",
      uri: GLib.Uri.parse(url, GLib.UriFlags.NONE),
    });

    message.request_headers.append(
      "Authorization",
      this._createAuthHeader(email, password)
    );
    message.request_headers.append(
      "Content-Type",
      `multipart/form-data; boundary=${boundary}`
    );

    message.set_request_body_from_bytes(
      `multipart/form-data; boundary=${boundary}`,
      new GLib.Bytes(fullBody)
    );

    const bytes = await this._session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null
    );

    if (
      message.status_code !== Soup.Status.CREATED &&
      message.status_code !== Soup.Status.OK &&
      message.status_code !== 409 &&
      message.status_code !== 422
    ) {
      throw new Error(`${message.status_code} ${message.reason_phrase}`);
    }

    void bytes;
  }

  private _mimeTypeFor(filename: string): string {
    const ext = filename.toLowerCase().split(".").pop() || "";
    const mimeTypes: Record<string, string> = {
      md: "text/markdown",
      url: "text/plain",
      txt: "text/plain",
      json: "application/json",
      toml: "application/toml",
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      html: "text/html",
      htm: "text/html",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }

  private async _syncWords(
    baseUrl: string,
    email: string,
    password: string,
    result: SyncResult
  ): Promise<void> {
    this._ensureWordsDir();

    const serverWords = await this._fetchServerWords(baseUrl, email, password);
    const localWords = this._fetchLocalWords();

    const wordsToDownload = serverWords.filter((w) => !localWords.includes(w));
    const wordsToUpload = localWords.filter((w) => !serverWords.includes(w));

    console.log(
      `Words - Server: ${serverWords.length}, Local: ${localWords.length}, Download: ${wordsToDownload.length}, Upload: ${wordsToUpload.length}`
    );

    await this._downloadWords(
      baseUrl,
      email,
      password,
      wordsToDownload,
      result
    );

    const existingWords = localWords.filter((w) => serverWords.includes(w));
    await this._syncExistingWords(
      baseUrl,
      email,
      password,
      existingWords,
      result
    );
  }

  private _ensureWordsDir(): void {
    const dir = Gio.File.new_for_path(LOCAL_WORDS_DIR);
    if (!dir.query_exists(null)) {
      dir.make_directory_with_parents(null);
    }
  }

  private async _fetchServerWords(
    baseUrl: string,
    email: string,
    password: string
  ): Promise<string[]> {
    const encodedEmail = encodeURIComponent(email);
    const url = `${baseUrl}/api/v1/${encodedEmail}/words`;

    const message = new Soup.Message({
      method: "GET",
      uri: GLib.Uri.parse(url, GLib.UriFlags.NONE),
    });

    message.request_headers.append(
      "Authorization",
      this._createAuthHeader(email, password)
    );

    const bytes = await this._session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null
    );

    if (message.status_code !== Soup.Status.OK) {
      console.error(
        `Failed to fetch server words list: ${message.status_code} ${message.reason_phrase}`
      );
      return [];
    }

    const decoder = new TextDecoder("utf-8");
    const data = bytes.get_data();
    if (!data) {
      return [];
    }

    const response = decoder.decode(data);
    return response
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }

  private _fetchLocalWords(): string[] {
    const dir = Gio.File.new_for_path(LOCAL_WORDS_DIR);
    if (!dir.query_exists(null)) {
      return [];
    }

    const words: string[] = [];
    const enumerator = dir.enumerate_children(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      null
    );

    let fileInfo: Gio.FileInfo | null;
    while ((fileInfo = enumerator.next_file(null)) !== null) {
      const name = fileInfo.get_name();
      if (
        !name.startsWith(".") &&
        fileInfo.get_file_type() === Gio.FileType.DIRECTORY
      ) {
        words.push(name);
      }
    }

    return words;
  }

  private async _fetchWordFiles(
    baseUrl: string,
    email: string,
    password: string,
    anga: string
  ): Promise<string[]> {
    const encodedEmail = encodeURIComponent(email);
    const encodedAnga = encodeURIComponent(anga);
    const url = `${baseUrl}/api/v1/${encodedEmail}/words/${encodedAnga}`;

    const message = new Soup.Message({
      method: "GET",
      uri: GLib.Uri.parse(url, GLib.UriFlags.NONE),
    });

    message.request_headers.append(
      "Authorization",
      this._createAuthHeader(email, password)
    );

    const bytes = await this._session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null
    );

    if (message.status_code !== Soup.Status.OK) {
      console.error(
        `Failed to fetch word file list for ${anga}: ${message.status_code} ${message.reason_phrase}`
      );
      return [];
    }

    const decoder = new TextDecoder("utf-8");
    const data = bytes.get_data();
    if (!data) {
      return [];
    }

    const response = decoder.decode(data);
    return response
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }

  private _fetchLocalWordFiles(anga: string): string[] {
    const angaDir = GLib.build_filenamev([LOCAL_WORDS_DIR, anga]);
    const dir = Gio.File.new_for_path(angaDir);
    if (!dir.query_exists(null)) {
      return [];
    }

    const files: string[] = [];
    const enumerator = dir.enumerate_children(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      null
    );

    let fileInfo: Gio.FileInfo | null;
    while ((fileInfo = enumerator.next_file(null)) !== null) {
      const name = fileInfo.get_name();
      if (
        !name.startsWith(".") &&
        fileInfo.get_file_type() === Gio.FileType.REGULAR
      ) {
        files.push(name);
      }
    }

    return files;
  }

  private async _downloadWords(
    baseUrl: string,
    email: string,
    password: string,
    wordsList: string[],
    result: SyncResult
  ): Promise<void> {
    for (const anga of wordsList) {
      await this._downloadWord(baseUrl, email, password, anga, result);
    }
  }

  private async _downloadWord(
    baseUrl: string,
    email: string,
    password: string,
    anga: string,
    result: SyncResult
  ): Promise<void> {
    const angaDirPath = GLib.build_filenamev([LOCAL_WORDS_DIR, anga]);
    const angaDir = Gio.File.new_for_path(angaDirPath);
    if (!angaDir.query_exists(null)) {
      angaDir.make_directory(null);
    }

    const serverFiles = await this._fetchWordFiles(
      baseUrl,
      email,
      password,
      anga
    );

    for (const filename of serverFiles) {
      await this._downloadWordFile(
        baseUrl,
        email,
        password,
        anga,
        filename,
        result
      );
    }
  }

  private async _syncExistingWords(
    baseUrl: string,
    email: string,
    password: string,
    wordsList: string[],
    result: SyncResult
  ): Promise<void> {
    for (const anga of wordsList) {
      const serverFiles = await this._fetchWordFiles(
        baseUrl,
        email,
        password,
        anga
      );
      const localFiles = this._fetchLocalWordFiles(anga);

      const filesToDownload = serverFiles.filter(
        (f) => !localFiles.includes(f)
      );

      for (const filename of filesToDownload) {
        await this._downloadWordFile(
          baseUrl,
          email,
          password,
          anga,
          filename,
          result
        );
      }
    }
  }

  private async _downloadWordFile(
    baseUrl: string,
    email: string,
    password: string,
    anga: string,
    filename: string,
    result: SyncResult
  ): Promise<void> {
    const encodedEmail = encodeURIComponent(email);
    const encodedAnga = encodeURIComponent(anga);
    const encodedFilename = encodeURIComponent(filename);
    const url = `${baseUrl}/api/v1/${encodedEmail}/words/${encodedAnga}/${encodedFilename}`;

    const message = new Soup.Message({
      method: "GET",
      uri: GLib.Uri.parse(url, GLib.UriFlags.NONE),
    });

    message.request_headers.append(
      "Authorization",
      this._createAuthHeader(email, password)
    );

    const bytes = await this._session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null
    );

    if (message.status_code !== Soup.Status.OK) {
      const error = `${message.status_code} ${message.reason_phrase}`;
      result.errors.push({
        file: `${anga}/${filename}`,
        operation: "download",
        error,
      });
      console.error(`[WORDS DOWNLOAD FAILED] ${anga}/${filename}: ${error}`);
      return;
    }

    const data = bytes.get_data();
    if (!data) {
      result.errors.push({
        file: `${anga}/${filename}`,
        operation: "download",
        error: "Failed to get data from server response",
      });
      console.error(
        `[WORDS DOWNLOAD FAILED] ${anga}/${filename}: Failed to get data from server response`
      );
      return;
    }

    const angaDirPath = GLib.build_filenamev([LOCAL_WORDS_DIR, anga]);
    const angaDir = Gio.File.new_for_path(angaDirPath);
    if (!angaDir.query_exists(null)) {
      angaDir.make_directory(null);
    }

    const localPath = GLib.build_filenamev([angaDirPath, filename]);
    const file = Gio.File.new_for_path(localPath);
    file.replace_contents(
      data,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null
    );

    result.downloaded.push(`${anga}/${filename}`);
    console.log(`[WORDS DOWNLOAD] ${anga}/${filename}`);
  }
}
