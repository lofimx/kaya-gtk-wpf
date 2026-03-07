# Rename 'ca.deobald.Kaya' to 'org.savebutton.SaveButton' and Rebrand to "Save Button"

## Context

The application ID is changing from `ca.deobald.Kaya` to `org.savebutton.SaveButton` (Flatpak requires 3+ segments) and the user-facing name from "Kaya" to "Save Button". The icon changes from the wooden cube to the yellow floppy disk at `gtk/doc/design/yellow-floppy3.svg`. Internally, "kaya" remains as the repo/namespace name. After this refactoring, `ca.deobald` should appear nowhere in the codebase.

## Plan

### Step 1: Rename files with `ca.deobald.Kaya` in their filename

**Config/build files:**
| Old | New |
|---|---|
| `data/ca.deobald.Kaya.desktop.in` | `data/org.savebutton.desktop.in` |
| `data/ca.deobald.Kaya.gschema.xml` | `data/org.savebutton.gschema.xml` |
| `data/ca.deobald.Kaya.metainfo.xml.in` | `data/org.savebutton.metainfo.xml.in` |
| `data/ca.deobald.Kaya.data.gresource.xml` | `data/org.savebutton.data.gresource.xml` |
| `src/ca.deobald.Kaya.src.gresource.xml` | `src/org.savebutton.src.gresource.xml` |
| `src/ca.deobald.Kaya.in` | `src/org.savebutton.in` |
| `build-aux/flatpak/ca.deobald.Kaya.json` | `build-aux/flatpak/org.savebutton.json` |
| `ca.deobald.Kaya.json` | `org.savebutton.json` |

**Icon files** (all under `data/icons/hicolor/`):
- `*/apps/ca.deobald.Kaya.png` → `*/apps/org.savebutton.png` (6 sizes)
- `scalable/apps/ca.deobald.Kaya.svg` → `scalable/apps/org.savebutton.svg`
- `symbolic/apps/ca.deobald.Kaya-symbolic.svg` → `symbolic/apps/org.savebutton-symbolic.svg`

Delete `ca.deobald.Kaya.flatpak` binary if present.

### Step 2: Replace icon artwork

- Copy `doc/design/yellow-floppy3.svg` → `data/icons/hicolor/scalable/apps/org.savebutton.svg`
- Copy `doc/design/yellow-floppy3.svg` → `icon.svg` (root; used by macOS bundle for icns generation)
- Generate PNG icons from the SVG at 16, 32, 48, 64, 128, 256 px → `data/icons/hicolor/*/apps/org.savebutton.png`
- Create `org.savebutton-symbolic.svg` — monochrome floppy silhouette, 16×16 viewBox, `fill="currentColor"` per GNOME symbolic icon spec
- Delete all old `ca.deobald.Kaya.*` icon files

### Step 3: Update file contents — application ID and resource paths

Global replacements: `ca.deobald.Kaya` → `org.savebutton`, `/ca/deobald/Kaya` → `/org/savebutton`, `ca.deobald` → `org.savebutton` (for developer id)

**Build system:**
- `src/meson.build` — gresource name, `.in` filename, `resource_path`
- `data/meson.build` — desktop, metainfo, gschema, gresource filenames
- `data/icons/meson.build` — `application_id`

**Data/config files (already renamed):**
- `data/org.savebutton.desktop.in` — Exec, Icon, StartupWMClass
- `data/org.savebutton.gschema.xml` — schema id and path (`/org/savebutton/`)
- `data/org.savebutton.metainfo.xml.in` — id, developer id, launchable desktop-id
- `data/org.savebutton.data.gresource.xml` — gresource prefix
- `src/org.savebutton.src.gresource.xml` — gresource prefix

**Flatpak manifests:**
- `build-aux/flatpak/org.savebutton.json` — id, command
- `org.savebutton.json` — id, command

**TypeScript source:**
- `src/main.ts` — `application_id`, `application_icon`, `application_name` → "Save Button", About dialog
- `src/views/everything_window.ts` — Template resource path, `icon_name`
- `src/views/new_save_window.ts` — Template resource path
- `src/views/preferences.ts` — Template resource path
- `src/services/settings_service.ts` — `SECRET_SCHEMA_NAME`, `KEYCHAIN_SERVICE`, `WINCRED_RESOURCE`

**macOS build:**
- `build-aux/macos/bundle.sh` — `APP_NAME="SaveButton"`, `APP_ID="org.savebutton"`, icns naming (`savebutton.icns`, `savebutton.iconset`)
- `build-aux/macos/create-dmg.sh` — `APP_NAME="SaveButton"`
- `build-aux/macos/Info.plist.in` — `CFBundleDisplayName`/"Save Button", `CFBundleName`/"Save Button", `CFBundleIdentifier`/`org.savebutton`, `CFBundleIconFile`/`savebutton.icns`
- `build-aux/macos/kaya-launcher.js` — update "Kaya.app" in error message to "SaveButton.app"

**CI/CD:**
- `.github/workflows/macos.yml` — `Kaya.app` → `SaveButton.app`, gresource filenames, artifact names, icns filename
- `.gitlab-ci.yml` — `MANIFEST_PATH`, `BUNDLE`, `APP_ID`

**Other files:**
- `.eslintrc.js` — update `ca.deobald.Kaya.in` → `org.savebutton.in`
- `po/POTFILES.in` — update all filenames
- `bin/release.rb` — update all `ca.deobald.Kaya` references
- `README.md` — update gresource filename reference
- `FLATHUB_NOTES.md` — update all references
- `doc/PROMPTS.md` — update references
- `doc/plan/2026-03-06-move-new-save-to-own-window.md` — update references

### Step 4: User-facing name → "Save Button"

Change in user-visible text only:
- `src/main.ts` — `application_name: "Save Button"`
- `data/org.savebutton.desktop.in` — `Name=Save Button`
- `data/org.savebutton.metainfo.xml.in` — `<name>Save Button</name>`
- `data/everything_window.ui` — title widget "Save Button"
- `build-aux/macos/Info.plist.in` — `CFBundleDisplayName`, `CFBundleName`

**NOT changed** (internal names stay as "kaya"/"Kaya"):
- `meson.build` project name (`kaya`)
- Directory names (`~/.kaya/`)
- Shell launcher filenames (`kaya-launcher.js`, `kaya-shell-launcher.sh`)
- Environment variables (`KAYA_PLATFORM`, `KAYA_RESOURCES_DIR`)
- `share/kaya/` resource paths

### Step 5: Makefile artifact names

- `Kaya.app` → `SaveButton.app`
- `Kaya.dmg` → `SaveButton.dmg`
- `kaya.icns` → `savebutton.icns`

## Verification

1. `make test` — all tests pass
2. `make lint` — no new errors
3. `make build` — flatpak builds
4. `make run` — title bar "Save Button", About dialog "Save Button" with yellow floppy icon
5. `grep -r "ca.deobald" gtk/ --include='*.ts' --include='*.ui' --include='*.xml' --include='*.json' --include='*.sh' --include='*.rb' --include='*.js' --include='*.yml' --include='*.in' --include='*.css' --include='*.md'` — zero matches
