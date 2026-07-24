import path from "node:path";
import {
  DEFAULT_REPOSITORY_ENV,
  DEFAULT_REPOSITORY_PLACEHOLDER,
  DEFAULT_ROUTE,
  DEFAULT_SVELTIA_CMS_VERSION,
  DEFAULT_TITLE,
  defaultScriptUrl,
} from "./constants.js";
import { fail } from "./errors.js";

export interface SveltiaCmsOptions {
  /** Project-relative path to the Sveltia CMS YAML file. */
  configFile: string;
  /** Output route, relative to Quartz's output directory. @default "admin" */
  route?: string;
  /** Exact Sveltia CMS version used in the default script URL. @default "0.172.2" */
  cmsVersion?: string;
  /** Credential-free HTTPS URL for a classic Sveltia CMS bundle. */
  scriptUrl?: string;
  /** Repository in owner/repository form, used only when the placeholder occurs. */
  repository?: string;
  /** Non-secret environment variable used as the repository fallback. @default "GITHUB_REPOSITORY" */
  repositoryEnv?: string;
  /** Exact text to replace in the configuration. @default "__GITHUB_REPOSITORY__" */
  repositoryPlaceholder?: string;
  /** HTML document title. @default "Sveltia CMS" */
  title?: string;
}

export interface ResolvedOptions {
  configFile: string;
  route: string;
  cmsVersion: string;
  scriptUrl: string;
  repository: string | undefined;
  repositoryEnv: string;
  repositoryPlaceholder: string;
  title: string;
}

const exactVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const environmentNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const credentialEnvironmentNamePattern =
  /(?:^|_)(?:auth|credential|key|pass|passwd|password|pwd|secret|token)(?:_|$)/i;

function nonEmptyString(value: unknown, option: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail("INVALID_OPTIONS", `Option \`${option}\` must be a non-empty string.`);
  }
  return value;
}

export function normalizeRoute(value: unknown): string {
  const input = nonEmptyString(value, "route");
  const route = input.replace(/\/+$/u, "");

  if (
    route.length === 0 ||
    route.startsWith("/") ||
    route.startsWith("\\") ||
    path.posix.isAbsolute(route) ||
    path.win32.isAbsolute(route) ||
    /^[A-Za-z][A-Za-z\d+.-]*:/u.test(route) ||
    route.includes("\\") ||
    /[%?#]/u.test(route) ||
    /[\u0000-\u001f\u007f]/u.test(route)
  ) {
    fail("INVALID_ROUTE", "Option `route` must be a safe relative URL path.");
  }

  const segments = route.split("/");
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    fail(
      "INVALID_ROUTE",
      "Option `route` cannot contain empty, dot, or traversal segments.",
    );
  }

  return route;
}

export function normalizeVersion(value: unknown): string {
  const version = nonEmptyString(value, "cmsVersion");
  if (!exactVersionPattern.test(version)) {
    fail(
      "INVALID_VERSION",
      "Option `cmsVersion` must be an exact semantic version (x.y.z).",
    );
  }
  return version;
}

export function normalizeScriptUrl(value: unknown): string {
  const input = nonEmptyString(value, "scriptUrl");
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch (error) {
    fail(
      "INVALID_SCRIPT_URL",
      "Option `scriptUrl` must be an absolute HTTPS URL.",
      error,
    );
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username.length > 0 ||
    parsed.password.length > 0
  ) {
    fail(
      "INVALID_SCRIPT_URL",
      "Option `scriptUrl` must use HTTPS and cannot contain credentials.",
    );
  }

  return parsed.href;
}

export function assertSafeRepositoryEnvironmentName(value: unknown): string {
  const name = nonEmptyString(value, "repositoryEnv");
  if (!environmentNamePattern.test(name)) {
    fail(
      "INVALID_OPTIONS",
      "Option `repositoryEnv` must be a valid environment variable name.",
    );
  }
  if (credentialEnvironmentNamePattern.test(name)) {
    fail(
      "UNSAFE_ENVIRONMENT_VARIABLE",
      "Option `repositoryEnv` must name repository metadata, not a credential-like variable.",
    );
  }
  return name;
}

export function resolveOptions(
  options: SveltiaCmsOptions | undefined,
): ResolvedOptions {
  if (
    options === undefined ||
    options === null ||
    typeof options !== "object"
  ) {
    fail(
      "INVALID_OPTIONS",
      "The required `configFile` option was not provided.",
    );
  }

  const configFile = nonEmptyString(options.configFile, "configFile");
  const route = normalizeRoute(options.route ?? DEFAULT_ROUTE);
  const cmsVersion = normalizeVersion(
    options.cmsVersion ?? DEFAULT_SVELTIA_CMS_VERSION,
  );
  const scriptUrl = normalizeScriptUrl(
    options.scriptUrl ?? defaultScriptUrl(cmsVersion),
  );
  const repositoryEnv = assertSafeRepositoryEnvironmentName(
    options.repositoryEnv ?? DEFAULT_REPOSITORY_ENV,
  );
  const repositoryPlaceholder = nonEmptyString(
    options.repositoryPlaceholder ?? DEFAULT_REPOSITORY_PLACEHOLDER,
    "repositoryPlaceholder",
  );
  const title = nonEmptyString(options.title ?? DEFAULT_TITLE, "title");

  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(title)) {
    fail(
      "INVALID_OPTIONS",
      "Option `title` cannot contain control characters.",
    );
  }

  if (
    options.repository !== undefined &&
    typeof options.repository !== "string"
  ) {
    fail(
      "INVALID_OPTIONS",
      "Option `repository` must be a string when provided.",
    );
  }

  return {
    configFile,
    route,
    cmsVersion,
    scriptUrl,
    repository: options.repository,
    repositoryEnv,
    repositoryPlaceholder,
    title,
  };
}
