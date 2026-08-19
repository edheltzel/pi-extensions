import { describe, expect, it } from "vitest";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { buildEntries, LeaderKeyOverlay } from "../src/index";
import { OverlayFrame, padToWidth } from "../src/overlay";

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as unknown as Theme;

describe("OverlayFrame", () => {
  it("pads content to a visible width", () => {
    expect(padToWidth("hi", 4)).toBe("hi  ");
    expect(padToWidth("already-long", 4)).toBe("already-long");
  });

  it("renders a bordered frame at the requested width", () => {
    const frame = new OverlayFrame(40, theme);
    const lines = [
      frame.top(),
      frame.row("title"),
      frame.separator(),
      frame.rowTruncated("body"),
      frame.bottom(),
    ];

    expect(lines.every((line) => visibleWidth(line) === 40)).toBe(true);
    expect(lines[0]).toContain("╭");
    expect(lines[1]).toContain("title");
    expect(lines.at(-1)).toContain("╰");
  });
});

describe("LeaderKeyOverlay", () => {
  const entries = buildEntries(
    {} as never,
    async () => {},
    async () => {},
    async () => {},
  );

  it("renders the root palette", () => {
    const overlay = new LeaderKeyOverlay(entries, theme, () => {});
    const lines = overlay.render(80);

    expect(lines.some((line) => line.includes("Leader Key"))).toBe(true);
    expect(lines.some((line) => line.includes("[m]"))).toBe(true);
    expect(lines.some((line) => line.includes("[a]"))).toBe(true);
    expect(lines.every((line) => visibleWidth(line) === 80)).toBe(true);
  });

  it("opens a group on a chord and goes back on escape", () => {
    const overlay = new LeaderKeyOverlay(entries, theme, () => {});
    overlay.handleInput("m");
    const groupLines = overlay.render(80);
    expect(groupLines.some((line) => line.includes("Model"))).toBe(true);
    expect(groupLines.some((line) => line.includes("[s]"))).toBe(true);

    overlay.handleInput("\x1b");
    const rootLines = overlay.render(80);
    expect(rootLines.some((line) => line.includes("Leader Key"))).toBe(true);
  });

  it("runs a direct action from the root", () => {
    let selected: string | undefined;
    const overlay = new LeaderKeyOverlay(entries, theme, (item) => {
      selected = item?.key;
    });
    overlay.handleInput("q");
    expect(selected).toBe("q");
  });
});
