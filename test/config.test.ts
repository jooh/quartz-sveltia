import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isValidGitHubRepository,
  prepareConfig,
  readConfigFile,
  substituteRepository,
  validateConfig,
} from "../src/config.js";
import { resolveOptions } from "../src/options.js";
import { temporaryProject, validConfig, writeConfig } from "./helpers.js";

const roots: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

function options(overrides: Record<string, unknown> = {}) {
  return resolveOptions({ configFile: "sveltia.config.yml", ...overrides });
}

describe("configuration input", () => {
  it("reads a contained regular file", async () => {
    const root = await temporaryProject();
    roots.push(root);
    await writeConfig(root);
    await expect(readConfigFile("sveltia.config.yml", root)).resolves.toBe(
      validConfig,
    );
  });

  it.each([
    "/etc/passwd",
    "file:///tmp/config.yml",
    "https://example.test/config.yml",
    "C:\\cms.yml",
  ])("rejects absolute or URL-like config path %j", async (configFile) => {
    const root = await temporaryProject();
    roots.push(root);
    await expect(readConfigFile(configFile, root)).rejects.toThrow(
      /INVALID_CONFIG_PATH/,
    );
  });

  it("rejects lexical traversal outside the project", async () => {
    const root = await temporaryProject();
    roots.push(root);
    await expect(readConfigFile("../outside.yml", root)).rejects.toThrow(
      /INVALID_CONFIG_PATH/,
    );
  });

  it("rejects a symlink escape", async () => {
    const root = await temporaryProject();
    const outside = await fs.mkdtemp(
      path.join(os.tmpdir(), "quartz-sveltia-outside-"),
    );
    roots.push(root, outside);
    await fs.writeFile(path.join(outside, "config.yml"), validConfig);
    await fs.symlink(
      path.join(outside, "config.yml"),
      path.join(root, "sveltia.config.yml"),
    );
    await expect(readConfigFile("sveltia.config.yml", root)).rejects.toThrow(
      /INVALID_CONFIG_PATH/,
    );
  });

  it("distinguishes missing, directory, and empty paths", async () => {
    const root = await temporaryProject();
    roots.push(root);
    await expect(readConfigFile("missing.yml", root)).rejects.toThrow(
      /CONFIG_MISSING/,
    );
    await fs.mkdir(path.join(root, "directory.yml"));
    await expect(readConfigFile("directory.yml", root)).rejects.toThrow(
      /CONFIG_NOT_FILE/,
    );
    await fs.writeFile(path.join(root, "empty.yml"), " \n");
    await expect(readConfigFile("empty.yml", root)).rejects.toThrow(
      /CONFIG_EMPTY/,
    );
  });
});

describe("repository resolution", () => {
  it("uses explicit repository before the environment", () => {
    const result = substituteRepository(
      validConfig,
      options({ repository: "explicit/repo" }),
      {
        GITHUB_REPOSITORY: "environment/repo",
      },
    );
    expect(result).toContain("repo: explicit/repo");
  });

  it("uses the configured environment fallback", () => {
    const result = substituteRepository(validConfig, options(), {
      GITHUB_REPOSITORY: "environment/repo",
    });
    expect(result).toContain("repo: environment/repo");
  });

  it("does not read the environment when no placeholder occurs", () => {
    const source = validConfig.replace("__GITHUB_REPOSITORY__", "literal/repo");
    const environment = new Proxy<Record<string, string>>(
      {},
      {
        get: () => {
          throw new Error("environment must not be read");
        },
      },
    );
    expect(
      substituteRepository(
        source,
        options({ repository: "ignored/repo" }),
        environment,
      ),
    ).toBe(source);
  });

  it("preserves a literal backend.repo even when repository inputs exist", () => {
    const source = validConfig.replace("__GITHUB_REPOSITORY__", "literal/repo");
    expect(
      substituteRepository(source, options({ repository: "explicit/repo" }), {
        GITHUB_REPOSITORY: "environment/repo",
      }),
    ).toBe(source);
  });

  it("fails with all supported remedies when resolution is unavailable", () => {
    expect(() => substituteRepository(validConfig, options(), {})).toThrow(
      /option `repository`.*GITHUB_REPOSITORY.*literal `backend\.repo`/,
    );
  });

  it("replaces exact placeholder text while preserving formatting and expressions", () => {
    const source = `# keep this comment\nbackend:\n  name: github\n  repo: "__REPO__" # keep spacing\npublish_mode: "${"${UNCHANGED}"}"\ncollections:\n  - name: pages\n    folder: content\n`;
    const result = substituteRepository(
      source,
      options({ repository: "owner/repo", repositoryPlaceholder: "__REPO__" }),
      {},
    );
    expect(result).toBe(
      `# keep this comment\nbackend:\n  name: github\n  repo: "owner/repo" # keep spacing\npublish_mode: "${"${UNCHANGED}"}"\ncollections:\n  - name: pages\n    folder: content\n`,
    );
  });

  it.each(["owner/repo", "a/b.c", "owner-name/repo_name"])(
    "accepts repository %j",
    (repo) => {
      expect(isValidGitHubRepository(repo)).toBe(true);
    },
  );

  it.each([
    "owner",
    "/repo",
    "owner/",
    "owner/repo/extra",
    "-owner/repo",
    "owner/..",
  ])("rejects repository %j", (repo) =>
    expect(isValidGitHubRepository(repo)).toBe(false),
  );
});

