/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/drivers/shared.mjs
 *	@Date: 2026-09-28T19:20:00-07:00 (1790648400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28T19:20:00-07:00 (1790648400)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * @fileoverview Helpers shared by the manifest drivers: reading a folder's manifests and
 * pulling a name out of JSON, TOML and INI manifests without a full parser.
 * @module fix-headers/drivers/shared
 */

/**
 * @typedef {{ file: string, content: string }} ManifestFile
 * A manifest file found in a folder, with its content.
 */

/**
 * @typedef {{ dir: string, manifest: string, files: ManifestFile[] }} DriverDetection
 * What a driver's `detect` found in a folder: the folder, the first manifest found (in the
 * driver's `manifests` order) and every manifest of the driver that is present and readable.
 */

/**
 * Reads a file, or returns null when it is missing or can't be read as a file (for example a
 * directory with a manifest's name).
 * @param {string} filePath - File path.
 * @returns {Promise<string | null>} File content, or null.
 */
async function readManifest(filePath) {
	try {
		return await readFile(filePath, "utf8");
	} catch {
		return null;
	}
}

/**
 * Detects a driver's manifests in one folder. The folder counts as a project of the driver's
 * kind when at least one of the manifests is present and readable; its content is not
 * validated here, so a malformed manifest still marks the project root.
 * @param {string} dirPath - Folder to check.
 * @param {string[]} manifests - Manifest filenames, in the order the driver reads them.
 * @returns {Promise<DriverDetection | null>} Detection, or null when the folder holds none of them.
 */
export async function detectManifests(dirPath, manifests) {
	/** @type {ManifestFile[]} */
	const files = [];
	for (const file of manifests) {
		const content = await readManifest(join(dirPath, file));
		if (content !== null) {
			files.push({ file, content });
		}
	}
	return files.length > 0 ? { dir: dirPath, manifest: files[0].file, files } : null;
}

/**
 * Gets the content of one manifest from a detection.
 * @param {DriverDetection} detection - Driver detection.
 * @param {string} file - Manifest filename.
 * @returns {string | null} Content, or null when that manifest isn't present.
 */
export function manifestContent(detection, file) {
	return detection.files.find((entry) => entry.file === file)?.content ?? null;
}

/**
 * Normalizes a candidate name: a trimmed non-empty string, else undefined.
 * @param {unknown} value - Candidate value.
 * @returns {string | undefined} Name.
 */
export function cleanName(value) {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Reads the top-level `name` of a JSON manifest (`package.json`, `composer.json`).
 * @param {string} content - Manifest content.
 * @returns {string | undefined} Name, or undefined when the content isn't valid JSON or has no
 * non-empty string `name`.
 */
export function readJsonName(content) {
	try {
		return cleanName(JSON.parse(content)?.name);
	} catch {
		return undefined;
	}
}

/**
 * Yields the lines of one `[section]` of a TOML or INI file. Array-of-tables headers
 * (`[[bin]]`) end a section without starting one that can match.
 * @param {string} content - File content.
 * @param {string} section - Section name, dotted for nested TOML tables (`tool.poetry`).
 * @returns {Generator<string>} Trimmed lines inside the section.
 */
function* sectionLines(content, section) {
	let current = "";
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (line.startsWith("[")) {
			const header = line.match(/^\[([^[\]]+)\]/);
			current = header
				? header[1]
						.split(".")
						.map((part) => part.trim())
						.join(".")
				: "";
			continue;
		}
		if (current === section) {
			yield line;
		}
	}
}

/**
 * Reads a string value from a TOML table: `key = "value"` or `key = 'value'` on its own line.
 * @param {string} content - TOML content.
 * @param {string} table - Table name, dotted for nested tables (`tool.poetry`).
 * @param {string} key - Bare key.
 * @returns {string | undefined} Value, or undefined when the table or key is missing.
 */
export function readTomlString(content, table, key) {
	const pattern = new RegExp(`^${key}\\s*=\\s*(?:"([^"\\\\]*)"|'([^']*)')`);
	for (const line of sectionLines(content, table)) {
		const match = line.match(pattern);
		if (match) {
			return cleanName(match[1] ?? match[2]);
		}
	}
	return undefined;
}

/**
 * Reads a value from an INI section (`key = value` or `key: value`), as in `setup.cfg`.
 * @param {string} content - INI content.
 * @param {string} section - Section name.
 * @param {string} key - Key.
 * @returns {string | undefined} Value, or undefined when the section or key is missing.
 */
export function readIniValue(content, section, key) {
	const pattern = new RegExp(`^${key}\\s*[=:](.*)$`);
	for (const line of sectionLines(content, section)) {
		const match = line.match(pattern);
		if (match) {
			return cleanName(match[1]);
		}
	}
	return undefined;
}
