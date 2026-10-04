/**
 * @fileoverview Main header-fixing engine with auto-detection and override support.
 * @module fix-headers/core/fix-headers
 */
/**
 * Fixes headers in a project using auto-detected metadata unless overridden.
 * @param {FixHeadersOptions} [options={}] - Runtime options.
 * @returns {Promise<FixHeadersResult>} Process report.
 */
export function fixHeaders(options?: FixHeadersOptions): Promise<FixHeadersResult>;
export type FixHeadersOptions = {
    cwd?: string;
    input?: string | string[];
    dryRun?: boolean;
    check?: boolean;
    fixCreatedDate?: boolean;
    strictCreatedDate?: boolean;
    normalizeDateFormat?: boolean;
    timezone?: string;
    convertTimezone?: boolean;
    configFile?: string;
    sampleOutput?: boolean;
    forceAuthorUpdate?: boolean;
    forceLastModifiedAuthorUpdate?: boolean;
    useGpgSignerAuthor?: boolean;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    forcedDetectors?: string[];
    detectorSyntaxOverrides?: Record<string, {
        linePrefix?: string;
        lineSeparator?: string;
        blockStart?: string;
        blockLinePrefix?: string;
        blockEnd?: string;
    }>;
    includeFolders?: Array<string | {
        path: string;
        recursive?: boolean;
    }>;
    excludeFolders?: string[];
    includeExtensions?: string[];
    gitignore?: boolean | string | string[];
    projectName?: string;
    language?: string;
    projectRoot?: string;
    marker?: string | null;
    authorName?: string;
    authorEmail?: string;
    company?: string;
    companyName?: string;
    copyrightStartYear?: number;
    spacing?: number;
    margin?: number;
};
export type HeaderFieldIssue = import("../header/fields.mjs").HeaderFieldIssue;
/**
 * Rewrites a header date payload (format or zone), keeping its instant.
 */
export type DateRewrite = (payload: {
    date: string;
    timestamp: number;
}) => {
    date: string;
    timestamp: number;
};
/**
 * Result of a run. With `sampleOutput: true`, each changed entry carries a `sample`:
 * - `previousValue` / `newValue` - the header block before (null when the file had none) and after.
 * - `diff` - a unified diff of the header block (`--- a/<file>` / `+++ b/<file>`, `/dev/null`
 *   when there was no previous header), with hunk line numbers relative to the file.
 * - `issues` - one `{ field, previous, detected }` entry per header field whose written value
 *   differs from the existing header. Values are the field text as written in the header
 *   (dates keep their `date (timestamp)` form; `previous` is null when the field was missing).
 *   Fields fix-headers preserves - the original `@Author`/`@Email` and `@Last modified by`
 *   identity, unless `forceAuthorUpdate` / `forceLastModifiedAuthorUpdate` is set - are compared
 *   against what is actually written, so they only appear when they really change. Because an
 *   updated file gets a fresh `@Last modified time`, `lastModifiedAt` is listed for every
 *   changed file that already had a header.
 * - `detectedValues` - the metadata resolved for the file. `projectNameSource` says where
 *   `projectName` came from: `{ from: "manifest", driver, manifest, dir }`,
 *   `{ from: "folder", dir }` or `{ from: "option" }`. `companyName` is the `@Copyright` holder
 *   (null when nothing provides one, and the line then carries none), and `companyNameSource`
 *   says where it came from: `{ from: "manifest", driver, manifest, dir }`, `{ from: "option" }`
 *   or `{ from: "none" }`. `copyrightStartYear` is the start year written for the file, and
 *   `copyrightStartYearSource` says where it came from: `"option"` (`copyrightStartYear`) or
 *   `"created-date"` (the year of the file's `@Date`).
 *
 * `metadata.copyrightStartYear` is the `copyrightStartYear` option, or null when it is not set.
 *
 * Files whose format cannot carry the header comment are not processed: each is listed in
 * `skipped` as `{ file, reason }` and counted in `filesSkipped`, not in `filesScanned` or
 * `changes`. That covers strict `.json`, files with no extension or an extension no enabled
 * detector handles (for example one added through `includeExtensions`), and Markdown unless
 * `forcedDetectors` includes `"markdown"`.
 */
export type FixHeadersResult = {
    metadata: {
        projectName: string;
        projectNameSource: import("../detect/project.mjs").ProjectNameSource;
        language: string;
        projectRoot: string;
        marker: string | null;
        authorName: string;
        authorEmail: string;
        companyName: string | null;
        companyNameSource: import("../detect/project.mjs").CompanyNameSource;
        copyrightStartYear: number | null;
    };
    detectedProjects: string[];
    filesScanned: number;
    filesUpdated: number;
    filesSkipped: number;
    skipped: Array<{
        file: string;
        reason: string;
    }>;
    dryRun: boolean;
    check: boolean;
    filesWithDateDrift?: number;
    dateAdvisories?: number;
    changes: Array<{
        file: string;
        changed: boolean;
        dateIssues?: import("../header/dates.mjs").DateCheckIssue[];
        sample?: {
            previousValue: string | null;
            newValue: string;
            diff: string;
            issues: HeaderFieldIssue[];
            detectedValues?: {
                projectName: string;
                projectNameSource: import("../detect/project.mjs").ProjectNameSource;
                language: string;
                projectRoot: string;
                marker: string | null;
                authorName: string;
                authorEmail: string;
                companyName: string | null;
                companyNameSource: import("../detect/project.mjs").CompanyNameSource;
                copyrightStartYear: number;
                copyrightStartYearSource: "option" | "created-date";
                createdAtSource: string;
                lastModifiedAtSource: string;
                createdAt: {
                    date: string;
                    timestamp: number;
                };
                lastModifiedAt: {
                    date: string;
                    timestamp: number;
                };
            };
        };
    }>;
};
