# pi-footer

Private extension that replaces Pi's footer with an Atlas-style status line.

The footer displays these items in order:

1. `π` and the running Pi version
2. Provider/model and thinking level
3. The working directory shortened to `…/<parent>/<current>`, followed by the Git branch
4. Context usage as a colored `⛁` meter and a whole-number percentage
5. Cache usage for the latest non-aborted, non-error assistant prompt

The context meter uses 24 cells at widths of 80 columns or more, then 16, 8, or 6 cells below 80, 55, or 35 columns. Cache usage is `cacheRead / (input + cacheRead + cacheWrite)`, rounded to a whole percent; it is hidden when the prompt has no input or cache tokens.

The footer keeps one space of side padding and uses Nerd Font glyphs for the Git branch and cache indicators. Other extensions' statuses keep their ANSI styling on a separate line, except `mcp` and `codex-status`, which are hidden. Background command status retains its `/proc` label.

Light and dark colors are selected from the active Pi theme name without reading machine-specific theme configuration.
