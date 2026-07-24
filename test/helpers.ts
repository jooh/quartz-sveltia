import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BuildCtx, StaticResources } from "@quartz-community/types";

export const validConfig = `backend:
  name: github
  repo: __GITHUB_REPOSITORY__
collections:
  - name: pages
    label: Pages
    folder: content
    create: true
    fields:
      - { name: title, label: Title, widget: string }
      - { name: body, label: Body, widget: markdown }
`;

export async function temporaryProject(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "quartz-sveltia-test-"));
}

export async function writeConfig(
  root: string,
  source = validConfig,
): Promise<void> {
  await fs.writeFile(path.join(root, "sveltia.config.yml"), source, "utf8");
}

export function buildContext(output = "public"): BuildCtx {
  return {
    buildId: "test",
    argv: {
      directory: "content",
      output,
      verbose: false,
      serve: false,
      watch: false,
      port: 8080,
      wsPort: 3001,
    },
    cfg: { configuration: {} },
    allSlugs: [],
    allFiles: [],
    incremental: false,
  };
}

export const resources: StaticResources = {
  css: [],
  js: [],
  additionalHead: [],
};
