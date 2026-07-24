import fs from "node:fs/promises";
import path from "node:path";
import { isMap, parseDocument } from "yaml";
import type { ResolvedOptions } from "./options.js";
import { fail } from "./errors.js";
import { scanForCredentials } from "./security.js";

type Environment = Readonly<Record<string, string | undefined>>;

function isContained(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function assertSafeConfigSpecifier(configFile: string): void {
  if (
    path.isAbsolute(configFile) ||
    path.win32.isAbsolute(configFile) ||
    configFile.includes("\\") ||
    /^[A-Za-z][A-Za-z\d+.-]*:/u.test(configFile) ||
    configFile.startsWith("//") ||
    /[\u0000-\u001f\u007f]/u.test(configFile)
  ) {
    fail(
      "INVALID_CONFIG_PATH",
      "Option `configFile` must be a project-relative file path.",
    );
  }
}

function filesystemCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}

export async function readConfigFile(
  configFile: string,
  cwd = process.cwd(),
): Promise<string> {
  assertSafeConfigSpecifier(configFile);

  let projectRoot: string;
  try {
    projectRoot = await fs.realpath(cwd);
  } catch (error) {
    fail(
      "CONFIG_UNREADABLE",
      "The consuming project directory could not be resolved.",
      error,
    );
  }

  const lexicalPath = path.resolve(projectRoot, configFile);
  if (!isContained(projectRoot, lexicalPath)) {
    fail(
      "INVALID_CONFIG_PATH",
      "Option `configFile` must stay within the consuming project.",
    );
  }

  let realPath: string;
  try {
    realPath = await fs.realpath(lexicalPath);
  } catch (error) {
    if (filesystemCode(error) === "ENOENT") {
      fail(
        "CONFIG_MISSING",
        "The configured Sveltia CMS file does not exist.",
        error,
      );
    }
    fail(
      "CONFIG_UNREADABLE",
      "The configured Sveltia CMS file could not be resolved.",
      error,
    );
  }

  if (!isContained(projectRoot, realPath)) {
    fail(
      "INVALID_CONFIG_PATH",
      "The configured Sveltia CMS file resolves outside the project.",
    );
  }

  let stats;
  try {
    stats = await fs.stat(realPath);
  } catch (error) {
    fail(
      "CONFIG_UNREADABLE",
      "The configured Sveltia CMS file could not be inspected.",
      error,
    );
  }
  if (!stats.isFile()) {
    fail(
      "CONFIG_NOT_FILE",
      "The configured Sveltia CMS path is not a regular file.",
    );
  }

  let source: string;
  try {
    source = await fs.readFile(realPath, "utf8");
  } catch (error) {
    fail(
      "CONFIG_UNREADABLE",
      "The configured Sveltia CMS file could not be read.",
      error,
    );
  }
  if (source.trim().length === 0) {
    fail("CONFIG_EMPTY", "The configured Sveltia CMS file is empty.");
  }
  return source;
}

const githubOwnerPattern = /^[A-Za-z\d](?:[A-Za-z\d-]{0,37}[A-Za-z\d])?$/u;
const githubRepositoryPattern = /^(?!\.\.?$)[A-Za-z\d_.-]{1,100}$/u;

export function isValidGitHubRepository(value: string): boolean {
  const parts = value.split("/");
  return (
    parts.length === 2 &&
    githubOwnerPattern.test(parts[0] ?? "") &&
    githubRepositoryPattern.test(parts[1] ?? "")
  );
}

function selectRepository(
  options: ResolvedOptions,
  environment: Environment,
): string {
  const explicit = options.repository;
  const candidate = explicit ?? environment[options.repositoryEnv];
  if (candidate === undefined || candidate.trim().length === 0) {
    fail(
      "REPOSITORY_REQUIRED",
      `The repository placeholder requires option \`repository\`, environment variable \`${options.repositoryEnv}\`, or a literal \`backend.repo\`.`,
    );
  }
  if (!isValidGitHubRepository(candidate)) {
    fail(
      "INVALID_REPOSITORY",
      "The resolved repository must use valid `owner/repository` syntax.",
    );
  }
  return candidate;
}

