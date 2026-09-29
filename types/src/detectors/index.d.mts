/**
 * Gets enabled detector profiles based on include/exclude options.
 * @param {{ enabledDetectors?: string[], disabledDetectors?: string[] }} [options={}] - Runtime options.
 * @returns {typeof DETECTOR_PROFILES} Enabled detector list.
 */
export function getEnabledDetectors(options?: {
    enabledDetectors?: string[];
    disabledDetectors?: string[];
}): typeof DETECTOR_PROFILES;
/**
 * Gets allowed file extensions for enabled detectors.
 * @param {{ enabledDetectors?: string[], disabledDetectors?: string[], includeExtensions?: string[] }} [options={}] - Runtime options.
 * @returns {Set<string>} Allowed extensions.
 */
export function getAllowedExtensions(options?: {
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    includeExtensions?: string[];
}): Set<string>;
/**
 * Gets a detector by id.
 * @param {string} id - Detector id.
 * @returns {typeof DETECTOR_PROFILES[number] | undefined} Detector.
 */
export function getDetectorById(id: string): (typeof DETECTOR_PROFILES)[number] | undefined;
/**
 * Resolves comment syntax for a file path using detector-specific templates.
 * @param {string} filePath - File path.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], detectors?: DetectorProfile[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number, margin?: number }} [options={}] - Runtime options. `detectors` overrides the enabled-detector set (matching {@link detectProjectFromMarkers}).
 * @returns {{kind: "block" | "line" | "html", linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string}} Syntax descriptor.
 */
export function getCommentSyntaxForFile(filePath: string, options?: {
    language?: string;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
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
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[] }} [options={}] - Runtime options.
 * @returns {string} Preserved prefix (possibly empty).
 */
export function getPreservedPrefixForFile(filePath: string, content: string, options?: {
    language?: string;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
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
 *  resolveCommentSyntax: (filePath: string) => ({kind: "block" | "line" | "html", linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string} | null),
 *  resolvePreservedPrefix?: (filePath: string, content: string) => string
 * }} DetectorProfile
 * A file-type detector: which extensions it handles and the comment syntax (and preserved
 * leading prefix) of those files. Which project a file belongs to is resolved separately,
 * from the manifest drivers in `src/drivers/`.
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
 * from the manifest drivers in `src/drivers/`.
 */
export type DetectorProfile = {
    id: string;
    extensions: string[];
    enabledByDefault: boolean;
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
