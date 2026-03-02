/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/json.mjs
 *	@Date: 2026-03-01 20:00:00 -08:00 (1772433600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:00:00 -08:00 (1772433600)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { extname } from "node:path";
import { findNearestMarker } from "./shared.mjs";

/**
 * @fileoverview JSON-family detector implementation.
 * @module fix-headers/detectors/json
 */

const markers = ["package.json"];
const extensions = [".jsonv", ".jsonc", ".json5"];

/**
 * Parses project name from package marker content.
 * @param {string} markerContent - Marker file content.
 * @param {string} rootDirName - Fallback root directory name.
 * @returns {string} Project name.
 */
function parseJsonProjectName(markerContent, rootDirName) {
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
 * Resolves comment syntax for JSON-family file extensions.
 * @param {string} filePath - File path.
 * @returns {{kind: "block", blockStart: string, blockLinePrefix: string, blockEnd: string} | null} Syntax descriptor.
 */
function resolveJsonCommentSyntax(filePath) {
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

export const detector = {
	id: "json",
	priority: 95,
	markers,
	extensions,
	enabledByDefault: true,
	findNearestConfig(startPath) {
		return findNearestMarker(startPath, markers);
	},
	parseProjectName(_marker, markerContent, rootDirName) {
		return parseJsonProjectName(markerContent, rootDirName);
	},
	resolveCommentSyntax(filePath) {
		return resolveJsonCommentSyntax(filePath);
	}
};
