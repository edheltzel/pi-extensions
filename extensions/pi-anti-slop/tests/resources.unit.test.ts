import { spawnSync } from "node:child_process";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_NAMES = ["anti-slop", "slop-code", "slop-review", "slop-rewrite", "slop-verify"];
const SKILL_PATHS = SKILL_NAMES.map((name) => join(PACKAGE_ROOT, "skills", name, "SKILL.md"));
const ROLE_PATHS = [
  join(PACKAGE_ROOT, "skills/anti-slop/references/agents/slop-grader.md"),
  join(PACKAGE_ROOT, "skills/anti-slop/references/agents/slop-verifier.md"),
];
const SUPPORT_ROOT = join(PACKAGE_ROOT, "skills", "anti-slop");
const SCRIPTS_ROOT = join(SUPPORT_ROOT, "scripts");
const REFERENCES_ROOT = join(SUPPORT_ROOT, "references");
const FIREWALL = [
  "Never emit an authorship verdict",
  "Never hard-fail on a stylistic marker alone",
  "Severity is impact. Confidence is certainty",
  "Never let the model gate its own rewrite",
];
const CLAUDE_ONLY = [
  "when_to_use:",
  "disallowed-tools:",
  "PostToolUse",
  "CLAUDE_PLUGIN_ROOT",
  "tool_input.file_path",
  "WebFetch",
  "\nmodel:",
  "\nmaxTurns:",
  "\ntools:",
  "../anti-slop-brain/scripts/",
];

function splitFrontmatter(source: string): { frontmatter: string; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source);
  if (!match) throw new Error("missing YAML frontmatter");
  return { frontmatter: match[1], body: match[2] };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("Pi skill resources", () => {
  it("loads five standard skills with valid names, descriptions, and licences", async () => {
    for (let index = 0; index < SKILL_PATHS.length; index += 1) {
      const source = await readFile(SKILL_PATHS[index], "utf8");
      const { frontmatter } = splitFrontmatter(source);
      const keys = [...frontmatter.matchAll(/^([a-z0-9-]+):/gm)].map((match) => match[1]);

      expect(keys).toEqual(["name", "description", "license"]);
      expect(frontmatter).toContain(`name: ${SKILL_NAMES[index]}`);
      expect(frontmatter).toMatch(/description:\s*>\n\s+\S/);
      expect(frontmatter).toContain("license: CC-BY-4.0");
    }
  });

  it("removes Claude-only manifests, lifecycle hooks, and agent controls", async () => {
    const sources = await Promise.all(
      [...SKILL_PATHS, ...ROLE_PATHS].map((path) => readFile(path, "utf8")),
    );

    for (const source of sources) {
      for (const token of CLAUDE_ONLY) expect(source).not.toContain(token);
    }
  });

  it("preserves the four-rule firewall in every skill and role packet", async () => {
    const sources = await Promise.all(
      [...SKILL_PATHS, ...ROLE_PATHS].map((path) => readFile(path, "utf8")),
    );

    for (const source of sources) {
      for (const rule of FIREWALL) expect(source).toContain(rule);
    }
  });

  it("resolves every relative markdown reference from the file that names it", async () => {
    for (const path of [...SKILL_PATHS, ...ROLE_PATHS]) {
      const source = await readFile(path, "utf8");
      const references = [
        ...source.matchAll(/(?:`|\]\()((?:\.\.\/|\.\/)[^`)\s]+\.md)(?:`|\))/g),
      ].map((match) => match[1]);

      for (const reference of references) {
        expect(await exists(resolve(dirname(path), reference))).toBe(true);
      }
    }
  });

  it("keeps shared support usable when skills are copied into a harness directory", async () => {
    const destination = await mkdtemp(join(tmpdir(), "pi-anti-slop-skills-"));
    try {
      for (const skillPath of SKILL_PATHS) {
        const sourceDir = dirname(skillPath);
        await cp(sourceDir, join(destination, basename(sourceDir)), { recursive: true });
      }

      for (const skillName of SKILL_NAMES) {
        const installedSkill = join(destination, skillName, "SKILL.md");
        const source = await readFile(installedSkill, "utf8");
        const resources = [
          ...source.matchAll(
            /`((?:\.\.\/|\.\/)?(?:anti-slop\/)?(?:scripts|references)\/[^`\s]+\.(?:py|md))`/g,
          ),
        ].map((match) => match[1]);
        for (const resource of resources) {
          expect(await exists(resolve(dirname(installedSkill), resource))).toBe(true);
        }
      }

      const scanner = spawnSync(
        "python3",
        [join(destination, "anti-slop", "scripts", "scan_residue.py"), "--help"],
        { encoding: "utf8" },
      );
      expect(scanner.status).toBe(0);
    } finally {
      await rm(destination, { recursive: true, force: true });
    }
  });
});

