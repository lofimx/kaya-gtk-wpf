# GTK Historical Prompts

## Add basic search

Remove the drag-and-drop file drop target and make the entire window a drop target instead. Replace the old drop target area with a search results widget, similar to what is rendered in `~/work/lofimx/kaya-desktop-flutter/` or `~/work/lofimx/kaya-flutter/`. Add a search widget to the title bar of the window that updates search results as the user types.

Make the "Notes" text entry collapsed by default with the appropriate GTK/adwaita widget for hiding it.

## Move "New Save" into its own window

Read [@PLAN.md](file:///home/steven/work/lofimx/kaya-gtk-wpf/gtk/doc/plan/PLAN.md) and follow its instructions to plan this work. Ask any questions before finalizing the plan.

The "New Save" functionality ("Enter bookmark", "Add a note", and "Save" widgets) are too visually busy on the main search window. Rename [@window.ts](file:///home/steven/work/lofimx/kaya-gtk-wpf/gtk/src/views/window.ts) to `everything.ts` and extract the "New Save" widgets into `src/views/new.ts`. The "New Save" window should include a "Cancel" button in the style dictated by the GNOME HIG and the "Save" button should be the suggested action. Pressing <esc> should close the "New Save" window in the same way the Cancel button does.

The entire "New Save" window should be a drop target for drag-and-drop files, instead of the Everything window. It should also include a symbolic icon button in the titlebar to "Open a File". This button opens the standard file selection dialog. If a file is dropped or the "Open a File" button is used to select a file, the primary UI is replaced with a widget displaying the contents of that file (or a representative icon, if that's not possible), except for the "Save" and "Cancel" buttons. A destructive action (https://developer.gnome.org/hig/patterns/controls/buttons.html) red button should be overlaid on the file display for "Remove", which will return the primary UI to its default state, with any previously-typed text in the bookmark/notes/tags text fields.

From the Everything window, the "New Save" window can be brought up by typing CTRL+N (or CMD+N on Mac) or clicking a large, round "+" button (suggested action), which should float over top of other controls in the lower-right of the Everything window, in the style of a mobile app.

Move the Search bar down from the title bar to the top of the main Everything window area.

### Tags

In the "New Save" window, a field for saving tags, in addition to notes, which will be saved according to [@adr-0003-metadata.md](file:///home/steven/work/lofimx/kaya-gtk-wpf/gtk/doc/arch/adr-0003-metadata.md). Tags should appear as primary color "pills" when comma (",") is typed or the tags field is exited, indicating that a complete tag has been typed. The literal comma should not be typed into the Tags box when a pill/tag is created. Typing <backspace> to the right of a "pill" tag will delete the entire tag.
