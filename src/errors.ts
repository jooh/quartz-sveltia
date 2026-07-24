export type SveltiaCmsErrorCode =
  | "INVALID_OPTIONS"
  | "INVALID_ROUTE"
  | "INVALID_VERSION"
  | "INVALID_SCRIPT_URL"
  | "INVALID_CONFIG_PATH"
  | "CONFIG_MISSING"
  | "CONFIG_UNREADABLE"
  | "CONFIG_NOT_FILE"
  | "CONFIG_EMPTY"
  | "REPOSITORY_REQUIRED"
  | "INVALID_REPOSITORY"
  | "UNSAFE_ENVIRONMENT_VARIABLE"
  | "INVALID_YAML"
  | "INVALID_CONFIG"
  | "UNRESOLVED_PLACEHOLDER"
  | "CREDENTIAL_DETECTED"
  | "INVALID_OUTPUT_PATH"
  | "UNSAFE_OUTPUT_PATH"
  | "WRITE_FAILED";

export class SveltiaCmsError extends Error {
  readonly code: SveltiaCmsErrorCode;

  constructor(
    code: SveltiaCmsErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`[quartz-sveltia:${code}] ${message}`, options);
    this.name = "SveltiaCmsError";
    this.code = code;
  }
}

export function fail(
  code: SveltiaCmsErrorCode,
  message: string,
  _cause?: unknown,
): never {
  // Do not attach upstream errors: parser, URL, and filesystem errors may echo
  // user-controlled values when a Quartz logger inspects an Error cause.
  throw new SveltiaCmsError(code, message);
}
