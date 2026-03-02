/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/utils/fs.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { access, readdir, readFile, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * @fileoverview Filesystem helpers for project discovery and recursive scanning.
 * @module fix-headers/utils/fs
 */

/**
 * Checks whether a file exists and is readable.
 * @param {string} filePath - Absolute or relative path.
 * @returns {Promise<boolean>} True when the path exists.
 */
export async function pathExists(filePath) {
	try {
		await access(filePath, fsConstants.F_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Finds a marker file by traversing upward from a directory.
 * @param {string} startDir - Starting directory.
 * @param {string[]} markerFiles - Candidate marker file names.
 * @returns {Promise<{root: string, marker: string} | null>} First match with root path.
 */
export async function findProjectRoot(startDir, markerFiles) {
	let currentDir = resolve(startDir);

	while (true) {
		for (const marker of markerFiles) {
			const markerPath = join(currentDir, marker);
			if (await pathExists(markerPath)) {
				return { root: currentDir, marker };
			}
		}

		const parent = dirname(currentDir);
		if (parent === currentDir) {
			return null;
		}

		currentDir = parent;
	}
}

/**
 * Reads UTF-8 file content if it exists.
 * @param {string} filePath - File path.
 * @returns {Promise<string | null>} File content or null when missing.
 */
export async function readTextIfExists(filePath) {
	if (!(await pathExists(filePath))) {
		return null;
	}

	return readFile(filePath, "utf8");
}

/**
 * Recursively discovers files matching allowed extensions.
 * @param {string} dirPath - Root directory to scan.
 * @param {{
 *  allowedExtensions: Set<string>,
 *  ignoreFolders: Set<string>,
 *  shouldSkipDirectory?: (directoryPath: string, directoryName: string) => boolean
 * }} options - Scan options.
 * @returns {Promise<string[]>} Matching file paths.
 */
export async function walkFiles(dirPath, options) {
	const files = [];
	const entries = await readdir(dirPath, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dirPath, entry.name);

		if (entry.isDirectory() && options.ignoreFolders.has(entry.name)) {
			continue;
		}

		if (entry.isDirectory() && options.shouldSkipDirectory?.(fullPath, entry.name) === true) {
			continue;
		}

		if (entry.isDirectory()) {
			const nested = await walkFiles(fullPath, options);
			files.push(...nested);
			continue;
		}

		if (!entry.isFile()) {
			continue;
		}

		const extensionStart = entry.name.lastIndexOf(".");
		if (extensionStart === -1) {
			continue;
		}

		const extension = entry.name.slice(extensionStart).toLowerCase();
		if (options.allowedExtensions.has(extension)) {
			files.push(fullPath);
		}
	}

	return files;
}

/**
 * Gets creation-like and modified timestamps from filesystem stats.
 * @param {string} filePath - Absolute file path.
 * @returns {Promise<{createdAt: Date, updatedAt: Date}>} Date pair.
 */
export async function readFileDates(filePath) {
	const fileStats = await stat(filePath);
	const createdAt = fileStats.birthtimeMs > 0 ? fileStats.birthtime : fileStats.mtime;

	return {
		createdAt,
		updatedAt: fileStats.mtime
	};
}
