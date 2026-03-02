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
