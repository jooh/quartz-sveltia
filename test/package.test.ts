import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { DEFAULT_SVELTIA_CMS_VERSION } from "../src/index.js";

interface PackageMetadata {
  devDependencies: Record<string, string>;
  quartz: {
    name: string;
    category: string;
    quartzVersion: string;
    defaultEnabled: boolean;
    requiresInstall: boolean;
    defaultOptions: { cmsVersion: string };
    configSchema: { required: string[] };
  };
}

describe("package metadata", () => {
  it("keeps every documented CMS version reference synchronized", async () => {
    const packageJson = JSON.parse(
      await fs.readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as PackageMetadata;
    const readme = await fs.readFile(
      new URL("../README.md", import.meta.url),
      "utf8",
    );
    const changelog = await fs.readFile(
      new URL("../CHANGELOG.md", import.meta.url),
      "utf8",
    );

    expect(packageJson.devDependencies["@sveltia/cms"]).toBe(
      DEFAULT_SVELTIA_CMS_VERSION,
    );
    expect(packageJson.quartz.defaultOptions.cmsVersion).toBe(
      DEFAULT_SVELTIA_CMS_VERSION,
    );
    expect(readme).toContain(`\`${DEFAULT_SVELTIA_CMS_VERSION}\``);
    expect(changelog).toContain(`CMS ${DEFAULT_SVELTIA_CMS_VERSION}`);
  });

  it("declares the Quartz 5 emitter manifest and required config", async () => {
    const packageJson = JSON.parse(
      await fs.readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as PackageMetadata;
    expect(packageJson.quartz).toMatchObject({
      name: "sveltia-cms",
      category: "emitter",
      quartzVersion: ">=5.0.0",
      defaultEnabled: false,
      requiresInstall: false,
    });
    expect(packageJson.quartz.configSchema.required).toContain("configFile");
  });
});