describe("YAML and CMS schema validation", () => {
  it("accepts folder and file collections", () => {
    const source = `backend:\n  name: github\n  repo: owner/repo\ncollections:\n  - name: pages\n    folder: content\n  - name: settings\n    files:\n      - name: site\n        file: data/site.yml\n`;
    expect(() => validateConfig(source, "__PLACEHOLDER__")).not.toThrow();
  });

  it.each([
    "[]",
    "backend: github\ncollections: []\n",
    "backend:\n  name: ''\ncollections:\n  - name: pages\n    folder: content\n",
    "backend:\n  name: github\n  repo: invalid\ncollections:\n  - name: pages\n    folder: content\n",
    "backend:\n  name: github\n  repo: owner/repo\ncollections: []\n",
    "backend:\n  name: github\n  repo: owner/repo\ncollections:\n  - folder: content\n",
    "backend:\n  name: github\n  repo: owner/repo\ncollections:\n  - name: pages\n",
    "backend:\n  name: github\n  repo: owner/repo\ncollections:\n  - name: pages\n    folder: content\n    files:\n      - name: page\n        file: content/page.md\n",
    "backend:\n  name: github\n  repo: owner/repo\ncollections:\n  - name: pages\n    files: []\n",
    "backend:\n  name: github\n  repo: owner/repo\ncollections:\n  - name: pages\n    files:\n      - name: page\n",
  ])("rejects unusable configuration", (source) => {
    expect(() => validateConfig(source, "__PLACEHOLDER__")).toThrow(
      /INVALID_CONFIG|INVALID_REPOSITORY/,
    );
  });

  it("rejects invalid YAML without echoing source content", () => {
    const marker = "sensitive-marker";
    let caught: unknown;
    try {
      validateConfig(`backend: [${marker}\n`, "__PLACEHOLDER__");
    } catch (error) {
      caught = error;
    }
    expect(String(caught)).toContain("INVALID_YAML");
    expect(String(caught)).not.toContain(marker);
  });

  it("rejects unresolved placeholders", () => {
    expect(() => validateConfig(validConfig, "__GITHUB_REPOSITORY__")).toThrow(
      /UNRESOLVED_PLACEHOLDER/,
    );
  });

  it("allows ordinary token fields", () => {
    const source = validConfig
      .replace("__GITHUB_REPOSITORY__", "owner/repo")
      .replace("collections:", "token: browser-login\ncollections:");
    expect(() => validateConfig(source, "__PLACEHOLDER__")).not.toThrow();
  });

  it("rejects PAT values and Actions secret expressions without exposing them", () => {
    const pat = ["gh", "p_", "abcdefghijklmnopqrstuvwxyz0123456789"].join("");
    const expression = ["${{ ", "secrets", ".CMS_TOKEN }}"].join("");
    for (const detected of [pat, expression]) {
      const source = validConfig
        .replace("__GITHUB_REPOSITORY__", "owner/repo")
        .replace("collections:", `credential: ${detected}\ncollections:`);
      expect(() => validateConfig(source, "__PLACEHOLDER__")).toThrow(
        /CREDENTIAL_DETECTED/,
      );
      try {
        validateConfig(source, "__PLACEHOLDER__");
      } catch (error) {
        expect(String(error)).not.toContain(detected);
      }
    }
  });

  it("prepares a config without reserializing it", async () => {
    const root = await temporaryProject();
    roots.push(root);
    const source = validConfig.replace(
      "repo: __GITHUB_REPOSITORY__",
      "repo: '__REPO__' # retained",
    );
    await writeConfig(root, source);
    await expect(
      prepareConfig(
        options({
          repositoryPlaceholder: "__REPO__",
          repository: "owner/repo",
        }),
        root,
        {},
      ),
    ).resolves.toBe(source.replace("__REPO__", "owner/repo"));
  });
});
