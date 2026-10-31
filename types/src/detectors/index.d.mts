/**
 * Validates the `forcedDetectors` option: each id must name a force-only detector
 * (`requiresForce: true`). Forcing a detector that is used without forcing, or one that does
 * not exist, is reported instead of silently doing nothing.
 * @param {unknown} value - Option value.
 * @returns {string[]} De-duplicated detector ids (empty when unset).
 */
export function resolveForcedDetectors(value: unknown): string[];
/**
 * Gets enabled detector profiles based on include/exclude options. A force-only detector
 * (`requiresForce: true`) is enabled only when `forcedDetectors` names it, and then even when
 * `enabledDetectors` does not; `disabledDetectors` still turns it off. Listing it in
 * `enabledDetectors` alone does not force it.
 * @param {{ enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[] }} [options={}] - Runtime options.
 * @returns {typeof DETECTOR_PROFILES} Enabled detector list.
 */
export function getEnabledDetectors(options?: {
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    forcedDetectors?: string[];
}): typeof DETECTOR_PROFILES;
/**
 * Gets allowed file extensions for enabled detectors.
 * @param {{ enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], includeExtensions?: string[] }} [options={}] - Runtime options.
 * @returns {Set<string>} Allowed extensions.
 */
export function getAllowedExtensions(options?: {
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    forcedDetectors?: string[];
    includeExtensions?: string[];
}): Set<string>;
/**
 * Says why a file cannot be given a header, or returns null when it can. A file gets a header
 * only when an enabled detector handles its extension and supplies a comment syntax; anything
 * else (strict `.json`, `.txt`, extensionless files, a disabled detector's extensions, Markdown
 * that is not forced) is skipped rather than given a comment its format cannot carry.
 * @param {string} filePath - File path.
 * @param {{ enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[] }} [options={}] - Runtime options.
 * @returns {string | null} Skip reason, or null when the file can carry a header.
 */
export function getHeaderSkipReason(filePath: string, options?: {
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    forcedDetectors?: string[];
}): string | null;
/**
 * Gets a detector by id.
 * @param {string} id - Detector id.
 * @returns {typeof DETECTOR_PROFILES[number] | undefined} Detector.
 */
export function getDetectorById(id: string): (typeof DETECTOR_PROFILES)[number] | undefined;
/**
 * Resolves comment syntax for a file path using detector-specific templates.
 * @param {string} filePath - File path.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectors?: DetectorProfile[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number, margin?: number }} [options={}] - Runtime options. `detectors` overrides the enabled-detector set (matching {@link detectProjectFromMarkers}).
 * @returns {{kind: "block" | "line" | "html", linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string}} Syntax descriptor.
 */
export function getCommentSyntaxForFile(filePath: string, options?: {
    language?: string;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    forcedDetectors?: string[];
    detectors?: DetectorProfile[];
    detectorSyntaxOverrides?: Record<string, {
        linePrefix?: string;
        lineSeparator?: string;
        blockStart?: string;
        blockLinePrefix?: string;
        blockEnd?: string;
    }>;
    spacing?: number;
    margin?: number;
}): {
    kind: "block" | "line" | "html";
    linePrefix?: string;
    lineSeparator?: string;
    blockStart?: string;
    blockLinePrefix?: string;
    blockEnd?: string;
};
/**
 * Resolves the content at the top of a file that stays above the header: the detector's
 * leading block (front matter), then the run of lines at the very top whose position matters
 * (see {@link DetectorProfile}). A line further down is never part of it.
 * @param {string} filePath - File path.
 * @param {string} content - File content, without a byte order mark.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[] }} [options={}] - Runtime options.
 * @returns {string} Preserved prefix (possibly empty).
 */
export function getPreservedPrefixForFile(filePath: string, content: string, options?: {
    language?: string;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    forcedDetectors?: string[];
}): string;
/**
 * Says why a file's content cannot carry a header (a PHP file that does not open with `<?php`,
 * where a comment at the top would be output as text), or null when it can.
 * @param {string} filePath - File path.
 * @param {string} content - File content.
 * @param {{ enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[] }} [options={}] - Runtime options.
 * @returns {string | null} Skip reason, or null.
 */
export function getContentSkipReason(filePath: string, content: string, options?: {
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    forcedDetectors?: string[];
}): string | null;
/**
 * @fileoverview Detector registry and shared selector helpers.
 * @module fix-headers/detectors
 */
/**
 * @typedef {{
 *  id: string,
 *  extensions: string[],
 *  enabledByDefault: boolean,
 *  requiresForce?: boolean,
 *  resolveCommentSyntax: (filePath: string) => ({kind: "block" | "line" | "html", linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string} | null),
 *  resolvePreservedPrefix?: (filePath: string, content: string) => string,
 *  keepsAboveHeader?: (line: string, index: number) => boolean,
 *  resolveContentSkipReason?: (content: string) => string | null
 * }} DetectorProfile
 * A file-type detector: which extensions it handles and the comment syntax of those files, and
 * what stays above the header: `resolvePreservedPrefix` takes a leading block (front matter),
 * and `keepsAboveHeader` accepts each line of the run at the very top of the file that keeps its
 * place (a shebang, an encoding declaration; editor modelines are accepted for every detector).
 * `resolveContentSkipReason` says why a file's content cannot carry a header at all. Which project a file belongs to is resolved separately,
 * from the manifest drivers in `src/drivers/`. A detector with `requiresForce: true` is used only
 * when its id is listed in the `forcedDetectors` option (see {@link getEnabledDetectors}).
 */
/**
 * Registered detector profiles, in alphabetical order by module name. Imported
 * statically (not discovered from the directory at runtime) so the registry
 * survives bundling into dist/. Add a new detector module here. The cast keeps the
 * public type `DetectorProfile[]`: the detector modules' object literals widen their
 * `kind` strings, which the typedef narrows to its literal union.
 */
export const DETECTOR_PROFILES: DetectorProfile[];
/**
 * A file-type detector: which extensions it handles and the comment syntax of those files, and
 * what stays above the header: `resolvePreservedPrefix` takes a leading block (front matter),
 * and `keepsAboveHeader` accepts each line of the run at the very top of the file that keeps its
 * place (a shebang, an encoding declaration; editor modelines are accepted for every detector).
 * `resolveContentSkipReason` says why a file's content cannot carry a header at all. Which project a file belongs to is resolved separately,
 * from the manifest drivers in `src/drivers/`. A detector with `requiresForce: true` is used only
 * when its id is listed in the `forcedDetectors` option (see {@link getEnabledDetectors}).
 */
export type DetectorProfile = {
    id: string;
    extensions: string[];
    enabledByDefault: boolean;
    requiresForce?: boolean;
    resolveCommentSyntax: (filePath: string) => ({
        kind: "block" | "line" | "html";
        linePrefix?: string;
        lineSeparator?: string;
        blockStart?: string;
        blockLinePrefix?: string;
        blockEnd?: string;
    } | null);
    resolvePreservedPrefix?: (filePath: string, content: string) => string;
    keepsAboveHeader?: (line: string, index: number) => boolean;
    resolveContentSkipReason?: (content: string) => string | null;
};
