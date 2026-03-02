/**
 * Detects project root and language by scanning known marker files.
 * @param {string} cwd - Starting working directory.
 * @param {{ detectors?: { id: string, extensions: string[], priority?: number, findNearestConfig: (path: string) => Promise<{ root: string, marker: string } | null>, parseProjectName: (marker: string, content: string, rootDirName: string) => string }[], enabledDetectors?: string[], disabledDetectors?: string[], preferredExtension?: string }} [options={}] - Detection options.
 * @returns {Promise<{
 *  language: string,
 *  rootDir: string,
 *  marker: string | null,
 *  projectName: string
 * }>} Detection result.
 */
export function detectProjectFromMarkers(cwd: string, options?: {
    detectors?: {
        id: string;
        extensions: string[];
        priority?: number;
        findNearestConfig: (path: string) => Promise<{
            root: string;
            marker: string;
        } | null>;
        parseProjectName: (marker: string, content: string, rootDirName: string) => string;
    }[];
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    preferredExtension?: string;
}): Promise<{
    language: string;
    rootDir: string;
    marker: string | null;
    projectName: string;
}>;
/**
 * Resolves project metadata with override support for every auto-detected field.
 * @param {{
 *  cwd?: string,
 *  targetFilePath?: string,
 *  enabledDetectors?: string[],
 *  disabledDetectors?: string[],
 *  projectName?: string,
 *  language?: string,
 *  projectRoot?: string,
 *  marker?: string | null,
 *  authorName?: string,
 *  authorEmail?: string,
 *  companyName?: string,
 *  copyrightStartYear?: number
 * }} [options={}] - Detection options and overrides.
 * @returns {Promise<{
 *  projectName: string,
 *  language: string,
 *  projectRoot: string,
 *  marker: string | null,
 *  authorName: string,
 *  authorEmail: string,
 *  companyName: string,
 *  copyrightStartYear: number
 * }>} Final metadata.
 */
export function resolveProjectMetadata(options?: {
    cwd?: string;
    targetFilePath?: string;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    projectName?: string;
    language?: string;
    projectRoot?: string;
    marker?: string | null;
    authorName?: string;
    authorEmail?: string;
    companyName?: string;
    copyrightStartYear?: number;
}): Promise<{
    projectName: string;
    language: string;
    projectRoot: string;
    marker: string | null;
    authorName: string;
    authorEmail: string;
    companyName: string;
    copyrightStartYear: number;
}>;
