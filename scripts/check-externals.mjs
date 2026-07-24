import fs from "node:fs/promises";
import { builtinModules } from "node:module";
import { URL } from "node:url";

const source = await fs.readFile(
  new URL("../dist/index.js", import.meta.url),
  "utf8",
);
const specifiers = new Set();
const patterns = [
  /\bfrom\s+["']([^"']+)["']/gu,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
  /\bimport\s+["']([^"']+)["']/gu,
];

for (const pattern of patterns) {
  for (const match of source.matchAll(pattern)) {
    const specifier = match[1];
    if (specifier !== undefined) specifiers.add(specifier);
  }
}

const unexpected = [...specifiers].filter(
  (specifier) =>
    !specifier.startsWith("node:") &&
    !builtinModules.includes(specifier) &&
    !specifier.startsWith(".") &&
    !specifier.startsWith("/"),
);
if (unexpected.length > 0) {
  throw new Error(
    `Unexpected runtime externals: ${unexpected.sort().join(", ")}`,
  );
}
