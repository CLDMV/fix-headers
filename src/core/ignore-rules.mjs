/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/core/ignore-rules.mjs
 *	@Date: 2026-09-28T18:00:27-07:00 (1790643627)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:13-07:00 (1790969293)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { execFile } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import ignore from "ignore";

/**
 * @fileoverview Decides which discovered paths the project's ignore files exclude.
 *
 * Nothing is excluded by name. Inside a git work tree, git itself answers: one
 * `git ls-files --cached --others --exclude-standard` per repository lists every file git does
 * not ignore (root and nested `.gitignore`, `.git/info/exclude`, `core.excludesFile`), and tracked
 * files count as not ignored, as they do for git. Outside a work tree — or when git is missing,
 * or the discovery root is itself ignored by the repository around it — the `.gitignore` files
 * found under the root are parsed instead, each one scoped to its own folder.
 *
 * A nested repository (or submodule) found during the walk gets its own context, so a run over a
 * folder of several repositories applies each repository's own rules; the enclosing folder's rules
 * still decide whether the nested repository is walked at all.
 * @module fix-headers/core/ignore-rules
 */

/**
 * Parsed rules of one ignore file, matched relative to `base`.
 * @typedef {{ base: string, rules: import("ignore").Ignore }} IgnoreMatcher
 */

/**
 * A folder's ignore state. `git`: the files git lists for the repository rooted at `root`;
 * `rules`: parsed ignore files, innermost last; `nested` says whether `.gitignore` files and
 * repositories below are picked up while walking (false for explicit ignore files); `excluded`
 * marks a folder the rules ignore, so everything inside it is ignored too — as in git, a file
 * cannot be re-included when a parent folder is excluded.
 * @typedef {{ kind: "git", root: string, entries: Set<string>, dirs: Set<string> }
 *  | { kind: "rules", nested: boolean, excluded: boolean, matchers: IgnoreMatcher[] }} IgnoreContext
 */

/**
 * Runs git, resolving (never rejecting) with its exit code and stdout. A spawn failure — git not
 * installed, or a working directory that does not exist — resolves with code -1.
 * @param {string} cwd - Working directory.
 * @param {string[]} args - Git arguments.
 * @returns {Promise<{ code: number, stdout: string }>} Exit code and stdout.
 */
function runGitCommand(cwd, args) {
	return new Promise((resolvePromise) => {
		execFile("git", args, { cwd, encoding: "utf8", maxBuffer: Number.POSITIVE_INFINITY }, (error, stdout) => {
			if (!error) {
				resolvePromise({ code: 0, stdout });
				return;
			}

			resolvePromise({ code: typeof error.code === "number" ? error.code : -1, stdout: "" });
		});
	});
}

/**
 * Converts a relative path to the forward-slash form git and ignore patterns use.
 * @param {string} from - Base directory.
 * @param {string} to - Target path.
 * @returns {string} Relative forward-slash path.
 */
function toPosixRelative(from, to) {
	return relative(from, to).split(sep).join("/");
}

/**
 * Reads and parses one ignore file.
 * @param {string} filePath - Absolute ignore-file path.
 * @returns {Promise<import("ignore").Ignore | null>} Parsed rules, or null when the file can't be read.
 */
async function readIgnoreFile(filePath) {
	try {
		return ignore().add(await readFile(filePath, "utf8"));
	} catch {
		return null;
	}
}

/**
 * Whether a folder holds a `.git` entry (a repository, a linked worktree or a submodule).
 * @param {string} dirPath - Absolute folder path.
 * @returns {Promise<boolean>} True when `<dirPath>/.git` exists.
 */
async function hasGitEntry(dirPath) {
	return lstat(join(dirPath, ".git")).then(
		() => true,
		() => false
	);
}

/**
 * Whether parsed ignore files ignore a path. The innermost file is asked first: the last pattern
 * that matches decides, and a deeper file's patterns win over a shallower one's, as in git.
 * @param {IgnoreMatcher[]} matchers - Ignore files that apply, innermost last.
 * @param {string} targetPath - Absolute path.
 * @param {boolean} isDirectory - Whether the path is a directory (directory-only patterns).
 * @returns {boolean} True when ignored.
 */
function matchesRules(matchers, targetPath, isDirectory) {
	for (let index = matchers.length - 1; index >= 0; index--) {
		const { base, rules } = matchers[index];
		const result = rules.test(`${toPosixRelative(base, targetPath)}${isDirectory ? "/" : ""}`);
		if (result.ignored || result.unignored) {
			return result.ignored;
		}
	}

	return false;
}

/**
 * Builds the parsed-rules context for a folder that git does not answer for.
 * @param {string} dirPath - Absolute folder path.
 * @param {IgnoreMatcher[]} matchers - Rules inherited from enclosing folders.
 * @returns {Promise<IgnoreContext>} Context holding the folder's own `.gitignore`, when present.
 */
