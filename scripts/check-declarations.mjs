import fs from "node:fs/promises";
import { pathToFileURL, URL } from "node:url";

const declaration = await fs.readFile(
  new URL("../dist/index.d.ts", import.meta.url),
  "utf8",
);
for (const expected of [
  "SveltiaCms",
  "SveltiaCmsOptions",
  "DEFAULT_SVELTIA_CMS_VERSION",
]) {
  if (!declaration.includes(expected)) {
    throw new Error(`dist/index.d.ts does not expose ${expected}`);
  }
}

const moduleUrl = pathToFileURL(
  new URL("../dist/index.js", import.meta.url).pathname,
).href;
const built = await import(`${moduleUrl}?declaration-check=${Date.now()}`);
if (built.default !== built.SveltiaCms) {
  throw new Error("The default export must be the named SveltiaCms factory");
}
if (built.DEFAULT_SVELTIA_CMS_VERSION !== "0.172.2") {
  throw new Error("The built default CMS version is out of sync");
}
