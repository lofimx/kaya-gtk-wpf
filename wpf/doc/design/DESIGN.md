# GTK => WPF Port: Design

* use .NET 9, as it supports dark/light theme switching automatically
* use plain WPF for default Windows appearance
* ensure everything conforms to dark/light theme switching, even if some features don't work by default: title bars, About dialogs, etc.
* never use `SystemColors` resources (e.g. `SystemColors.ControlBrushKey`, `SystemColors.WindowBrushKey`) — these are legacy Win32 colors that do not follow the Fluent `ThemeMode="System"` dark/light switching. Instead, omit explicit backgrounds to inherit from the Fluent theme, or use theme-aware Fluent resource keys.
* follow Microsoft design guidelines but reuse the GNOME icons from the GTK app
