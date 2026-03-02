/**
 * Discovers source files for processing.
 * @param {{
 *  projectRoot: string,
 *  language?: string,
 *  includeExtensions?: string[],
 *  enabledDetectors?: string[],
 *  disabledDetectors?: string[],
 *  includeFolders?: string[],
 *  excludeFolders?: string[]
 * }} options - File discovery options.
 * @returns {Promise<string[]>} Absolute file paths.
 */
export function discoverFiles(options: {
    projectRoot: string;
    language?: string;
    includeExtensions?: string[];
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    includeFolders?: string[];
    excludeFolders?: string[];
}): Promise<string[]>;
