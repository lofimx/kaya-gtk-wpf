# Move "New Save" into its Own Window

## Context

The "New Save" functionality (bookmark entry, notes, save button) is visually busy in the main search window. This change extracts it into a dedicated window, adds a Tags feature, moves drag-and-drop and file selection to the New Save window, and adds a floating action button (FAB) + Ctrl+N shortcut to open it from the main window. The search bar is also moved from the title bar into the main content area.

## Plan

### Step 1: Extend Meta model with tags support

**Modify:** `gtk/src/models/meta.ts`

- Add `tags: string[]` parameter to the constructor (update all call sites)
- Change filename suffix logic: tags-only → `-tags.toml`, note-only → `-note.toml`, both → `-meta.toml`
- In `toMetaFile()`, conditionally include `tags = [...]` and/or `note = '''...'''` in TOML `[meta]` section
- TOML format per ADR-0003: `tags = ["tag1", "tag2"]`

**Modify:** `gtk/tests/meta.test.ts`

- Update existing tests to pass `[]` for tags parameter
- Test: tags only (no note) — generates `-tags.toml` with `tags` line, no `note` line
- Test: both tags and note — generates `-meta.toml` with both
- Test: note only, empty tags — backward compatible, generates `-note.toml` (existing behavior)

### Step 2: Rename Window → EverythingWindow

**Rename:** `gtk/src/views/window.ts` → `gtk/src/views/everything_window.ts`
**Rename:** `gtk/data/window.ui` → `gtk/data/everything_window.ui`

**Modify:** `gtk/src/views/everything_window.ts`

- Rename class `Window` → `EverythingWindow`
- Update Template path to `resource:///ca/deobald/Kaya/everything_window.ui`
- Remove save-related fields/InternalChildren: `_angaText`, `_noteText`, `_saveButton`, `_noteRevealer`, `_noteToggle`
- Remove methods: `_setupNoteToggle()`, `onSave()`, `_setupDropTarget()`, `_handleDroppedFile()`, `showSuccess()`, `showFailure()`
- Remove imports: `Anga`, `Dropped`, `FileService`, `Meta`, `SystemClock`, `Gdk`
- Remove `Gio._promisify` block (no longer needed here)
- Add public `refreshSearch()` method calling `_searchService.invalidateCache()` + `_performSearch()`
- Add `Gtk.EventControllerKey` on the window: when a printable key is pressed and no widget has focus, grab focus on `_searchEntry` and forward the keystroke
- Add Ctrl+F accelerator that focuses `_searchEntry`

**Modify:** `gtk/data/everything_window.ui`

- Change template class to `Gjs_EverythingWindow`
- Remove from template: entire `AdwClamp` with `angaText`, `noteToggle`, `noteRevealer`, `noteText`, `saveButton`; the `GtkSeparator` below it
- Move `GtkSearchEntry` from header bar `title-widget` into main content area at top, wrapped in `AdwClamp` with margins
- Replace header bar title-widget with `AdwWindowTitle` (title: "Kaya")
- Wrap `GtkStack` (results) in `GtkOverlay`; add circular `suggested-action` FAB button ("+" / `list-add-symbolic`) at bottom-end with margins, connected to `app.new-save` action

**Modify:** `gtk/data/ca.deobald.Kaya.data.gresource.xml`

- Replace `window.ui` → `everything_window.ui`
- Add `new_save_window.ui`

**Modify:** `gtk/src/meson.build`

- Replace `views/window.ts` → `views/everything_window.ts`
- Add `views/new_save_window.ts`

**Modify:** `gtk/data/style.css`

- Add `.fab` class: `min-width: 56px; min-height: 56px;`
- Add `.tag-pill` class: `border-radius: 999px; padding: 4px 10px; margin: 2px;`

### Step 3: Create the New Save window

**Create:** `gtk/data/new_save_window.ui`

`Adw.Window` template (class `Gjs_NewSaveWindow`):
- `AdwHeaderBar` with Cancel button (start), `AdwWindowTitle` "New Save" (center), "Open a File" icon button `document-open-symbolic` (end), Save button `suggested-action` (end)
- `GtkStack` (id: `contentStack`) with two pages:
  - `"form"`: `GtkScrolledWindow` → `AdwClamp` → vertical `GtkBox` containing:
    - `GtkEntry` (id: `angaText`, placeholder "Enter bookmark or note...")
    - Tags area: `GtkBox` containing `GtkFlowBox` (id: `tagsFlowBox`) + `GtkEntry` (id: `tagsEntry`, placeholder "Tags...")
    - `GtkToggleButton` (id: `noteToggle`, "Add a note", flat)
    - `GtkRevealer` (id: `noteRevealer`) → `GtkTextView` (id: `noteText`)
  - `"file-preview"`: `GtkOverlay` with file display content + destructive "Remove" button
