/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/drivers/shared.mjs
 *	@Date: 2026-09-28T19:20:00-07:00 (1790648400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:16-07:00 (1790969296)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * @fileoverview Helpers shared by the manifest drivers: reading a folder's manifests and
 * pulling a name or an author out of JSON, TOML and INI manifests without a full parser.
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
 * Reads the name part of a person string in the `Name <email> (url)` form used by
 * `package.json` string authors, Poetry and Cargo authors: the text before the first `<` or `(`.
 * @param {unknown} value - Candidate value.
 * @returns {string | undefined} Name, or undefined when the value isn't a string or has no name
 * before its email or url.
 */
export function personName(value) {
	if (typeof value !== "string") {
		return undefined;
	}
	const end = value.search(/[<(]/);
	return cleanName(end === -1 ? value : value.slice(0, end));
}

/**
 * Parses a JSON manifest (`package.json`, `composer.json`).
 * @param {string} content - Manifest content.
 * @returns {any} Parsed value, or undefined when the content isn't valid JSON.
 */
export function parseJsonManifest(content) {
	try {
		return JSON.parse(content);
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

/**
 * Collects the text of a TOML array value, from just after its opening `[` to the end of the
 * table, so an array spread over several lines is read whole.
 * @param {string} content - TOML content.
 * @param {string} table - Table name, dotted for nested tables (`tool.poetry`).
 * @param {string} key - Bare key.
 * @returns {string | null} Array text, or null when the table has no `key = [` line.
 */
function tomlArrayText(content, table, key) {
	const pattern = new RegExp(`^${key}\\s*=\\s*\\[`);
	/** @type {string[] | null} */
	let lines = null;
	for (const line of sectionLines(content, table)) {
		if (lines !== null) {
			lines.push(line);
			continue;
		}
		const match = line.match(pattern);
		if (match) {
			lines = [line.slice(match[0].length)];
		}
	}
	return lines === null ? null : lines.join("\n");
}

/**
 * Skips whitespace, newlines and `#` comments.
 * @param {string} text - Text.
 * @param {number} index - Start index.
 * @returns {number} Index of the next significant character.
 */
function skipTomlSpace(text, index) {
	let position = index;
	while (position < text.length) {
		if (text[position] === "#") {
			const newline = text.indexOf("\n", position);
			position = newline === -1 ? text.length : newline + 1;
		} else if (/\s/.test(text[position])) {
			position += 1;
		} else {
			break;
		}
	}
	return position;
}

/**
 * Reads the name of the first author in a TOML `authors` array: the name part of a string
 * entry (`authors = ["Name <email>"]`, as in Poetry and Cargo) or the `name` of an inline-table
 * entry (`authors = [{ name = "Name", email = "..." }]`, as in PEP 621).
 * @param {string} content - TOML content.
 * @param {string} table - Table name, dotted for nested tables (`tool.poetry`).
 * @returns {string | undefined} Name, or undefined when the table has no `authors` array or its
 * first entry carries no name.
 */
export function readTomlAuthor(content, table) {
	const text = tomlArrayText(content, table, "authors");
	if (text === null) {
		return undefined;
	}
	const rest = text.slice(skipTomlSpace(text, 0));
	const string = rest.match(/^(?:"([^"\\\n]*)"|'([^'\n]*)')/);
	if (string) {
		return personName(string[1] ?? string[2]);
	}
	const inlineTable = rest.match(/^\{([^}\n]*)\}/);
	const name = inlineTable?.[1].match(/(?:^|,)\s*name\s*=\s*(?:"([^"\\\n]*)"|'([^'\n]*)')/);
	return name ? cleanName(name[1] ?? name[2]) : undefined;
}
