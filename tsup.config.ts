import { defineConfig } from "tsup";

const singletonExternals = [
  "preact",
  "preact/hooks",
  "preact/jsx-runtime",
  "preact/compat",
  "@jackyzha0/quartz",
  "@jackyzha0/quartz/*",
  "vfile",
  "vfile/*",
  "unified",
  "node:*",
];

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "node22",
  splitting: false,
  noExternal: [/.*/],
  external: singletonExternals,
  outDir: "dist",
  // Neutral resolution selects YAML's ESM build; Node built-ins remain external.
  platform: "neutral",
});
