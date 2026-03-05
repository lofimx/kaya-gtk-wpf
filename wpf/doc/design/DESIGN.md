# GTK => WPF Port: Design

* use .NET 9, as it supports dark/light theme switching automatically
* use plain WPF for default Windows appearance
* ensure everything conforms to dark/light theme switching, even if some features don't work by default: title bars, About dialogs, etc.
* follow Microsoft design guidelines but reuse the GNOME icons from the GTK app
