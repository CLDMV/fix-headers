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
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }> }} [options={}] - Runtime options.
 * @returns {{kind: "block" | "line" | "html", linePrefix?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string}} Syntax descriptor.
 */
export function getCommentSyntaxForFile(filePath: string, options?: {
    language?: string;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    detectorSyntaxOverrides?: Record<string, {
        linePrefix?: string;
        blockStart?: string;
        blockLinePrefix?: string;
        blockEnd?: string;
    }>;
}): {
    kind: "block" | "line" | "html";
    linePrefix?: string;
    blockStart?: string;
    blockLinePrefix?: string;
    blockEnd?: string;
};
export const DETECTOR_PROFILES: {
    id: string;
    markers: string[];
    extensions: string[];
    enabledByDefault: boolean;
    findNearestConfig: (startPath: string) => Promise<{
        root: string;
        marker: string;
    } | null>;
    parseProjectName: (marker: string, markerContent: string, rootDirName: string) => string;
    resolveCommentSyntax: (filePath: string) => {
        kind: "block" | "line" | "html";
        linePrefix?: string;
        blockStart?: string;
        blockLinePrefix?: string;
        blockEnd?: string;
    } | null;
}[];
