# Fix Flatpak App ID: `org.savebutton` to `org.savebutton.SaveButton`

## Problem

The current flatpak app ID `org.savebutton` is invalid because it requires at least 2 periods (3 segments). This needs to be changed to `org.savebutton.SaveButton` throughout the codebase.

## Changes

### 1. File Renames

All files named with `org.savebutton.*` prefix need to be renamed to `org.savebutton.SaveButton.*`.

### 2. Content Updates

Three categories of string replacements:

- **Dotted app ID**: `org.savebutton` -> `org.savebutton.SaveButton` (in app IDs, icon names, schema IDs, etc.)
- **Resource path**: `/org/savebutton` -> `/org/savebutton/SaveButton` (in GResource XML prefixes, template paths, CSS/JS import paths)
- **GSettings path**: `/org/savebutton/` -> `/org/savebutton/SaveButton/` (in gschema path attribute)

### 3. Scope

All source files, build files, CI configs, packaging scripts, and documentation (excluding `doc/plan/` and `doc/PROMPTS.md`).