describe("scanners, attribution, and package manifest", () => {
  it("bundles the complete standard-library Layer 0 scanner set", async () => {
    const scripts = [
      "scan_common.py",
      "scan_residue.py",
      "scan_placeholders.py",
      "scan_refs.py",
      "scan_packages.py",
      "lint_voice.py",
      "score_substance.py",
    ];

    for (const script of scripts) expect(await exists(join(SCRIPTS_ROOT, script))).toBe(true);
  });

  it("enumerates TypeScript package imports without matching comments or Node built-ins", async () => {
    const scanner = spawnSync(
      "python3",
      [join(SCRIPTS_ROOT, "scan_packages.py"), "--stdin-kind", "javascript", "--format", "json"],
      {
        encoding: "utf8",
        input: [
          "import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';",
          "import { readFile } from 'node:fs/promises';",
          "// import ignored from 'comment-only';",
          "const example = \"import ignored from 'string-only'\";",
        ].join("\n"),
      },
    );

    const output = JSON.parse(scanner.stdout);
    expect(scanner.status).toBe(1);
    expect(output.inventory.packages).toEqual([
      expect.objectContaining({
        ecosystem: "npm",
        name: "@earendil-works/pi-coding-agent",
        origin: "import-export",
      }),
    ]);
  });

  it("keeps scanner documentation self-contained inside the published package", async () => {
    const scripts = [
      "scan_common.py",
      "lint_voice.py",
      "scan_placeholders.py",
      "scan_refs.py",
      "scan_residue.py",
    ];
    for (const script of scripts) {
      const source = await readFile(join(SCRIPTS_ROOT, script), "utf8");
      expect(source).not.toMatch(/PLAN\.md|THIRD_PARTY_NOTICES\.md|\.research\//);
      expect(source).toMatch(/package (?:README|NOTICE)/);
    }
  });

  it("retains CC BY-SA attribution on every adapted taxonomy reference", async () => {
    const references = [
      "code-markers.md",
      "false-positives.md",
      "markers-tier1.md",
      "markers-tier2.md",
      "markers-tier3.md",
    ];

    for (const reference of references) {
      const source = await readFile(join(REFERENCES_ROOT, reference), "utf8");
      expect(source).toContain("Wikipedia:Signs of AI writing");
      expect(source).toContain("CC BY-SA 4.0");
      expect(source).toContain("retrieved\n2026-07-27");
    }
  });

  it("declares the native extension, skills, and split licence in package metadata", async () => {
    const manifest = JSON.parse(await readFile(join(PACKAGE_ROOT, "package.json"), "utf8"));

    expect(manifest.pi).toEqual({ extensions: ["./src/index.ts"], skills: ["./skills"] });
    expect(manifest.keywords).toContain("pi-package");
    expect(manifest.peerDependencies).toEqual({ "@earendil-works/pi-coding-agent": "*" });
    expect(manifest.license).toBe("Apache-2.0 AND CC-BY-4.0 AND CC-BY-SA-4.0");
    expect(manifest.files).toEqual(
      expect.arrayContaining([
        "src",
        "skills/*/SKILL.md",
        "skills/anti-slop/references/**/*.md",
        "skills/anti-slop/scripts/*.py",
        "LICENSE",
        "LICENSE-CONTENT",
        "NOTICE",
      ]),
    );
  });
});
