/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/python.mjs
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
 * @fileoverview Python detector implementation.
 * @module fix-headers/detectors/python
 */

const markers = ["pyproject.toml", "setup.py", "requirements.txt"];
const extensions = [".py"];

/**
 * Parses Python project name from pyproject marker content when possible.
 * @param {string} markerContent - Marker content.
 * @param {string} rootDirName - Fallback root directory name.
 * @returns {string} Project name.
 */
function parsePythonProjectName(markerContent, rootDirName) {
	const pyprojectMatch = markerContent.match(/^name\s*=\s*["']([^"']+)["']/m);
	if (pyprojectMatch?.[1]) {
		return pyprojectMatch[1];
	}
	return rootDirName;
}

/**
 * Resolves preserved leading prefix for Python files (for example: shebang line).
 * @param {string} _filePath - File path.
 * @param {string} content - File content.
 * @returns {string} Preserved prefix.
 */
function resolvePythonPreservedPrefix(_filePath, content) {
	const shebangMatch = content.match(/^#!.*\bpython(?:\d+(?:\.\d+)*)?\b.*(?:\r?\n|$)/);
	return shebangMatch ? shebangMatch[0] : "";
}

export const detector = {
	id: "python",
	priority: 80,
	markers,
	extensions,
	enabledByDefault: true,
	findNearestConfig(startPath) {
		return findNearestMarker(startPath, markers);
	},
	parseProjectName(_marker, markerContent, rootDirName) {
		return parsePythonProjectName(markerContent, rootDirName);
	},
	resolvePreservedPrefix(filePath, content) {
		return resolvePythonPreservedPrefix(filePath, content);
	},
	resolveCommentSyntax(filePath) {
		const extension = extname(filePath).toLowerCase();
		if (extensions.includes(extension)) {
			return {
				kind: "line",
				linePrefix: "#"
			};
		}
		return null;
	}
};
