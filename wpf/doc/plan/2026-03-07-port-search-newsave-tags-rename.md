# Port Search, New Save, Tags, and App Rename — WPF Implementation Plan

## Context

The GTK version of Save Button has evolved beyond the current WPF port (v0.1.14). The GTK app now has: search with result cards, a separate "New Save" window (extracted from the main window), tag pills in metadata, and has been renamed from "Kaya" to "Save Button". This plan ports all of those features to the WPF app.

## Summary of Changes

### 1. New Model: SearchResult (`Kaya.Core/Models/SearchResult.cs`)

Port `gtk/src/models/search_result.ts` to C#.

- `AngaType` enum: `Bookmark`, `Note`, `File`
- `SearchResult` record: `Filename`, `Type`, `DisplayTitle`, `ContentPreview`, `Date`, `RawTimestamp`
- `SearchResultFactory` static class:
  - `FromFile(filename, contents)` → `SearchResult`
  - `DetermineType(filename)` → `AngaType` (`.url` → Bookmark, `.md` → Note, else File)
  - `ExtractDisplayTitle(filename)` → strip timestamp prefix regex `^\d{4}-\d{2}-\d{2}T\d{6}(?:_\d{9})?-`, strip extension, replace hyphens with spaces
  - `ExtractContentPreview(type, contents)` → domain for bookmarks (parse `URL=` line), 100-char truncation for notes, empty for files
  - `ExtractDate(filename)` → parse `YYYY-MM-DD` from timestamp
  - `ExtractRawTimestamp(filename)` → full timestamp string for sorting
- `MatchesQuery(result, query)` → case-insensitive substring match on filename, displayTitle, contentPreview

### 2. New Service: SearchService (`Kaya.Core/Services/SearchService.cs`)

Port `gtk/src/services/search_service.ts` to C#.

- `LoadAllFiles()` → reads all files from `~/.kaya/anga/`, creates `SearchResult` objects, sorts newest-first by `RawTimestamp`, caches in memory
- `Search(query)` → filters cached results using `MatchesQuery`; empty query returns all
- `InvalidateCache()` → clears cache for refresh after save
- Only reads text content for known text extensions: `.md`, `.url`, `.txt`, `.toml`, `.json`, `.html`
- Reuse `FileService` path logic for the anga directory location

### 3. Update Meta Model to Support Tags

Current `Meta.cs` only supports `note`. Port tag support from GTK `meta.ts`:

- Add `string[] tags` parameter to `Meta` constructor
- TOML output includes `tags = ["tag1", "tag2"]` when tags are present
- Filename suffix logic: `-meta.toml` (both tags and note), `-tags.toml` (tags only), `-note.toml` (note only)
- Update existing `MetaTests.cs` and add new tag-related tests

### 4. Transform MainWindow → EverythingWindow (Search UI)

Replace the current MainWindow (which has save fields + drop zone) with a search-focused "Everything" window:

- **Remove**: Bookmark/Note text entries, Note text box, Save button, drop target
- **Add**: Search text box at top of content area (with 300ms debounce via DispatcherTimer)
- **Add**: Search results area with 3 states:
  - Empty state (no query yet)
  - No results state
  - Results list with cards (icon, title, content preview, date)
- **Add**: Floating "+" button (large, round, accent color) in lower-right corner for opening New Save window
- **Keyboard shortcuts**:
  - `Ctrl+N`: Open New Save window
  - `Ctrl+F`: Focus search entry
  - Keep existing: `Ctrl+Q` (quit), `Ctrl+,` (preferences), `Ctrl+W` (close)
