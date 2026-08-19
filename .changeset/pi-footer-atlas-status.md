---
"@edheltzel/pi-bits": patch
---

Rework the Pi footer (re-exported by `pi-bits`) to the Atlas status-line information design: `π` + Pi version, provider/model with thinking level, working directory shortened to `…/<parent>/<current>`, git branch with the Nerd Font branch glyph, a responsive 24-cell context meter, and cache hit percent from the latest successful assistant prompt with the Nerd Font cache glyph. Extension statuses keep their own ANSI styling; `codex-status` and `mcp` are suppressed and the background-process status keeps its `/proc` special case.
