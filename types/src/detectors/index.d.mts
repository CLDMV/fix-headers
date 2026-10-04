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
 * Resolves detector-specific leading content that must be preserved above inserted headers.
 * @param {string} filePath - File path.
 * @param {string} content - Full file content.
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
 *  resolvePreservedPrefix?: (filePath: string, content: string) => string
 * }} DetectorProfile
 * A file-type detector: which extensions it handles and the comment syntax (and preserved
 * leading prefix) of those files. Which project a file belongs to is resolved separately,
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
 * A file-type detector: which extensions it handles and the comment syntax (and preserved
 * leading prefix) of those files. Which project a file belongs to is resolved separately,
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
};
