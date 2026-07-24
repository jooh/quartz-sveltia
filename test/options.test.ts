import { describe, expect, it } from "vitest";
import {
  DEFAULT_SVELTIA_CMS_VERSION,
  defaultScriptUrl,
} from "../src/constants.js";
import {
  assertSafeRepositoryEnvironmentName,
  normalizeRoute,
  normalizeScriptUrl,
  normalizeVersion,
  resolveOptions,
} from "../src/options.js";

describe("option validation", () => {
  it("applies every documented default", () => {
    expect(resolveOptions({ configFile: "sveltia.config.yml" })).toEqual({
      configFile: "sveltia.config.yml",
      route: "admin",
      cmsVersion: DEFAULT_SVELTIA_CMS_VERSION,
      scriptUrl: defaultScriptUrl(DEFAULT_SVELTIA_CMS_VERSION),
      repository: undefined,
      repositoryEnv: "GITHUB_REPOSITORY",
      repositoryPlaceholder: "__GITHUB_REPOSITORY__",
      title: "Sveltia CMS",
    });
  });

  it("normalizes trailing route slashes and accepts nested routes", () => {
    expect(normalizeRoute("internal/editor///")).toBe("internal/editor");
  });

  it.each([
    "",
    "/admin",
    "https://example.test/admin",
    "C:\\admin",
    "admin\\nested",
    "admin//nested",
    "admin/./nested",
    "admin/../nested",
    "admin/%2e%2e/nested",
    "admin/%2Fetc",
    "admin/%252e%252e/nested",
    "admin?preview=1",
    "admin#fragment",
    "admin\u0000nested",
    "%",
  ])("rejects unsafe route %j", (route) => {
    expect(() => normalizeRoute(route)).toThrow(
      /quartz-sveltia:INVALID_(?:ROUTE|OPTIONS)/,
    );
  });

  it.each(["0.172", "v0.172.2", "0.172.2-beta.1", "01.2.3", "latest", ""])(
    "rejects non-exact CMS version %j",
    (version) =>
      expect(() => normalizeVersion(version)).toThrow(
        /INVALID_VERSION|INVALID_OPTIONS/,
      ),
  );

  it("constructs a versioned default URL", () => {
    const options = resolveOptions({
      configFile: "cms.yml",
      cmsVersion: "1.2.3",
    });
    expect(options.scriptUrl).toBe(
      "https://unpkg.com/@sveltia/cms@1.2.3/dist/sveltia-cms.js",
    );
  });

  it.each([
    "http://example.test/cms.js",
    "//example.test/cms.js",
    "javascript:alert(1)",
    "https://user:password@example.test/cms.js",
    "not a url",
  ])("rejects unsafe script URL %j", (url) => {
    expect(() => normalizeScriptUrl(url)).toThrow(/INVALID_SCRIPT_URL/);
  });

  it("accepts a credential-free HTTPS custom script", () => {
    expect(
      normalizeScriptUrl("https://cdn.example.test/cms.js?channel=stable"),
    ).toBe("https://cdn.example.test/cms.js?channel=stable");
  });

  it.each([
    "GITHUB_TOKEN",
    "CMS_SECRET",
    "repository_password",
    "AUTH",
    "DEPLOY_KEY",
  ])("refuses credential-like repository environment variable %j", (name) =>
    expect(() => assertSafeRepositoryEnvironmentName(name)).toThrow(
      /UNSAFE_ENVIRONMENT/,
    ),
  );

  it("requires configFile at emission-time normalization", () => {
    expect(() => resolveOptions(undefined)).toThrow(/required `configFile`/);
    expect(() => resolveOptions({} as never)).toThrow(/configFile/);
  });
});