- Search results displayed in a `ListBox` or `ItemsControl` with a card-style `DataTemplate`
- Type icons: use text symbols or Unicode glyphs (WPF doesn't have GTK symbolic icons) — e.g. link icon for bookmarks, document icon for notes, file icon for files

### 5. New Save Window (`NewSaveWindow.xaml` / `NewSaveWindow.xaml.cs`)

Port `gtk/src/views/new_save_window.ts` to WPF:

- **Fields**:
  - "Enter bookmark or note" text entry (auto-focused on open)
  - Tags field with pill support (custom control — see below)
  - "Note (optional)" multi-line text box
- **Buttons**:
  - "Cancel" button (closes window, restores state)
  - "Save" button (accent/primary style)
- **File handling**:
  - Entire window is a drop target for drag-and-drop files
  - "Open File" button in a toolbar/header area opens standard file dialog
  - When file is selected/dropped: main form replaced with file preview (image shown if possible, otherwise icon + filename); "Remove" button (red/destructive) to clear file and return to form
  - Previously-typed text preserved when removing a file
- **Keyboard**:
  - `Escape`: Close window (same as Cancel)
  - Tab order: bookmark → tags → note → buttons
- **Save logic**:
  - Creates `Anga` + optional `Meta` (if tags or note present)
  - Saves dropped file via `DroppedFile` if a file is attached
  - Calls back to EverythingWindow to refresh search results
  - Clears fields and closes window on success

### 6. Tag Pills Custom Control

In the New Save window's tags field:

- A `WrapPanel` inside a `Border` styled like a text box
- Contains tag pill `Border` elements (rounded, accent-colored background, white text) + a `TextBox` for typing
- Typing `,` (comma) finalizes current text as a tag pill; comma character is not stored
- `Backspace` when text box is empty removes the last pill
- Tab when text box is empty moves to next field; if text is present, finalizes as pill first
- Tags stored as `List<string>` internally

### 7. App Rename: Kaya → Save Button

All user-facing text changes:

- `MainWindow.Title`: "Kaya" → "Save Button"
- `AboutWindow.Title`: "About Kaya" → "About Save Button"
- `AboutWindow` app name text: "Kaya" → "Save Button"
- Menu item: "_About Kaya" → "_About Save Button"
- Internal namespaces remain `Kaya.*` (repo name stays Kaya)

## Files to Create

| File | Purpose |
|------|---------|
| `src/Kaya.Core/Models/SearchResult.cs` | SearchResult model + factory + query matching |
| `src/Kaya.Core/Services/SearchService.cs` | File loading, caching, search filtering |
| `src/Kaya.Wpf/NewSaveWindow.xaml` | New Save window XAML layout |
| `src/Kaya.Wpf/NewSaveWindow.xaml.cs` | New Save window code-behind |
| `tests/Kaya.Tests/SearchResultTests.cs` | SearchResult unit tests |

## Files to Modify

| File | Changes |
|------|---------|
| `src/Kaya.Core/Models/Meta.cs` | Add tags support, suffix logic |
| `src/Kaya.Wpf/MainWindow.xaml` | Replace save form with search UI + FAB button |
| `src/Kaya.Wpf/MainWindow.xaml.cs` | Search logic, New Save window launch, remove save logic |
| `src/Kaya.Wpf/AboutWindow.xaml` | Rename to "Save Button" |
| `src/Kaya.Wpf/App.xaml.cs` | Pass services to MainWindow, wire up search service |
| `tests/Kaya.Tests/MetaTests.cs` | Add tag tests, update suffix expectations |

## Implementation Order

### Phase 1: Models (test-first)
1. Create `SearchResult.cs` with `SearchResultFactory` and `MatchesQuery`
2. Create `SearchResultTests.cs` — port all tests from `gtk/tests/search_result.test.ts`
3. Update `Meta.cs` to accept tags, implement suffix logic
4. Update `MetaTests.cs` with tag tests

### Phase 2: Services
5. Create `SearchService.cs` — load files, cache, search, invalidate

### Phase 3: UI — New Save Window
6. Create `NewSaveWindow.xaml` / `.xaml.cs` with form fields, tag pills, file handling
7. Move save logic from `MainWindow` to `NewSaveWindow`

### Phase 4: UI — Everything Window (Search)
8. Rewrite `MainWindow.xaml` as search-focused Everything window
9. Rewrite `MainWindow.xaml.cs` with search, FAB button, Ctrl+N shortcut

### Phase 5: App Rename
10. Rename all user-facing "Kaya" text to "Save Button"

### Phase 6: Verify
11. Run `dotnet test` — all tests pass
12. Run `dotnet build` — builds cleanly

## Verification

1. `dotnet test` — all existing + new tests pass
2. `dotnet build` — no warnings or errors
3. Manual verification (on Windows):
   - App launches with title "Save Button"
   - Search box visible, typing filters results
   - "+" button opens New Save window
   - Ctrl+N opens New Save window
   - Can save bookmarks and notes with tags
   - Tag pills appear on comma, backspace removes them
   - File drag-and-drop works in New Save window
   - About dialog says "Save Button"
   - Escape closes New Save window
