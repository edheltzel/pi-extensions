import { describe, expect, it } from "vitest";
import type { Theme } from "@earendil-works/pi-coding-agent";

import { pill } from "../src/pill";

const theme = {
  fg: (role: string, text: string) => `${role}:${text}`,
  bold: (text: string) => `*${text}*`,
  inverse: (text: string) => `[${text}]`,
} as unknown as Theme;

describe("pill", () => {
  it("uses a mapped semantic role for known tools", () => {
    expect(pill("write", theme)).toBe("*[accent: write ]*");
    expect(pill("bash", theme)).toBe("*[error: bash ]*");
    expect(pill("read", theme)).toBe("*[success: read ]*");
  });

  it("falls back to dim for unknown tools", () => {
    expect(pill("unknown", theme)).toBe("*[dim: unknown ]*");
  });
});
