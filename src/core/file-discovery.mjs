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

import { join, relative, resolve } from "node:path";
import { readFile, stat } from "node:fs/promises";
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
 * Determines include roots from explicit include folders.
 * @param {string[] | undefined} includeFolders - Include folder option.
 * @returns {string[]} Effective include roots.
 */
function resolveIncludeFolders(includeFolders) {
	if (Array.isArray(includeFolders) && includeFolders.length > 0) {
		return includeFolders;
	}

	return [];
}

/**
 * Warns when an include folder cannot be scanned and is skipped.
 * @param {string} includeFolder - Project-relative include folder.
 * @param {unknown} error - Original filesystem error.
 * @returns {void}
 */
function reportSkippedIncludeFolder(includeFolder, error) {
	const message = error instanceof Error ? error.message : String(error);
	console.warn(`fix-headers: skipped include folder \"${includeFolder}\" (${message})`);
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
 *  includeFolders?: string[],
 *  excludeFolders?: string[],
 *  gitignore?: boolean | string | string[]
 * }} options - File discovery options. `gitignore`: `false` disables; a path or array of
 *  paths loads those ignore files; anything else / omitted auto-detects `<projectRoot>/.gitignore`.
 * @returns {Promise<string[]>} Absolute file paths.
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
	const roots =
		includeFolders.length > 0
			? includeFolders.map((includeFolder) => ({ includeFolder, rootPath: join(options.projectRoot, includeFolder) }))
			: [{ includeFolder: ".", rootPath: options.projectRoot }];

	const files = [];
	for (const root of roots) {
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

		const discovered = await walkFiles(root.rootPath, {
			allowedExtensions,
			ignoreFolders: ALWAYS_IGNORED_FOLDERS,
			shouldSkipDirectory
		});
		files.push(...discovered);
	}

	return files.filter((filePath) => !exclusionMatcher(filePath, filePath.split("/").at(-1) || "") && !isGitignored(filePath));
}