async function buildRulesContext(dirPath, matchers) {
	const rules = await readIgnoreFile(join(dirPath, ".gitignore"));
	return { kind: "rules", nested: true, excluded: false, matchers: rules ? [...matchers, { base: dirPath, rules }] : matchers };
}

/**
 * Resolves the context for a folder that starts a new scope: the discovery root, a nested
 * repository, or a folder git lists as a single entry (a submodule or a symlink).
 * @param {string} dirPath - Absolute folder path.
 * @returns {Promise<IgnoreContext>} Git context when git answers for the folder, parsed rules otherwise.
 */
async function resolveScopeContext(dirPath) {
	// `check-ignore .` exits 1 inside a work tree when the folder is not ignored, 0 when the
	// repository around it ignores it, and 128 outside a work tree.
	const [ignoredCheck, listing] = await Promise.all([
		runGitCommand(dirPath, ["check-ignore", "-q", "."]),
		runGitCommand(dirPath, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
	]);

	if (ignoredCheck.code !== 1 || listing.code !== 0) {
		return buildRulesContext(dirPath, []);
	}

	const entries = new Set();
	const dirs = new Set();
	for (const listed of listing.stdout.split("\0")) {
		// An untracked nested repository is listed once, as `path/`.
		const entry = listed.endsWith("/") ? listed.slice(0, -1) : listed;
		if (entry.length === 0) {
			continue;
		}

		entries.add(entry);
		for (let slash = entry.indexOf("/"); slash !== -1; slash = entry.indexOf("/", slash + 1)) {
			dirs.add(entry.slice(0, slash));
		}
	}

	return { kind: "git", root: dirPath, entries, dirs };
}

/**
 * Creates the ignore filter for one discovery root.
 * @param {{ root: string, gitignore?: boolean | string | string[] }} options - `gitignore`: `false`
 *  disables ignore files entirely; a path or array of paths (relative to the root) uses exactly
 *  those files, without asking git; anything else asks git / parses `.gitignore` files.
 * @returns {{ isIgnored: (targetPath: string, isDirectory: boolean) => Promise<boolean> }} Filter.
 */
export function createIgnoreFilter(options) {
	const root = resolve(options.root);
	const gitignore = options.gitignore;

	if (gitignore === false) {
		return { isIgnored: async () => false };
	}

	/** @type {Map<string, Promise<IgnoreContext>>} */
	const contexts = new Map();

	/**
	 * Builds the root context.
	 * @returns {Promise<IgnoreContext>} Root context.
	 */
	const buildRootContext = async () => {
		if (typeof gitignore !== "string" && !Array.isArray(gitignore)) {
			return resolveScopeContext(root);
		}

		const files = typeof gitignore === "string" ? [gitignore] : gitignore.filter((entry) => typeof entry === "string");
		const matchers = [];
		for (const file of files) {
			const rules = await readIgnoreFile(resolve(root, file));
			if (rules) {
				matchers.push({ base: root, rules });
			}
		}

		return { kind: "rules", nested: false, excluded: false, matchers };
	};

	/**
	 * Returns the (cached) context that applies to the entries of a folder inside the root.
	 * @param {string} dirPath - Absolute folder path, the root or below it.
	 * @returns {Promise<IgnoreContext>} Folder context.
	 */
	const contextFor = (dirPath) => {
		let context = contexts.get(dirPath);
		if (!context) {
			context = dirPath === root ? buildRootContext() : deriveContext(dirPath);
			contexts.set(dirPath, context);
		}

		return context;
	};

	/**
	 * Derives a sub-folder's context from its parent's.
	 * @param {string} dirPath - Absolute folder path below the root.
	 * @returns {Promise<IgnoreContext>} Folder context.
	 */
	const deriveContext = async (dirPath) => {
		const parent = await contextFor(dirname(dirPath));
		if (parent.kind === "git") {
			return parent.entries.has(toPosixRelative(parent.root, dirPath)) ? resolveScopeContext(dirPath) : parent;
		}

		if (!parent.nested || parent.excluded) {
			return parent;
		}

		if (matchesRules(parent.matchers, dirPath, true)) {
			return { ...parent, excluded: true };
		}

		return (await hasGitEntry(dirPath)) ? resolveScopeContext(dirPath) : buildRulesContext(dirPath, parent.matchers);
	};

	return {
		async isIgnored(targetPath, isDirectory) {
			const absolutePath = resolve(targetPath);
			const fromRoot = relative(root, absolutePath);
			// The root itself, and anything outside it, was asked for explicitly.
			if (fromRoot.length === 0 || fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
				return false;
			}

			const context = await contextFor(dirname(absolutePath));
			if (context.kind === "git") {
				const entry = toPosixRelative(context.root, absolutePath);
				return !(context.entries.has(entry) || (isDirectory && context.dirs.has(entry)));
			}

			return context.excluded || matchesRules(context.matchers, absolutePath, isDirectory);
		}
	};
}
