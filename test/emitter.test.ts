import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SVELTIA_CMS_VERSION,
  SveltiaCms,
  SveltiaCmsError,
} from "../src/index.js";
import {
  buildContext,
  resources,
  temporaryProject,
  validConfig,
  writeConfig,
} from "./helpers.js";

const roots: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

async function projectWithConfig(source = validConfig): Promise<string> {
  const root = await temporaryProject();
  roots.push(root);
  await writeConfig(root, source);
  vi.spyOn(process, "cwd").mockReturnValue(root);
  return root;
}

describe("Quartz emitter", () => {
  it("exports the pinned default and emits both files in deterministic order", async () => {
    const root = await projectWithConfig();
    const plugin = SveltiaCms({
      configFile: "sveltia.config.yml",
      repository: "owner/repo",
    });
    const emitted = await plugin.emit(buildContext(), [], resources);

    expect(DEFAULT_SVELTIA_CMS_VERSION).toBe("0.172.2");
    expect(emitted).toEqual([
      path.join("public", "admin", "index.html"),
      path.join("public", "admin", "config.yml"),
    ]);
    await expect(
      fs.readFile(path.join(root, "public/admin/config.yml"), "utf8"),
    ).resolves.toContain("repo: owner/repo");
    await expect(
      fs.readFile(path.join(root, "public/admin/index.html"), "utf8"),
    ).resolves.toContain(
      "https://unpkg.com/@sveltia/cms@0.172.2/dist/sveltia-cms.js",
    );
  });

  it("emits a normalized nested route", async () => {
    const root = await projectWithConfig(
      validConfig.replace("__GITHUB_REPOSITORY__", "owner/repo"),
    );
    const plugin = SveltiaCms({
      configFile: "sveltia.config.yml",
      route: "internal/editor///",
    });
    const emitted = await plugin.emit(buildContext("site"), [], resources);
    expect(emitted).toEqual([
      path.join("site", "internal/editor", "index.html"),
      path.join("site", "internal/editor", "config.yml"),
    ]);
    await expect(
      fs.stat(path.join(root, "site/internal/editor/index.html")),
    ).resolves.toBeDefined();
  });

  it("uses the environment fallback", async () => {
    const root = await projectWithConfig();
    vi.stubEnv("GITHUB_REPOSITORY", "environment/repo");
    const plugin = SveltiaCms({ configFile: "sveltia.config.yml" });
    await plugin.emit(buildContext(), [], resources);
    await expect(
      fs.readFile(path.join(root, "public/admin/config.yml"), "utf8"),
    ).resolves.toContain("environment/repo");
    vi.unstubAllEnvs();
  });

  it("writes nothing when any preparation step fails", async () => {
    const root = await projectWithConfig("backend: [invalid\n");
    const plugin = SveltiaCms({
      configFile: "sveltia.config.yml",
      repository: "owner/repo",
    });
    await expect(
      plugin.emit(buildContext(), [], resources),
    ).rejects.toBeInstanceOf(SveltiaCmsError);
    await expect(fs.stat(path.join(root, "public"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects a symlink in the output route without following it", async () => {
    const root = await projectWithConfig(
      validConfig.replace("__GITHUB_REPOSITORY__", "owner/repo"),
    );
    const outside = await fs.mkdtemp(
      path.join(os.tmpdir(), "quartz-sveltia-output-"),
    );
    roots.push(outside);
    await fs.mkdir(path.join(root, "public"));
    await fs.symlink(outside, path.join(root, "public/admin"));
    const plugin = SveltiaCms({ configFile: "sveltia.config.yml" });
    await expect(plugin.emit(buildContext(), [], resources)).rejects.toThrow(
      /UNSAFE_OUTPUT_PATH/,
    );
    await expect(fs.readdir(outside)).resolves.toEqual([]);
  });

  it("rejects a symlink output root", async () => {
    const root = await projectWithConfig(
      validConfig.replace("__GITHUB_REPOSITORY__", "owner/repo"),
    );
    const outside = await fs.mkdtemp(
      path.join(os.tmpdir(), "quartz-sveltia-root-"),
    );
    roots.push(outside);
    await fs.symlink(outside, path.join(root, "public"));
    const plugin = SveltiaCms({ configFile: "sveltia.config.yml" });
    await expect(plugin.emit(buildContext(), [], resources)).rejects.toThrow(
      /UNSAFE_OUTPUT_PATH/,
    );
    await expect(fs.readdir(outside)).resolves.toEqual([]);
  });

  it("rejects a symlink in a relative output parent", async () => {
    const root = await projectWithConfig(
      validConfig.replace("__GITHUB_REPOSITORY__", "owner/repo"),
    );
    const outside = await fs.mkdtemp(
      path.join(os.tmpdir(), "quartz-sveltia-parent-"),
    );
    roots.push(outside);
    await fs.symlink(outside, path.join(root, "linked"));
    const plugin = SveltiaCms({ configFile: "sveltia.config.yml" });
    await expect(
      plugin.emit(buildContext("linked/public"), [], resources),
    ).rejects.toThrow(/UNSAFE_OUTPUT_PATH/);
    await expect(fs.readdir(outside)).resolves.toEqual([]);
  });

  it("replaces existing regular artifacts", async () => {
    const root = await projectWithConfig(
      validConfig.replace("__GITHUB_REPOSITORY__", "owner/repo"),
    );
    await fs.mkdir(path.join(root, "public/admin"), { recursive: true });
    await fs.writeFile(path.join(root, "public/admin/index.html"), "old");
    await fs.writeFile(path.join(root, "public/admin/config.yml"), "old");
    const plugin = SveltiaCms({
      configFile: "sveltia.config.yml",
      title: "New title",
    });
    await plugin.emit(buildContext(), [], resources);
    await expect(
      fs.readFile(path.join(root, "public/admin/index.html"), "utf8"),
    ).resolves.toContain("<title>New title</title>");
    expect((await fs.readdir(path.join(root, "public/admin"))).sort()).toEqual([
      "config.yml",
      "index.html",
    ]);
  });

  it("partialEmit reruns the complete pipeline", async () => {
    const root = await projectWithConfig(
      validConfig.replace("__GITHUB_REPOSITORY__", "first/repo"),
    );
    const plugin = SveltiaCms({ configFile: "sveltia.config.yml" });
    expect(plugin.partialEmit).toBeDefined();
    await plugin.emit(buildContext(), [], resources);
    await writeConfig(
      root,
      validConfig.replace("__GITHUB_REPOSITORY__", "second/repo"),
    );
    const emitted = await plugin.partialEmit!(
      buildContext(),
      [],
      resources,
      [],
    );
    expect(emitted).toEqual([
      path.join("public", "admin", "index.html"),
      path.join("public", "admin", "config.yml"),
    ]);
    await expect(
      fs.readFile(path.join(root, "public/admin/config.yml"), "utf8"),
    ).resolves.toContain("second/repo");
  });

  it("keeps errors redaction-safe", async () => {
    await projectWithConfig();
    const secret = ["gh", "p_", "abcdefghijklmnopqrstuvwxyz0123456789"].join(
      "",
    );
    vi.stubEnv("GITHUB_REPOSITORY", secret);
    const plugin = SveltiaCms({ configFile: "sveltia.config.yml" });
    try {
      await plugin.emit(buildContext(), [], resources);
      throw new Error("expected emission to fail");
    } catch (error) {
      expect(String(error)).not.toContain(secret);
      expect(String(error)).toContain("INVALID_REPOSITORY");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
