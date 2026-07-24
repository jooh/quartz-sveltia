export const DEFAULT_SVELTIA_CMS_VERSION = "0.172.2" as const;

export const DEFAULT_ROUTE = "admin";
export const DEFAULT_REPOSITORY_ENV = "GITHUB_REPOSITORY";
export const DEFAULT_REPOSITORY_PLACEHOLDER = "__GITHUB_REPOSITORY__";
export const DEFAULT_TITLE = "Sveltia CMS";

export function defaultScriptUrl(version: string): string {
  return `https://unpkg.com/@sveltia/cms@${version}/dist/sveltia-cms.js`;
}
