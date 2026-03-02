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
	resolveCommentSyntax(filePath) {
		return resolveNodeCommentSyntax(filePath);
	}
};