export function substituteRepository(
  source: string,
  options: ResolvedOptions,
  environment: Environment = process.env,
): string {
  if (!source.includes(options.repositoryPlaceholder)) {
    return source;
  }
  const repository = selectRepository(options, environment);
  return source.split(options.repositoryPlaceholder).join(repository);
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    isMap(value)
  ) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateCollection(collection: unknown, index: number): void {
  const record = objectRecord(collection);
  if (record === undefined) {
    fail("INVALID_CONFIG", `Collection at index ${index} must be an object.`);
  }
  if (!nonEmpty(record.name)) {
    fail(
      "INVALID_CONFIG",
      `Collection at index ${index} must have a non-empty \`name\`.`,
    );
  }

  const hasFolder = nonEmpty(record.folder);
  const files = Array.isArray(record.files) ? record.files : undefined;
  const hasFiles = files !== undefined && files.length > 0;
  if (hasFolder === hasFiles) {
    fail(
      "INVALID_CONFIG",
      `Collection at index ${index} must define exactly one usable \`folder\` or non-empty \`files\` array.`,
    );
  }

  if (record.folder !== undefined && !hasFolder) {
    fail(
      "INVALID_CONFIG",
      `Collection at index ${index} has an unusable \`folder\` value.`,
    );
  }
  if (record.files !== undefined && !hasFiles) {
    fail(
      "INVALID_CONFIG",
      `Collection at index ${index} has an unusable \`files\` value.`,
    );
  }
  if (hasFiles && files !== undefined) {
    for (const [fileIndex, file] of files.entries()) {
      const definition = objectRecord(file);
      if (
        definition === undefined ||
        !nonEmpty(definition.name) ||
        !nonEmpty(definition.file)
      ) {
        fail(
          "INVALID_CONFIG",
          `File definition ${fileIndex} in collection at index ${index} must have non-empty \`name\` and \`file\` values.`,
        );
      }
    }
  }
}

export function validateConfig(source: string, placeholder: string): void {
  scanForCredentials(source, "resolved YAML");

  if (source.includes(placeholder)) {
    fail(
      "UNRESOLVED_PLACEHOLDER",
      "The configured repository placeholder remains unresolved.",
    );
  }

  const document = parseDocument(source, {
    prettyErrors: false,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    const firstError = document.errors[0];
    const line = firstError?.linePos?.[0]?.line;
    const suffix = line === undefined ? "" : ` near line ${line}`;
    fail(
      "INVALID_YAML",
      `The Sveltia CMS configuration is not valid YAML${suffix}.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = document.toJS({ maxAliasCount: 100 });
  } catch (error) {
    fail(
      "INVALID_YAML",
      "The Sveltia CMS configuration could not be safely resolved.",
      error,
    );
  }

  const root = objectRecord(parsed);
  if (root === undefined) {
    fail(
      "INVALID_CONFIG",
      "The Sveltia CMS configuration root must be an object.",
    );
  }
  const backend = objectRecord(root.backend);
  if (backend === undefined) {
    fail(
      "INVALID_CONFIG",
      "The Sveltia CMS configuration must contain an object `backend`.",
    );
  }
  if (!nonEmpty(backend.name)) {
    fail(
      "INVALID_CONFIG",
      "The Sveltia CMS `backend.name` must be a non-empty string.",
    );
  }
  if (backend.name === "github") {
    if (!nonEmpty(backend.repo) || !isValidGitHubRepository(backend.repo)) {
      fail(
        "INVALID_REPOSITORY",
        "The GitHub backend requires a valid `owner/repository` value.",
      );
    }
  }

  if (!Array.isArray(root.collections) || root.collections.length === 0) {
    fail(
      "INVALID_CONFIG",
      "The Sveltia CMS configuration requires a non-empty `collections` array.",
    );
  }
  const names = new Set<string>();
  root.collections.forEach((collection, index) => {
    validateCollection(collection, index);
    const name = (collection as Record<string, unknown>).name as string;
    if (names.has(name)) {
      fail("INVALID_CONFIG", "Collection names must be unique.");
    }
    names.add(name);
  });
}

export async function prepareConfig(
  options: ResolvedOptions,
  cwd = process.cwd(),
  environment: Environment = process.env,
): Promise<string> {
  const source = await readConfigFile(options.configFile, cwd);
  const resolved = substituteRepository(source, options, environment);
  validateConfig(resolved, options.repositoryPlaceholder);
  return resolved;
}
