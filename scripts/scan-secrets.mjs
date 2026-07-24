import { execFileSync } from "node:child_process";
import fs from "node:fs";

const output = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
const files = output.split("\0").filter(Boolean);
const prefixes = [
  ["gh", "p_"].join(""),
  ["gh", "o_"].join(""),
  ["gh", "u_"].join(""),
  ["gh", "s_"].join(""),
  ["gh", "r_"].join(""),
  ["github", "_pat_"].join(""),
];
const actionsExpression = ["${{", " secrets", "."].join("");
const findings = [];

for (const file of files) {
  const buffer = fs.readFileSync(file);
  if (buffer.includes(0)) continue;
  const source = buffer.toString("utf8");
  if (
    prefixes.some((prefix) => source.includes(prefix)) ||
    source.includes(actionsExpression)
  ) {
    findings.push(file);
  }
}

if (findings.length > 0) {
  throw new Error(
    `Credential-like material detected in tracked files: ${findings.join(", ")}`,
  );
}
