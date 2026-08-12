import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { visibleWidth, type KeybindingsManager, type TUI } from "@earendil-works/pi-tui";
import {
  fitLineToWidth,
  formatModelStatus,
  formatBackgroundAnsi,
  BetterBtwOverlayComponent,
  OVERLAY_MIN_HEIGHT,
  paintRowBackground,
  renderHiddenStatusLine,
  resolveOverlayHeight,
  resolveOverlayMaxHeight,
  resolveOverlayColumn,
  resolveOverlayWidth,
} from "../src/index";

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = require("../package.json") as { version: string };
const TEST_SESSION_CWD = `${process.env.HOME ?? ""}/Developer/Atlas/Config`;
const plainTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as unknown as ExtensionCommandContext["ui"]["theme"];

function createOverlay(
  onHide: () => void = () => {},
  terminal: { columns: number; rows: number } = { columns: 120, rows: 40 },
  backgroundAnsi = "",
): BetterBtwOverlayComponent {
  const tui = {
    terminal,
    requestRender() {},
  } as unknown as TUI;
  const theme = plainTheme;

  return new BetterBtwOverlayComponent(
    tui,
    theme,
    {} as KeybindingsManager,
    TEST_SESSION_CWD,
    () => "gpt-5.6-sol (high)",
    () => backgroundAnsi,
    () => {},
    onHide,
    () => {},
  );
}

describe("BetterBtwOverlayComponent layout", () => {
  it("renders the shared labeled frame at the requested width", () => {
    const lines = createOverlay().render(80);

    expect(lines.every((line) => visibleWidth(line) === 80)).toBe(true);
    expect(lines[0]).toContain("better_btw");
    expect(lines.at(-1)).toContain(`v${PACKAGE_VERSION}`);
  });

  it("uses the Ask-style content hierarchy and bottom help row", () => {
    const lines = createOverlay().render(80);

    expect(lines[1]).toContain("Side conversation");
    expect(lines[2]).toContain("gpt-5.6-sol (high) • throwaway session");
    expect(lines[2]).toContain("~/Developer/Atlas/Config");
    expect(lines.at(-2)).toContain("esc close • up/down scroll • alt+o hide");
  });

  it.each([
    ["legacy escape sequence", "\x1bo"],
    ["Kitty CSI-u sequence", "\x1b[111;3u"],
  ])("hides on alt+o using the %s and leaves backspace to the input", (_label, shortcut) => {
    let hidden = 0;
    const overlay = createOverlay(() => {
      hidden += 1;
    });

    overlay.handleInput("\x7f");
    overlay.handleInput("\x08");
    expect(hidden).toBe(0);

    overlay.handleInput(shortcut);
    expect(hidden).toBe(1);
  });

  it.each([40, 43, 49, 50])("keeps the hidden recovery widget within %d columns", (width) => {
    const line = renderHiddenStatusLine(plainTheme, width);

    expect(visibleWidth(line)).toBeLessThanOrEqual(width);
    expect(line).toContain("alt+o show");
  });

  it("shows the model and thinking level in the top metadata row only", () => {
    const lines = createOverlay().render(80);

    expect(lines[2]).toContain("gpt-5.6-sol (high)");
    expect(lines.slice(3).join("\n")).not.toContain("gpt-5.6-sol");
  });

  it("omits the thinking level only when it is off", () => {
    expect(formatModelStatus("gpt-5.6-sol", "high")).toBe("gpt-5.6-sol (high)");
    expect(formatModelStatus("gpt-5.6-sol", "off")).toBe("gpt-5.6-sol");
  });

  it("clips and pads ANSI content to an exact width", () => {
    const fitted = fitLineToWidth("\x1b[31m123456789\x1b[39m", 6);

    expect(visibleWidth(fitted)).toBe(6);
  });
});

