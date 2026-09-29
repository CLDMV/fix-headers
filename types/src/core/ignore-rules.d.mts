/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/core/ignore-rules.mjs
 *	@Date: 2026-09-28 18:00:27 -07:00 (1790643627)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 18:00:27 -07:00 (1790643627)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */
export type IgnoreMatcher = {
    base: string;
    rules: import("ignore").Ignore;
};
export type IgnoreContext = {
    kind: "git";
    root: string;
    entries: Set<string>;
    dirs: Set<string>;
} | {
    kind: "rules";
    nested: boolean;
    excluded: boolean;
    matchers: IgnoreMatcher[];
};
/**
 * Creates the ignore filter for one discovery root.
 * @param {{ root: string, gitignore?: boolean | string | string[] }} options - `gitignore`: `false`
 *  disables ignore files entirely; a path or array of paths (relative to the root) uses exactly
 *  those files, without asking git; anything else asks git / parses `.gitignore` files.
 * @returns {{ isIgnored: (targetPath: string, isDirectory: boolean) => Promise<boolean> }} Filter.
 */
export declare function createIgnoreFilter(options: {
    root: string;
    gitignore?: boolean | string | string[];
}): {
    isIgnored: (targetPath: string, isDirectory: boolean) => Promise<boolean>;
};