- Window: `default-width=450`, `default-height=500`

**Create:** `gtk/src/views/new_save_window.ts`

`NewSaveWindow extends Adw.Window`:
- Fields: `_tags: string[]`, `_droppedFileData: { filename, contents } | null`, `_fileService`, `_onSaveComplete` callback
- Constructor accepts `onSaveComplete: () => void` callback for refreshing Everything window
- On window `show`/`map`: grab focus on `_angaText` (bookmark entry field)
- Add `Gtk.EventControllerKey` on the window: when a printable key is pressed and no text widget has focus, grab focus on `_angaText` and forward the keystroke
- `_setupTagsInput()`: `Gtk.EventControllerKey` on `tagsEntry` — intercept comma (create pill, prevent insertion), backspace-when-empty (delete last pill). `Gtk.EventControllerFocus` — finalize tag on focus out.
- `_createTagPill(text)`: `GtkBox` with `tag-pill` + `suggested-action` CSS, containing `GtkLabel`
- `_setupDropTarget()`: `Gtk.DropTarget` for `Gdk.FileList.$gtype` on the window
- `_handleDroppedFile(file)`: read contents synchronously, store in `_droppedFileData`, switch contentStack to `"file-preview"`, populate with `GtkPicture` (images) or icon+label (other files). MIME detection via `Gio.content_type_guess()`.
- `_onOpenFile()`: `Gtk.FileDialog.open()` (async, needs `Gio._promisify`), same handling as drop
- `_onRemoveFile()`: clear `_droppedFileData`, switch back to `"form"` (text fields preserved by GtkStack)
- `_onCancel()`: `this.close()`
- `_onSave()`: save logic from old `Window.onSave()`:
  - If dropped file: save via `Dropped` model + `FileService.saveDroppedFile()`
  - Else: save via `Anga` model + `FileService.save()`
  - If note or tags present: create `Meta(angaFilename, note, clock, tags)` + `FileService.saveMeta()`
  - On success: toast, `_onSaveComplete()`, close window
  - On error: error toast, stay open
- Escape shortcut: `GtkShortcut` with Escape trigger → close

### Step 4: Wire up in Application

**Modify:** `gtk/src/main.ts`

- Change import: `Window` → `EverythingWindow` from `./views/everything_window.js`
- Add import: `NewSaveWindow` from `./views/new_save_window.js`
- Change `#window` type to `EverythingWindow`
- Add `app.new-save` action:
  - Creates `NewSaveWindow` (transient_for: active_window, modal: true, onSaveComplete: refresh)
  - When no owning window exists (future OS-wide shortcut), create without transient_for/modal
  - Presents it
- Register accelerators: `<Control>n` for `app.new-save`, `<Control>f` for focusing search

### Step 5: Update help overlay

**Modify:** `gtk/data/gtk/help-overlay.ui`

- Add shortcut entry: "New Save" → `app.new-save`
- Add shortcut entry: "Search" → Ctrl+F

## Files Summary

**New:** `gtk/data/new_save_window.ui`, `gtk/src/views/new_save_window.ts`
**Rename:** `gtk/src/views/window.ts` → `everything_window.ts`, `gtk/data/window.ui` → `everything_window.ui`
**Modify:** `gtk/src/models/meta.ts`, `gtk/tests/meta.test.ts`, `gtk/src/main.ts`, `gtk/src/meson.build`, `gtk/data/ca.deobald.Kaya.data.gresource.xml`, `gtk/data/style.css`, `gtk/data/gtk/help-overlay.ui`

## Verification

1. `make test` — new Meta tags tests pass, existing tests pass
2. `make lint` — no errors
3. `make build` — flatpak builds
4. `make run` — manual testing:
   - Everything window shows search bar in content area (not title bar)
   - Typing in Everything window auto-focuses search entry
   - Ctrl+F focuses search entry
   - FAB "+" button visible in lower-right corner
   - Ctrl+N opens New Save window
   - New Save: bookmark entry is focused on open
   - New Save: typing when no widget focused auto-selects bookmark entry
   - New Save: Cancel and Escape close the window
   - New Save: typing text + Save creates anga file
   - New Save: typing tags with commas creates pills; backspace removes pills
   - New Save: tags-only → `-tags.toml`, note-only → `-note.toml`, both → `-meta.toml`
   - New Save: drag-and-drop shows file preview; Remove returns to form
   - New Save: "Open a File" button opens file dialog
   - After save, Everything window search results refresh
