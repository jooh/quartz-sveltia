import { fail } from "./errors.js";

type ScanLocation = "resolved YAML" | "rendered HTML";

const classicPrefix = ["gh", "p|gho|ghu|ghs|ghr"].join("");
const fineGrainedPrefix = ["github", "_pat"].join("");
const personalAccessTokenPattern = new RegExp(
  `(?:${classicPrefix})_[A-Za-z0-9]{8,}|${fineGrainedPrefix}_[A-Za-z0-9_]{8,}`,
  "iu",
);
const actionsSecretExpressionPattern = new RegExp(
  ["\\$\\{\\{\\s*", "secrets", "\\s*\\."].join(""),
  "iu",
);

export function scanForCredentials(text: string, location: ScanLocation): void {
  if (personalAccessTokenPattern.test(text)) {
    fail(
      "CREDENTIAL_DETECTED",
      `A GitHub personal access token was detected in ${location}.`,
    );
  }
  if (actionsSecretExpressionPattern.test(text)) {
    fail(
      "CREDENTIAL_DETECTED",
      `A GitHub Actions secret expression was detected in ${location}.`,
    );
  }
}
