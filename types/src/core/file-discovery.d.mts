/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/core/file-discovery.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-04 20:59:30 -08:00 (1772686770)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */
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
export declare function discoverFiles(options: {
    projectRoot: string;
    language?: string;
    includeExtensions?: string[];
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    includeFolders?: string[];
    excludeFolders?: string[];
    gitignore?: boolean | string | string[];
}): Promise<string[]>;
