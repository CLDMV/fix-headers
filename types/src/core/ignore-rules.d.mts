/**
 * Creates the ignore filter for one discovery root.
 * @param {{ root: string, gitignore?: boolean | string | string[] }} options - `gitignore`: `false`
 *  disables ignore files entirely; a path or array of paths (relative to the root) uses exactly
 *  those files, without asking git; anything else asks git / parses `.gitignore` files.
 * @returns {{ isIgnored: (targetPath: string, isDirectory: boolean) => Promise<boolean> }} Filter.
 */
export function createIgnoreFilter(options: {
    root: string;
    gitignore?: boolean | string | string[];
}): {
    isIgnored: (targetPath: string, isDirectory: boolean) => Promise<boolean>;
};
/**
 * Parsed rules of one ignore file, matched relative to `base`.
 */
export type IgnoreMatcher = {
    base: string;
    rules: import("ignore").Ignore;
};
/**
 * A folder's ignore state. `git`: the files git lists for the repository rooted at `root`;
 * `rules`: parsed ignore files, innermost last; `nested` says whether `.gitignore` files and
 * repositories below are picked up while walking (false for explicit ignore files); `excluded`
 * marks a folder the rules ignore, so everything inside it is ignored too — as in git, a file
 * cannot be re-included when a parent folder is excluded.
 */
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
