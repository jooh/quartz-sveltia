import { describe, expect, it } from "vitest";
import { renderHtml } from "../src/html.js";

describe("HTML rendering", () => {
  it("renders deterministic standards-compliant classic-script HTML", () => {
    const html = renderHtml(
      "Sveltia CMS",
      "https://example.test/sveltia-cms.js",
    );
    expect(html).toBe(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Sveltia CMS</title>
  </head>
  <body>
    <script src="https://example.test/sveltia-cms.js"></script>
  </body>
</html>
`);
    expect(html).not.toContain('type="module"');
    expect(html).not.toContain("config.yml");
  });

  it("escapes title and URL attributes", () => {
    const html = renderHtml(
      '<CMS> & "edit"',
      "https://example.test/cms.js?a=1&b=2",
    );
    expect(html).toContain("&lt;CMS&gt; &amp; &quot;edit&quot;");
    expect(html).toContain("a=1&amp;b=2");
  });

  it("scans rendered HTML for credential material", () => {
    const token = ["github", "_pat_", "abcdefghijklmnopqrstuvwxyz"].join("");
    expect(() => renderHtml(token, "https://example.test/cms.js")).toThrow(
      /CREDENTIAL_DETECTED/,
    );
  });
});
