/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/node.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { extname } from "node:path";
import { findNearestMarker } from "./shared.mjs";

/**
 * @fileoverview Node.js detector implementation.
 * @module fix-headers/detectors/node
 */

const markers = ["package.json"];
const extensions = [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".jsonv", ".jsonc", ".json5"];

/**
 * Parses Node project name from package marker content.
 * @param {string} markerContent - Marker file content.
 * @param {string} rootDirName - Fallback root directory name.
 * @returns {string} Project name.
 */
function parseNodeProjectName(markerContent, rootDirName) {
	try {
		const parsed = JSON.parse(markerContent);
		if (typeof parsed.name === "string" && parsed.name.trim().length > 0) {
			return parsed.name.trim();
		}
		return rootDirName;
	} catch {
		return rootDirName;
	}
}

/**
 * Resolves comment syntax for Node-handled file extensions.
 * @param {string} filePath - File path.
 * @returns {{kind: "block", blockStart: string, blockLinePrefix: string, blockEnd: string} | null} Syntax descriptor.
 */
function resolveNodeCommentSyntax(filePath) {
	const extension = extname(filePath).toLowerCase();
	if (extensions.includes(extension)) {
		return {
			kind: "block",
			blockStart: "/**",
			blockLinePrefix: " *\t",
			blockEnd: " */"
		};
	}
	return null;
}

/**
 * Resolves preserved leading prefix for Node files (for example: shebang line).
 * @param {string} _filePath - File path.
 * @param {string} content - File content.
 * @returns {string} Preserved prefix.
 */
function resolveNodePreservedPrefix(_filePath, content) {
	const shebangMatch = content.match(/^#!.*\b(node|bun|deno|tsx|ts-node)\b.*(?:\r?\n|$)/);
	return shebangMatch ? shebangMatch[0] : "";
}

export const detector = {
	id: "node",
	priority: 100,
	markers,
	extensions,
	enabledByDefault: true,
	findNearestConfig(startPath) {
		return findNearestMarker(startPath, markers);
	},
	parseProjectName(_marker, markerContent, rootDirName) {
		return parseNodeProjectName(markerContent, rootDirName);
	},
	resolvePreservedPrefix(filePath, content) {
		return resolveNodePreservedPrefix(filePath, content);
	},
	resolveCommentSyntax(filePath) {
		return resolveNodeCommentSyntax(filePath);
	}
};
