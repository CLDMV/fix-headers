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

import { join, relative, resolve, sep } from "node:path";
import { readFile, realpath, stat } from "node:fs/promises";
import ignore from "ignore";
import { ALWAYS_IGNORE_FOLDERS, ROOT_IGNORE_FOLDERS } from "../constants.mjs";
import { getAllowedExtensions } from "../detectors/index.mjs";
import { walkFiles } from "../utils/fs.mjs";

/**
 * @fileoverview Resolves candidate source files for header updates based on language and options.
 * @module fix-headers/core/file-discovery
 */

/**
 * Resolves extension set from enabled detectors and optional override.
 * @param {{
 *  includeExtensions?: string[],
 *  enabledDetectors?: string[],
 *  disabledDetectors?: string[]
 * }} options - Extension options.
 * @returns {Set<string>} Effective extension set.
 */
function resolveExtensions(options) {
	return getAllowedExtensions(options);
}

const ALWAYS_IGNORED_FOLDERS = new Set(ALWAYS_IGNORE_FOLDERS);

/**
 * Normalizes a user-provided folder path to a project-relative value.
 * @param {string} folderPath - Folder path string.
 * @returns {string} Normalized path.
 */
function normalizeFolderPath(folderPath) {
	return folderPath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * An `includeFolders` entry: a project-relative folder path (walked recursively), or an object
 * form that can switch recursion off so only the folder's own files are included.
 * @typedef {string | { path: string, recursive?: boolean }} IncludeFolderEntry
 */

/**
 * Normalizes `includeFolders` entries to `{ path, recursive }` records.
 * @param {IncludeFolderEntry[] | undefined} includeFolders - Include folder option.
 * @returns {Array<{ path: string, recursive: boolean }>} Effective include roots, in input order.
 * @throws {TypeError} When an entry is neither a string nor an object with a string `path`.
 */
function resolveIncludeFolders(includeFolders) {
	if (!Array.isArray(includeFolders)) {
		return [];
	}

	return includeFolders.map((entry) => {
		if (typeof entry === "string") {
			return { path: entry, recursive: true };
		}

		if (entry && typeof entry === "object" && typeof entry.path === "string") {
			return { path: entry.path, recursive: entry.recursive !== false };
		}

		throw new TypeError(`Invalid includeFolders entry: ${JSON.stringify(entry)} (expected a path string or { path, recursive? })`);
	});
}

/**
 * Warns when an include folder cannot be scanned and is skipped.
 * @param {string} includeFolder - Project-relative include folder.
 * @param {unknown} error - Original filesystem error.
 * @returns {void}
 */
function reportSkippedIncludeFolder(includeFolder, error) {
	const message = error instanceof Error ? error.message : String(error);
	console.warn(`fix-headers: skipped include folder "${includeFolder}" (${message})`);
}

/**
 * Builds a directory exclusion matcher from path and folder-name lists.
 * @param {string} projectRoot - Project root path.
 * @param {string[] | undefined} excludeFolders - Folder exclusions.
 * @returns {(targetPath: string, targetName: string) => boolean} Exclusion predicate.
 */
function buildExclusionMatcher(projectRoot, excludeFolders) {
	if (!Array.isArray(excludeFolders) || excludeFolders.length === 0) {
		return () => false;
	}

	const absoluteRoot = resolve(projectRoot);
	const pathExclusions = [];
	const nameExclusions = new Set();

	for (const entry of excludeFolders) {
		if (typeof entry !== "string") {
			continue;
		}

		const normalized = normalizeFolderPath(entry);
		if (normalized.length === 0) {
			continue;
		}

		if (normalized.includes("/")) {
			pathExclusions.push(resolve(absoluteRoot, normalized));
			continue;
		}

		nameExclusions.add(normalized);
	}

	return (targetPath, targetName) => {
		if (nameExclusions.has(targetName)) {
			return true;
		}

		for (const excludedPath of pathExclusions) {
			if (targetPath === excludedPath || targetPath.startsWith(`${excludedPath}/`)) {
				return true;
			}
		}

		const relPath = normalizeFolderPath(relative(absoluteRoot, targetPath));
		return pathExclusions.some((excludedPath) => {
			const relExcluded = normalizeFolderPath(relative(absoluteRoot, excludedPath));
			return relPath === relExcluded || relPath.startsWith(`${relExcluded}/`);
		});
	};
}

/**
 * Discovers source files for processing.
 * @param {{
 *  projectRoot: string,
 *  language?: string,
 *  includeExtensions?: string[],
 *  enabledDetectors?: string[],
 *  disabledDetectors?: string[],
 *  includeFolders?: IncludeFolderEntry[],
 *  excludeFolders?: string[],
 *  gitignore?: boolean | string | string[]
 * }} options - File discovery options. `includeFolders`: a string entry is walked recursively;
 *  `{ path, recursive: false }` includes only that folder's own files. Overlapping entries are
 *  collapsed, so each file is returned once however the folders nest or are spelled.
 *  `gitignore`: `false` disables; a path or array of paths loads those ignore files; anything
 *  else / omitted auto-detects `<projectRoot>/.gitignore`.
 * @returns {Promise<string[]>} Absolute file paths, each listed once.
 */
export async function discoverFiles(options) {
	const allowedExtensions = resolveExtensions(options);
	const includeFolders = resolveIncludeFolders(options.includeFolders);
	const excludeFolders = Array.isArray(options.excludeFolders) ? options.excludeFolders : [];
	const exclusionMatcher = buildExclusionMatcher(options.projectRoot, excludeFolders);
	// Build/cache dirs (ROOT_IGNORE_FOLDERS) are ignored only at the PROJECT ROOT, so a nested
	// source directory with the same name (e.g. tools/build) is still processed. node_modules /
	// .git stay any-depth via walkFiles' `ignoreFolders` below.
	const absoluteRoot = resolve(options.projectRoot);
	const rootIgnorePaths = new Set(Array.from(ROOT_IGNORE_FOLDERS, (name) => resolve(absoluteRoot, name)));
	// Optional .gitignore support: skip anything the project's .gitignore matches, so generated /
	// output paths are excluded by the project's own rules without hard-coding names. `options.gitignore`
	// may be `false` (disabled), a file path or array of paths, or anything else / undefined
	// (auto-detect `<projectRoot>/.gitignore`).
	let gitignoreMatcher = null;
	if (options.gitignore !== false) {
		const gitignoreFiles =
			typeof options.gitignore === "string"
				? [options.gitignore]
				: Array.isArray(options.gitignore)
					? options.gitignore.filter((entry) => typeof entry === "string")
					: [".gitignore"];
		const ig = ignore();
		let loaded = false;
		for (const rel of gitignoreFiles) {
			try {
				ig.add(await readFile(resolve(absoluteRoot, rel), "utf8"));
				loaded = true;
			} catch {
				/* missing .gitignore — nothing to add */
			}
		}
		gitignoreMatcher = loaded ? ig : null;
	}
	const isGitignored = (targetPath) => {
		if (!gitignoreMatcher) return false;
		const rel = relative(absoluteRoot, resolve(targetPath)).replace(/\\/g, "/");
		return rel.length > 0 && !rel.startsWith("..") && gitignoreMatcher.ignores(rel);
	};
	const shouldSkipDirectory = (targetPath, targetName) =>
		rootIgnorePaths.has(resolve(targetPath)) || exclusionMatcher(targetPath, targetName) || isGitignored(targetPath);
	const requestedRoots =
		includeFolders.length > 0
			? includeFolders.map((entry) => ({
					includeFolder: entry.path,
					rootPath: join(options.projectRoot, entry.path),
					recursive: entry.recursive
				}))
			: [{ includeFolder: ".", rootPath: options.projectRoot, recursive: true }];

	/** @type {Array<{ includeFolder: string, rootPath: string, recursive: boolean, realRoot: string }>} */
	const roots = [];
	for (const root of requestedRoots) {
		const rootStats = await stat(root.rootPath).catch((error) => error);
		if (rootStats instanceof Error) {
			if (/** @type {{ code?: string }} */ (rootStats).code === "ENOENT") {
				reportSkippedIncludeFolder(root.includeFolder, rootStats);
				continue;
			}

			throw rootStats;
		}

		if (!rootStats.isDirectory()) {
			reportSkippedIncludeFolder(root.includeFolder, `path is not a directory: ${root.rootPath}`);
			continue;
		}

		// The canonical (symlink-resolved) path is only used to detect overlapping roots. If the folder
		// vanishes between the stat above and this call, fall back to the lexical path; the walk below
		// then fails on it exactly as it did before overlap detection existed.
		const realRoot = await realpath(root.rootPath).catch(() => resolve(root.rootPath));
		roots.push({ ...root, realRoot });
	}

	/**
	 * Whether walking `container` already yields every file that walking `candidate` would.
	 * @param {{ rootPath: string, recursive: boolean, realRoot: string }} container - Root that may cover the candidate.
	 * @param {{ recursive: boolean, realRoot: string }} candidate - Root that may be redundant.
	 * @returns {boolean} True when the candidate's walk is redundant.
	 */
	const covers = (container, candidate) => {
		if (container.realRoot === candidate.realRoot) {
			return container.recursive || !candidate.recursive;
		}

		const containerPrefix = container.realRoot.endsWith(sep) ? container.realRoot : `${container.realRoot}${sep}`;
		if (!container.recursive || !candidate.realRoot.startsWith(containerPrefix)) {
			return false;
		}

		// The container's walk only reaches the candidate if it descends through every directory in
		// between. A directory it skips (node_modules, a root build folder, an exclusion, a .gitignore
		// match) hides the candidate's files from it, so an explicitly listed folder under such a
		// directory keeps being walked on its own, as it always was.
		let current = container.rootPath;
		for (const segment of candidate.realRoot.slice(containerPrefix.length).split(sep)) {
			current = join(current, segment);
			if (ALWAYS_IGNORED_FOLDERS.has(segment) || shouldSkipDirectory(current, segment)) {
				return false;
			}
		}

		return true;
	};

	// Drop every root another root already covers (nested includes, "." next to its subfolders,
	// duplicate or differently spelled entries), so no directory is walked twice. Roots are
	// considered shallowest-first — recursive before non-recursive for the same folder, then in
	// input order (the sort is stable) — so any covering root has already been kept by the time
	// the roots it covers are checked.
	const byContainment = [...roots].sort(
		(left, right) => left.realRoot.length - right.realRoot.length || Number(right.recursive) - Number(left.recursive)
	);
	/** @type {typeof roots} */
	const keptRoots = [];
	for (const root of byContainment) {
		if (!keptRoots.some((kept) => covers(kept, root))) {
			keptRoots.push(root);
		}
	}

	const files = [];
	// Walk the surviving roots in their original input order, so non-overlapping inputs keep the
	// output order they have always had.
	for (const root of roots) {
		if (!keptRoots.includes(root)) {
			continue;
		}

		const discovered = await walkFiles(root.rootPath, {
			allowedExtensions,
			ignoreFolders: ALWAYS_IGNORED_FOLDERS,
			shouldSkipDirectory,
			recursive: root.recursive
		});
		files.push(...discovered);
	}

	// The kept roots never overlap, so this is a guard rather than the mechanism: each path is
	// returned once, in first-seen order.
	return Array.from(new Set(files)).filter(
		(filePath) => !exclusionMatcher(filePath, filePath.split("/").at(-1) || "") && !isGitignored(filePath)
	);
}