describe("overlay box", () => {
  it.each([120, 80, 40])("resolves the centered 92%% Ask-style width at %d columns", (columns) => {
    const availableWidth = Math.max(1, columns - 2);
    const expectedWidth = Math.min(availableWidth, Math.max(40, Math.floor(columns * 0.92)));
    const column = resolveOverlayColumn(columns);
    const rightMargin = columns - column - resolveOverlayWidth(columns);

    expect(resolveOverlayWidth(columns)).toBe(expectedWidth);
    expect(Math.abs(column - rightMargin)).toBeLessThanOrEqual(1);
    expect(column).toBeGreaterThanOrEqual(1);
    expect(rightMargin).toBeGreaterThanOrEqual(1);
  });

  it.each([120, 80, 40])("renders a frame at the resolved width for %d columns", (columns) => {
    const width = resolveOverlayWidth(columns);
    const lines = createOverlay(() => {}, { columns, rows: 20 }).render(width);

    expect(lines.every((line) => visibleWidth(line) === width)).toBe(true);
  });

  it("never renders past the requested width on narrow terminals", () => {
    for (let width = 1; width <= 40; width++) {
      const lines = createOverlay(() => {}, { columns: width, rows: 20 }).render(width);

      expect(lines.every((line) => visibleWidth(line) === width)).toBe(true);
    }
  });

  it("shows frame labels at the Ask-style minimum widths", () => {
    expect(createOverlay().render(15)[0]).not.toContain("better_btw");
    expect(createOverlay().render(16)[0]).toContain("better_btw");
    expect(createOverlay().render(11).at(-1)).not.toContain(`v${PACKAGE_VERSION}`);
    expect(createOverlay().render(12).at(-1)).toContain(`v${PACKAGE_VERSION}`);
  });

  // Pi composites only the rows that fit the box `overlayOptions` reserves and
  // silently slices the rest, so a frame taller than the cap loses its bottom
  // border and the session shows through where the frame should be.
  const SIZES = [
    { columns: 120, rows: 40 },
    { columns: 120, rows: 36 },
    { columns: 100, rows: 30 },
    { columns: 100, rows: 24 },
    { columns: 80, rows: 20 },
    { columns: 80, rows: 18 },
  ];

  for (const size of SIZES) {
    it(`fits the reserved box at ${size.columns}x${size.rows}`, () => {
      const width = Math.floor(size.columns * 0.9);
      const lines = createOverlay(() => {}, size).render(width);

      expect(lines.length).toBeLessThanOrEqual(resolveOverlayMaxHeight(size.rows));
      expect(lines.length).toBe(resolveOverlayHeight(size.rows));
      expect(lines.every((line) => visibleWidth(line) === width)).toBe(true);
      expect(lines.at(-1)).toContain(`v${PACKAGE_VERSION}`);
    });

    it(`fits the reserved box at ${size.columns}x${size.rows} with a long input`, () => {
      const width = Math.floor(size.columns * 0.9);
      const overlay = createOverlay(() => {}, size);
      for (const char of "x".repeat(width * 3)) overlay.handleInput(char);
      const lines = overlay.render(width);

      expect(lines.length).toBeLessThanOrEqual(resolveOverlayMaxHeight(size.rows));
      expect(lines.at(-1)).toContain(`v${PACKAGE_VERSION}`);
    });
  }

  it("never asks for more rows than Pi reserves", () => {
    for (let rows = 8; rows <= 200; rows++) {
      expect(resolveOverlayHeight(rows)).toBeLessThanOrEqual(resolveOverlayMaxHeight(rows));
    }
  });

  it("draws a whole frame at every terminal height that can hold one", () => {
    for (let rows = 8; rows <= 200; rows++) {
      if (resolveOverlayMaxHeight(rows) < OVERLAY_MIN_HEIGHT) continue;
      const lines = createOverlay(() => {}, { columns: 100, rows }).render(90);

      expect(lines.length).toBe(resolveOverlayHeight(rows));
      expect(lines[0]).toContain("better_btw");
      expect(lines.at(-1)).toContain(`v${PACKAGE_VERSION}`);
    }
  });
});

