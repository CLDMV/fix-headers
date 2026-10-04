/**
 * Discovers source files for processing.
 * @param {{
 *  projectRoot: string,
 *  language?: string,
 *  includeExtensions?: string[],
 *  enabledDetectors?: string[],
 *  disabledDetectors?: string[],
 *  forcedDetectors?: string[],
 *  includeFolders?: IncludeFolderEntry[],
 *  excludeFolders?: string[],
 *  gitignore?: boolean | string | string[]
 * }} options - File discovery options. `includeFolders`: a string entry is walked recursively;
 *  `{ path, recursive: false }` includes only that folder's own files. Overlapping entries are
 *  collapsed, so each file is returned once however the folders nest or are spelled.
 *  `gitignore`: `false` disables ignore files; a path or array of paths (relative to the project
 *  root) uses exactly those files; anything else / omitted applies every ignore file git honours
 *  (see {@link createIgnoreFilter}). Nothing is excluded by name except `.git`.
 * @returns {Promise<string[]>} Absolute file paths, each listed once.
 */
export function discoverFiles(options: {
    projectRoot: string;
    language?: string;
    includeExtensions?: string[];
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    forcedDetectors?: string[];
    includeFolders?: IncludeFolderEntry[];
    excludeFolders?: string[];
    gitignore?: boolean | string | string[];
}): Promise<string[]>;
/**
 * Package-manager dependency folders. They hold installed third-party code, never the project's
 * own source, so discovery skips them at any depth whatever the ignore files say (a project with
 * no `.gitignore`, a sub-package's own `node_modules`, a tracked dependency folder). A folder
 * named explicitly through `includeFolders` / `input` is still processed.
 * @type {readonly string[]}
 */
export const DEPENDENCY_FOLDERS: readonly string[];
/**
 * An `includeFolders` entry: a project-relative folder path (walked recursively), or an object
 * form that can switch recursion off so only the folder's own files are included.
 */
export type IncludeFolderEntry = string | {
    path: string;
    recursive?: boolean;
};
