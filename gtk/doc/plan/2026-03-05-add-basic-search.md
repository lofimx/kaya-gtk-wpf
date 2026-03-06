# Add Basic Search

## Context

Kaya's core value is retrieval (ADR-0001), but the GTK app currently only supports creating notes/bookmarks. This feature adds search to the main window, replacing the drag-and-drop frame with a search results area. It also restructures the window to make the notes field collapsible and moves drag-and-drop to the entire window. This brings the GTK app closer to parity with the Flutter apps.

## Requirements

1. Remove the `GtkFrame` drop target widget; make the entire window a drop target instead
2. Replace the drop target area with a search results widget (similar to the Flutter apps' grid layout)
3. Add a search widget to the title bar that updates results as the user types
4. Make the "Notes" text entry collapsed by default with an appropriate Adwaita widget

## Plan

### Step 1: New model — `src/models/search_result.ts`

Pure TypeScript, no GJS dependencies (unit-testable).

- `AngaType` type: `"bookmark" | "note" | "file"`
- `SearchResult` interface: `filename`, `type`, `displayTitle`, `contentPreview`, `date`, `rawTimestamp`
- `SearchResultFactory` class:
  - `fromFile(filename, contents)` — determines type from extension (`.url` = bookmark, `.md` = note, else file), extracts display title (strip timestamp prefix + extension, replace hyphens with spaces), extracts content preview (for `.url` parse `URL=` line and show domain; for `.md` first ~100 chars), extracts date from timestamp prefix
  - `determineType(filename)`, `extractDisplayTitle(filename)`, `extractDate(filename)`
- `matchesQuery(result, query)` — case-insensitive substring match on filename, displayTitle, contentPreview

Register in `src/meson.build`.

### Step 2: Tests — `tests/search_result.test.ts`

Following existing test patterns (`anga.test.ts`, etc.):

- `fromFile()` for bookmark, note, and generic file types
- Display title extraction from various filenames
- Date extraction from timestamp prefix
- Content preview for `.url` (domain) and `.md` (text)
- `matchesQuery()` case-insensitive matching

Run `make test` to verify.

### Step 3: New service — `src/services/search_service.ts`

Reuses `Gio.File.enumerate_children()` pattern from `sync_service.ts` (`_fetchLocalFiles`).

- `loadAllFiles(): SearchResult[]` — enumerate `~/.kaya/anga/`, read text file contents (skip binary: images, PDFs, etc.), return sorted newest-first by `rawTimestamp`
- `search(query): SearchResult[]` — filter `loadAllFiles()` results using `matchesQuery()`
- `invalidateCache()` — clears cached results (called after save/drop)
- Private: `_listAngaFiles()`, `_readFileContents(filename)` (only for `.md`, `.url`, `.txt`)

Register in `src/meson.build`.

### Step 4: Modify `data/window.ui`

- **Header bar**: Replace `AdwWindowTitle` with `GtkSearchEntry` (id: `searchEntry`, placeholder: "Search...")
- **Notes section**: Add `GtkToggleButton` (id: `noteToggle`, label "Add a note", icon `go-down-symbolic`) before noteText. Wrap `GtkTextView` + label inside `GtkRevealer` (id: `noteRevealer`, `reveal-child=false`, `transition-type=slide-down`)
- **Drop target**: Remove entire `GtkFrame` (`dropTargetFrame`) and children
- **Search results**: After save button, add `GtkStack` (id: `resultsStack`, `vexpand=true`) with three pages:
  - `"empty"`: `AdwStatusPage` ("No items yet", icon: `folder-documents-symbolic`)
  - `"no-results"`: `AdwStatusPage` ("No results", icon: `system-search-symbolic`)
  - `"results"`: `GtkScrolledWindow` > `GtkFlowBox` (id: `searchResultsFlowBox`, `homogeneous=true`, `min-children-per-line=2`, `max-children-per-line=4`, `selection-mode=none`)
- Increase `default-height` to 700; widen `AdwClamp` or restructure so results area is full-width

### Step 5: Modify `src/views/window.ts`

- Remove `_dropTargetFrame` from InternalChildren/fields
- Add new InternalChildren: `searchEntry`, `noteRevealer`, `noteToggle`, `resultsStack`, `searchResultsFlowBox`
- Add `GLib` import for timeout functions
- **Drop target**: Change `this._dropTargetFrame.add_controller(dropTarget)` to `this.add_controller(dropTarget)`
- **Search**: `_setupSearch()` connects `searchEntry` "search-changed" with 300ms debounce via `GLib.timeout_add`/`GLib.source_remove`
- **Results**: `_performSearch()` switches stack page based on query/results; `_populateResults(results)` creates card widgets per result (type icon, content preview, display title, date label)
- **Note toggle**: `_setupNoteToggle()` connects toggle button to revealer `reveal_child`
- **Refresh after save/drop**: Call `searchService.invalidateCache()` + `_performSearch()` in `onSave()` and `_handleDroppedFile()` after success
- Constructor: init SearchService, call setup methods, call `_performSearch()` for initial load

### Step 6: Update `data/style.css`

Replace legacy crossword CSS with search result card styles (padding, min-width, min-height).

## Verification

1. `make test` — search_result tests pass
2. `make lint` — no lint errors
3. `make build` — flatpak builds
4. `make run` — manual testing:
   - Search entry in header bar, results update as user types
   - Empty state when no files exist
   - "No results" state for unmatched queries
   - Note toggle expands/collapses text area
   - Drag-and-drop works anywhere on window
   - Saving refreshes results

## Files to modify/create

- **New**: `src/models/search_result.ts`, `src/services/search_service.ts`, `tests/search_result.test.ts`
- **Modify**: `data/window.ui`, `src/views/window.ts`, `data/style.css`, `src/meson.build`
