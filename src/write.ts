import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { FilePath } from "@quartz-community/types";
import { fail } from "./errors.js";

function isContained(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}

async function lstatIfPresent(target: string) {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return undefined;
    fail(
      "UNSAFE_OUTPUT_PATH",
      "The output route could not be inspected.",
      error,
    );
  }
}

async function assertDirectoryWithoutSymlink(
  target: string,
  label: string,
): Promise<void> {
  const stats = await lstatIfPresent(target);
  if (stats === undefined) return;
  if (stats.isSymbolicLink()) {
    fail("UNSAFE_OUTPUT_PATH", `The ${label} cannot be a symbolic link.`);
  }
  if (!stats.isDirectory()) {
    fail("UNSAFE_OUTPUT_PATH", `The ${label} must be a directory.`);
  }
}

async function assertOutputChain(
  cwd: string,
  outputRoot: string,
): Promise<void> {
  if (!isContained(cwd, outputRoot)) return;
  const relative = path.relative(cwd, outputRoot);
  let current = cwd;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    await assertDirectoryWithoutSymlink(
      current,
      "Quartz output path component",
    );
  }
}

async function assertSafeRoute(
  outputRoot: string,
  route: string,
): Promise<string> {
  const routeDirectory = path.resolve(outputRoot, ...route.split("/"));
  if (
    !isContained(outputRoot, routeDirectory) ||
    routeDirectory === outputRoot
  ) {
    fail(
      "INVALID_OUTPUT_PATH",
      "The output route must stay within the Quartz output directory.",
    );
  }

  await assertDirectoryWithoutSymlink(outputRoot, "Quartz output path");
  let current = outputRoot;
  for (const segment of route.split("/")) {
    current = path.join(current, segment);
    await assertDirectoryWithoutSymlink(current, "Sveltia CMS output route");
  }
  return routeDirectory;
}

async function assertSafeDestination(target: string): Promise<void> {
  const stats = await lstatIfPresent(target);
  if (stats?.isSymbolicLink()) {
    fail(
      "UNSAFE_OUTPUT_PATH",
      "A Sveltia CMS output file cannot be a symbolic link.",
    );
  }
  if (stats !== undefined && !stats.isFile()) {
    fail(
      "UNSAFE_OUTPUT_PATH",
      "A Sveltia CMS output file destination is not a regular file.",
    );
  }
}

interface StagedArtifact {
  destination: string;
  staged: string;
  backup: string;
  hadOriginal: boolean;
  installed: boolean;
}

async function publishArtifacts(artifacts: StagedArtifact[]): Promise<void> {
  try {
    // Move the previous pair aside before installing either staged artifact.
    // This lets a failure during either install restore the complete old state.
    for (const artifact of artifacts) {
      await assertSafeDestination(artifact.destination);
      if ((await lstatIfPresent(artifact.destination)) !== undefined) {
        await fs.rename(artifact.destination, artifact.backup);
        artifact.hadOriginal = true;
      }
    }

    for (const artifact of artifacts) {
      await fs.rename(artifact.staged, artifact.destination);
      artifact.installed = true;
    }
  } catch (error) {
    const rollbackFailures: unknown[] = [];

    for (const artifact of [...artifacts].reverse()) {
      if (!artifact.installed) continue;
      try {
        await fs.rm(artifact.destination, { force: true });
      } catch (rollbackError) {
        rollbackFailures.push(rollbackError);
      }
    }

    for (const artifact of [...artifacts].reverse()) {
      if (!artifact.hadOriginal) continue;
      try {
        await fs.rename(artifact.backup, artifact.destination);
      } catch (rollbackError) {
        rollbackFailures.push(rollbackError);
      }
    }

    if (rollbackFailures.length > 0) {
      fail(
        "WRITE_FAILED",
        "The Sveltia CMS files could not be published and the previous output could not be fully restored.",
        error,
      );
    }
    fail(
      "WRITE_FAILED",
      "The Sveltia CMS files could not be published; the previous output was restored.",
      error,
    );
  }

  // Publishing succeeded. Backup cleanup is best-effort because the new pair
  // is already complete and removing one backup prevents a safe rollback.
  await Promise.all(
    artifacts.map(async (artifact) =>
      fs.rm(artifact.backup, { force: true }).catch(() => {}),
    ),
  );
}

export async function writeArtifacts(
  output: string,
  route: string,
  html: string,
  config: string,
  cwd = process.cwd(),
): Promise<FilePath[]> {
  if (
    typeof output !== "string" ||
    output.trim().length === 0 ||
    /[\u0000]/u.test(output)
  ) {
    fail("INVALID_OUTPUT_PATH", "Quartz provided an invalid output directory.");
  }
  const outputRoot = path.resolve(cwd, output);
  await assertOutputChain(path.resolve(cwd), outputRoot);
  const routeDirectory = await assertSafeRoute(outputRoot, route);

  const indexPath = path.join(routeDirectory, "index.html");
  const configPath = path.join(routeDirectory, "config.yml");
  await assertSafeDestination(indexPath);
  await assertSafeDestination(configPath);

  // This is the first filesystem mutation in the emission pipeline.
  try {
    await fs.mkdir(routeDirectory, { recursive: true });
    await assertSafeRoute(outputRoot, route);
  } catch (error) {
    if (error instanceof Error && error.name === "SveltiaCmsError") throw error;
    fail(
      "WRITE_FAILED",
      "The Sveltia CMS output directory could not be created.",
      error,
    );
  }

  const nonce = `${process.pid}-${randomBytes(8).toString("hex")}`;
  const indexTemp = path.join(routeDirectory, `.index.html.${nonce}.tmp`);
  const configTemp = path.join(routeDirectory, `.config.yml.${nonce}.tmp`);
  const temporaryFiles = [indexTemp, configTemp];
  const artifacts: StagedArtifact[] = [
    {
      destination: indexPath,
      staged: indexTemp,
      backup: path.join(routeDirectory, `.index.html.${nonce}.backup`),
      hadOriginal: false,
      installed: false,
    },
    {
      destination: configPath,
      staged: configTemp,
      backup: path.join(routeDirectory, `.config.yml.${nonce}.backup`),
      hadOriginal: false,
      installed: false,
    },
  ];

  try {
    await Promise.all([
      fs.writeFile(indexTemp, html, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o644,
      }),
      fs.writeFile(configTemp, config, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o644,
      }),
    ]);
    await assertSafeDestination(indexPath);
    await assertSafeDestination(configPath);
    await publishArtifacts(artifacts);
  } catch (error) {
    if (error instanceof Error && error.name === "SveltiaCmsError") throw error;
    fail(
      "WRITE_FAILED",
      "The Sveltia CMS files could not be staged for publication.",
      error,
    );
  } finally {
    await Promise.all(
      temporaryFiles.map(async (file) =>
        fs.rm(file, { force: true }).catch(() => {}),
      ),
    );
  }

  return [
    path.join(output, ...route.split("/"), "index.html") as FilePath,
    path.join(output, ...route.split("/"), "config.yml") as FilePath,
  ];
}