/**
 * Walks a rendered row the way a terminal would, tracking whether an explicit
 * background is in effect, and reports the visible columns still sitting on the
 * terminal's DEFAULT background. Those are the cells a translucent or blurred
 * terminal composites its backdrop through - the bleed-through artifacts.
 */
function unpaintedColumns(row: string): number {
  let backgroundActive = false;
  let unpainted = 0;
  let i = 0;

  while (i < row.length) {
    if (row[i] === "\x1b") {
      const sgr = /^\x1b\[([0-9;]*)m/.exec(row.slice(i));
      if (sgr) {
        const params = sgr[1] === "" ? ["0"] : sgr[1].split(";");
        for (let p = 0; p < params.length; p++) {
          const code = params[p] === "" ? "0" : params[p];
          if (code === "48") {
            backgroundActive = true;
            p += params[p + 1] === "5" ? 2 : 4; // 48;5;n or 48;2;r;g;b
          } else if (code === "38") {
            p += params[p + 1] === "5" ? 2 : 4;
          } else if (code === "0" || code === "49") {
            backgroundActive = false;
          }
        }
        i += sgr[0].length;
        continue;
      }
      const osc = /^\x1b\][^\x07]*\x07/.exec(row.slice(i));
      if (osc) {
        i += osc[0].length;
        continue;
      }
      const csi = /^\x1b\[[0-9;?]*[A-Za-z]/.exec(row.slice(i));
      i += csi ? csi[0].length : 1;
      continue;
    }

    if (!backgroundActive) unpainted += 1;
    i += 1;
  }

  return unpainted;
}

describe("overlay opacity", () => {
  // Terminals composite their backdrop behind cells left on the default
  // background, so an overlay that only sets foreground colours shows the
  // desktop through its body when transparency or blur is on. Clipping and
  // padding rows to the exact width cannot fix that - only an explicit
  // background makes the cells opaque.
  const BACKGROUND = "\x1b[48;2;24;26;41m";

  function createStyledOverlay(backgroundAnsi: string): BetterBtwOverlayComponent {
    const tui = {
      terminal: { columns: 120, rows: 40 },
      requestRender() {},
    } as unknown as TUI;
    // Emits real ANSI, including the full reset that markdown and message
    // components produce, which is what silently punched the background back out.
    const theme = {
      fg: (_color: string, text: string) => `\x1b[38;5;110m${text}\x1b[0m`,
      bold: (text: string) => `\x1b[1m${text}\x1b[22m`,
    } as unknown as ExtensionCommandContext["ui"]["theme"];

    return new BetterBtwOverlayComponent(
      tui,
      theme,
      {} as KeybindingsManager,
      "/Users/ed/Developer/Atlas/Config",
      () => "gpt-5.6-sol (high)",
      () => backgroundAnsi,
      () => {},
      () => {},
      () => {},
    );
  }

  it("leaves no cell on the default background", () => {
    const lines = createStyledOverlay(BACKGROUND).render(108);

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(unpaintedColumns(line)).toBe(0);
    }
  });

  it("keeps every row at its exact width once painted", () => {
    const lines = createStyledOverlay(BACKGROUND).render(108);

    expect(lines.every((line) => visibleWidth(line) === 108)).toBe(true);
  });

  it("reports unpainted cells when no background is supplied", () => {
    // Negative control: without this the opacity assertion could never fail.
    const lines = createStyledOverlay("").render(108);

    expect(lines.some((line) => unpaintedColumns(line) > 0)).toBe(true);
  });

  it("re-asserts the background after a nested reset", () => {
    const painted = paintRowBackground(`a\x1b[0mb\x1b[49mc`, BACKGROUND);

    expect(unpaintedColumns(painted)).toBe(0);
    expect(visibleWidth(painted)).toBe(3);
  });

  it("does not touch rows when the terminal background is unknown", () => {
    expect(paintRowBackground("plain", "")).toBe("plain");
  });

  it("formats a truecolor background from an rgb triplet", () => {
    expect(formatBackgroundAnsi({ r: 24, g: 26, b: 41 })).toBe("\x1b[48;2;24;26;41m");
  });
});
