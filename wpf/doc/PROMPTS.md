# Windows C# WPF Port Prompts

## 2026-03-07 Port Search, New Save, Tags, and app rename

Read [@plan](file:///home/steven/work/lofimx/kaya-gtk-wpf/wpf/doc/plan), then port all features from [@PROMPTS.md](file:///home/steven/work/lofimx/kaya-gtk-wpf/gtk/doc/PROMPTS.md) to the WPF version of the application found in [@wpf](file:///home/steven/work/lofimx/kaya-gtk-wpf/wpf).

### BUG: Widgets not following theme

The "tags" widget entry background is not following the system theme.

The background of the opened file widget in the "New Save" window is not following the system theme.

The background of the tiles (for anga/saves) on the Everything screen is not following the system theme.

### BUG: Icon is not displaying

The "Save Button" icon ([@yellow-floppy3.svg](file:///C:/Users/steven/work/kaya-gtk-wpf/wpf/doc/design/yellow-floppy3.svg)) should be used for the application's window, task bar, title bar, etc.

Write a utility .NET console app but keep it in `wpf/bin/`, rather than throwing it away, since we'll need to convert other SVGs to ICO/PNG/etc. in the future on Windows. Then use the console app to convert the SVG to ICO
