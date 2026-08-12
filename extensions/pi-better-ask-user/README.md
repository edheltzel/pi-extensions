# pi-better-ask-user

This is an Atlas-maintained fork of [edlsh/pi-ask-user](https://github.com/edlsh/pi-ask-user). It builds on the upstream interaction design while exposing Atlas-owned `pi-better-ask-user` package, tool, skill, event, and environment-variable contracts, plus optional Herdr lifecycle and metadata integration inspired by [leset0ng/pi-ask-herdr](https://github.com/leset0ng/pi-ask-herdr).

A Pi package that adds an interactive `better_ask_user` tool for collecting user decisions during an agent run.

## Screenshot

![`better_ask_user` release-strategy prompt](./assets/better-ask-user-overlay.png)

## Features

- Searchable single-select option lists with wrapped titles and descriptions
- Responsive split-pane details preview on wide terminals with single-column fallback on narrow terminals
- Multi-select option lists
- Optional freeform responses
- User-toggleable extra context on structured selections
- Context display support
- Configurable display mode: `overlay` (modal, default) or `inline` (rendered directly in the flow)
- Runtime overlay toggle: press the configured overlay-toggle key (`alt+o` by default, configurable per call or via env var) while the prompt is open to temporarily hide/show the popup so you can read prior agent output, then press it again to bring it back
- Pi-TUI-aligned keybinding and editor behavior
- Custom TUI rendering for tool calls and results
- System prompt integration via `promptSnippet` and `promptGuidelines`
- Optional timeout for auto-dismiss in both overlay and fallback input modes
- Structured `details` on all results for session state reconstruction
- Graceful fallback when interactive UI is unavailable
- Optional Herdr blocked-state and pending-question metadata while waiting for input
- Bundled `better-ask-user` skill for mandatory decision-gating in high-stakes or ambiguous tasks
- `/better-ask-preview` JSON fixture runner for model-free testing through the real Pi UI

## Bundled skill: `better-ask-user`

This package now ships a skill at `skills/better-ask-user/SKILL.md` that nudges/mandates the agent to use `better_ask_user` when:

- architectural trade-offs are high impact
- requirements are ambiguous or conflicting
- assumptions would materially change implementation

The skill follows a "decision handshake" flow:

1. Gather evidence and summarize context
2. Ask one focused question via `better_ask_user`
3. Wait for explicit user choice
4. Confirm the decision, then proceed

See: `skills/better-ask-user/references/better-ask-user-skill-extension-spec.md`.

## Preview question workflows without installing

Pi can load the local extension source for one interactive session without adding it to `settings.json`. This lets extension authors preview a complete question workflow in the real TUI without invoking a model:

```bash
cd ~/Developer/AI/Extensions/pi-extensions
pi --no-extensions -e ./extensions/pi-better-ask-user/src/index.ts
```

`--no-extensions` disables discovered/global extensions so an installed copy cannot conflict; the explicit `-e` extension still loads. In the temporary Pi session, run the bundled smoke fixture through the real UI without an agent turn:

```text
/better-ask-preview ./extensions/pi-better-ask-user/examples/preview-questions.json
```

The fixture path is resolved relative to the directory where Pi started. The command accepts a non-empty JSON array whose entries use the same canonical fields as the `better_ask_user` tool. It validates the complete fixture before opening the UI, runs questions sequentially through the production tool path, stops on cancellation or error, and reports completion through a Pi notification.

```json
[
  {
    "question": "Which option should we use?",
    "context": "Optional context shown above the question.",
    "options": [
      { "title": "First", "description": "Optional detail" },
      { "title": "Second" }
    ],
    "allowFreeform": true
  }
]
```

## Install

Install the Atlas extension collection directly from GitHub:

```bash
pi install git:github.com/edheltzel/pi-extensions
```

Pi installs a missing Git package automatically and can update the unpinned collection with:

```bash
pi update git:github.com/edheltzel/pi-extensions
```

For local development, install only this workspace from the monorepo root:

```bash
pi install ./extensions/pi-better-ask-user
```

This workspace remains private and is not published to npm. Run `/reload` after installation or source changes.

## Herdr integration

Herdr integration activates automatically only when all three variables injected into a Herdr pane are present:

- `HERDR_ENV=1`
- `HERDR_SOCKET_PATH`
- `HERDR_PANE_ID`

While `better_ask_user` is waiting, the extension emits `herdr:blocked` with the `better_ask_user` label and reports one pending question as the metadata token `ask: "❓1"`. Every completed waiting path clears the blocked state and token. Socket communication uses short, bounded, newline-delimited JSON requests and is best-effort: unavailable or slow Herdr sockets never prevent the prompt from opening or fail the tool.

Outside a complete Herdr environment, behavior is unchanged and no Herdr lifecycle events are emitted.

## Tool name

The registered tool name is:

- `better_ask_user`

## Parameters

| Parameter | Type | Default | Description |
| ----------- | ------ | --------- | ------------- |
| `question` | `string` | *required* | The question to ask the user |
| `context` | `string?` | — | Relevant context summary shown before the question |
| `options` | `{title, description?}[]?` | `[]` | Multiple-choice options. The schema is a flat object shape (no `anyOf`, which some provider proxies strip or reject); plain strings and common alias keys (`label`, `text`, `value`, `name`, `option`) are still accepted at runtime |
| `allowMultiple` | `boolean?` | `false` | Enable multi-select mode |
| `allowFreeform` | `boolean?` | `true` | Add a "Type something" freeform option |
| `allowComment` | `boolean?` | env var or `false` | Expose a user-toggleable extra-context option in the custom UI (`ctrl+g` or the toggle row) and collect an optional comment in fallback dialogs |
| `displayMode` | `"overlay" \| "inline"?` | env var or `"overlay"` | Controls custom UI rendering: `overlay` shows the centered modal (current behavior), `inline` renders without overlay framing |
| `overlayToggleKey` | `string?` | env var or `"alt+o"` | Shortcut for hiding/showing the overlay popup (overlay mode only). Pi-TUI key spec, e.g. `"alt+o"`, `"ctrl+shift+h"`. Pass `"off"` to disable. |
| `commentToggleKey` | `string?` | env var or `"ctrl+g"` | Shortcut for toggling the optional comment/extra-context row when `allowComment: true`. Pass `"off"` to disable. |
| `timeout` | `number?` | — | Auto-dismiss after N ms and return `null` if the prompt times out |

## Example usage shape

```json
{
  "question": "Which option should we use?",
  "context": "We are choosing a deploy target.",
  "options": [
    { "title": "staging" },
    { "title": "production", "description": "Customer-facing" }
  ],
  "allowMultiple": false,
  "allowFreeform": true,
  "allowComment": true,
  "displayMode": "inline"
}
```

`displayMode: "inline"` uses the same interaction logic but skips overlay mode when calling `ctx.ui.custom(...)`. RPC/headless fallback behavior is unchanged.

## Personal preferences via environment variables

Configure your defaults globally by setting these in your shell profile (`~/.zshrc`, `~/.bash_profile`, etc.):

```bash
export PI_BETTER_ASK_USER_DISPLAY_MODE=inline
export PI_BETTER_ASK_USER_ALLOW_COMMENT=true
export PI_BETTER_ASK_USER_OVERLAY_TOGGLE_KEY=alt+h
export PI_BETTER_ASK_USER_COMMENT_TOGGLE_KEY=alt+c
```

Environment variables must be present in the process that launches Pi. If Pi is launched from a desktop app or a different shell, changes in `~/.zshrc` may not be inherited; launch Pi from a terminal where `echo $PI_BETTER_ASK_USER_DISPLAY_MODE` shows the expected value.

### Display mode

Effective order:

1. Per-call `displayMode` parameter (if provided)
2. `PI_BETTER_ASK_USER_DISPLAY_MODE` (if set to `"overlay"` or `"inline"`)
3. Fallback default: `"overlay"`

Unrecognised values are silently ignored and fall back to `"overlay"`.

### Optional comments

Effective order:

1. Per-call `allowComment` parameter (if provided)
2. `PI_BETTER_ASK_USER_ALLOW_COMMENT` (`true`, `1`, `yes`, or `on`; corresponding false values are also accepted)
3. Fallback default: `false`

### Shortcuts

Effective order for both `overlayToggleKey` and `commentToggleKey`:

1. Per-call parameter (if provided)
2. Matching env var (`PI_BETTER_ASK_USER_OVERLAY_TOGGLE_KEY` / `PI_BETTER_ASK_USER_COMMENT_TOGGLE_KEY`)
3. Built-in defaults: `alt+o` and `ctrl+g`

Pass `"off"`, `"none"`, or `"disabled"` (at any level) to disable the shortcut entirely. Invalid specs are silently dropped and the next source is used. Specs follow the Pi-TUI [`KeyId`](https://github.com/earendil-works/pi-mono/blob/main/packages/tui/src/keys.ts) format: `[mod+]...key` where modifiers are `ctrl`, `shift`, `alt`, `super`, in any order, joined by `+` (e.g. `ctrl+g`, `alt+shift+x`, `escape`, `tab`).

## Controls

While a `better_ask_user` prompt is open:

| Key | Action |
| ----- | -------- |
| `alt+o` (configurable via `overlayToggleKey`) | Hide/show the overlay popup so you can read the agent's prior output. Available in `overlay` mode only. The first time you hide it, a notification reminds you which key brings it back. |
| `ctrl+g` (configurable via `commentToggleKey`) | Toggle the optional comment/extra-context row (when `allowComment: true`). |
| `enter` | Confirm the focused option, submit a freeform response, or submit/skip an optional comment. |
| `esc` | Clear the search filter, exit freeform/comment mode, or cancel the prompt. |
| `↑` / `↓`, `ctrl+k` / `ctrl+j` | Navigate options. `ctrl+k` / `ctrl+j` (vim-style) work while typing in searchable prompts without disturbing the filter. |

If you prefer never to see the overlay, set `displayMode: "inline"` per call or `PI_BETTER_ASK_USER_DISPLAY_MODE=inline` globally.

## Known limitations

- **Overlays cannot draw over inline images** ([#8](https://github.com/edlsh/pi-ask-user/issues/8)). Pi-TUI's overlay compositor skips rows occupied by terminal images (Kitty/iTerm2 graphics), so a `better_ask_user` overlay that intersects an image is partially or fully invisible. This must be fixed upstream in pi-tui (`compositeLineAt` returns image rows unchanged). Until then, `displayMode: "inline"` (or `PI_BETTER_ASK_USER_DISPLAY_MODE=inline`) sidesteps the overlay compositor entirely and should keep the prompt visible.

## Result details

All tool results include a structured `details` object for rendering and session state reconstruction:

```typescript
type BetterAskUserResponse =
  | { kind: "selection"; selections: string[]; comment?: string }
  | { kind: "freeform"; text: string };

interface BetterAskUserToolDetails {
  question: string;
  context?: string;
  options: QuestionOption[];
  response: BetterAskUserResponse | null;
  cancelled: boolean;
}
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).
