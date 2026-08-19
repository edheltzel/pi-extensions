/**
 * Bordered overlay frame used by the leader-key palette and model pickers.
 *
 * Vendored from tomsej/pi-ext extensions/shared/overlay.ts (MIT) so this
 * workspace does not share a packages/ copy of that repository.
 */

import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

type ThemeLike = {
  fg(role: string, text: string): string;
  bold(text: string): string;
};

export function padToWidth(s: string, len: number): string {
  const vis = visibleWidth(s);
  return s + " ".repeat(Math.max(0, len - vis));
}

export class OverlayFrame {
  readonly width: number;
  readonly innerWidth: number;

  private hLine: string;
  private theme: ThemeLike;

  constructor(terminalWidth: number, theme: ThemeLike, maxWidth = 80) {
    this.width = Math.min(terminalWidth, maxWidth);
    this.innerWidth = this.width - 4;
    this.hLine = "─".repeat(this.width - 2);
    this.theme = theme;
  }

  top(): string {
    return this.theme.fg("border", `╭${this.hLine}╮`);
  }

  separator(): string {
    return this.theme.fg("border", `├${this.hLine}┤`);
  }

  bottom(): string {
    return this.theme.fg("border", `╰${this.hLine}╯`);
  }

  row(content: string): string {
    const th = this.theme;
    return (
      th.fg("border", "│") + " " + padToWidth(content, this.innerWidth) + " " + th.fg("border", "│")
    );
  }

  rowTruncated(content: string): string {
    return this.row(truncateToWidth(content, this.innerWidth));
  }
}
