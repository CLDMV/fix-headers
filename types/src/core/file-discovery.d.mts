/**
 * Discovers source files for processing.
 * @param {{
 *  projectRoot: string,
 *  language?: string,
 *  includeExtensions?: string[],
 *  enabledDetectors?: string[],
 *  disabledDetectors?: string[],
 *  includeFolders?: string[],
 *  excludeFolders?: string[],
 *  gitignore?: boolean | string | string[]
 * }} options - File discovery options. `gitignore`: `false` disables; a path or array of
 *  paths loads those ignore files; anything else / omitted auto-detects `<projectRoot>/.gitignore`.
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
    gitignore?: boolean | string | string[];
}): Promise<string[]>;
