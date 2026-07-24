import { QuartzEmitterPlugin } from '@quartz-community/types';

declare const DEFAULT_SVELTIA_CMS_VERSION: "0.172.2";

type SveltiaCmsErrorCode = "INVALID_OPTIONS" | "INVALID_ROUTE" | "INVALID_VERSION" | "INVALID_SCRIPT_URL" | "INVALID_CONFIG_PATH" | "CONFIG_MISSING" | "CONFIG_UNREADABLE" | "CONFIG_NOT_FILE" | "CONFIG_EMPTY" | "REPOSITORY_REQUIRED" | "INVALID_REPOSITORY" | "UNSAFE_ENVIRONMENT_VARIABLE" | "INVALID_YAML" | "INVALID_CONFIG" | "UNRESOLVED_PLACEHOLDER" | "CREDENTIAL_DETECTED" | "INVALID_OUTPUT_PATH" | "UNSAFE_OUTPUT_PATH" | "WRITE_FAILED";
declare class SveltiaCmsError extends Error {
    readonly code: SveltiaCmsErrorCode;
    constructor(code: SveltiaCmsErrorCode, message: string, options?: ErrorOptions);
}

interface SveltiaCmsOptions {
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

declare const SveltiaCms: QuartzEmitterPlugin<SveltiaCmsOptions>;

export { DEFAULT_SVELTIA_CMS_VERSION, SveltiaCms, SveltiaCmsError, type SveltiaCmsErrorCode, type SveltiaCmsOptions, SveltiaCms as default };
