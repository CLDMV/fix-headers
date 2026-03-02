import { join, relative, resolve } from "node:path";
import { DEFAULT_IGNORE_FOLDERS } from "../constants.mjs";
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

const DEFAULT_IGNORED_FOLDERS = new Set(DEFAULT_IGNORE_FOLDERS);

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
 *  excludeFolders?: string[]
 * }} options - File discovery options.
 * @returns {Promise<string[]>} Absolute file paths.
 */
export async function discoverFiles(options) {
	const allowedExtensions = resolveExtensions(options);
	const includeFolders = resolveIncludeFolders(options.includeFolders);
	const excludeFolders = Array.isArray(options.excludeFolders) ? options.excludeFolders : [];
	const exclusionMatcher = buildExclusionMatcher(options.projectRoot, excludeFolders);

	const roots =
		includeFolders.length > 0 ? includeFolders.map((relativePath) => join(options.projectRoot, relativePath)) : [options.projectRoot];

	const files = [];
	for (const rootPath of roots) {
		const discovered = await walkFiles(rootPath, {
			allowedExtensions,
			ignoreFolders: DEFAULT_IGNORED_FOLDERS,
			shouldSkipDirectory: exclusionMatcher
		});
		files.push(...discovered);
	}

	return files.filter((filePath) => !exclusionMatcher(filePath, filePath.split("/").at(-1) || ""));
}
