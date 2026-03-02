import { extname } from "node:path";
import { findNearestMarker } from "./shared.mjs";

/**
 * @fileoverview CSS detector implementation.
 * @module fix-headers/detectors/css
 */

const markers = ["package.json", "postcss.config.js", "postcss.config.cjs", "postcss.config.mjs"];
const extensions = [".css"];

/**
 * Parses CSS project name from marker context.
 * @param {string} rootDirName - Fallback directory name.
 * @returns {string} Project name.
 */
function parseCssProjectName(rootDirName) {
	return rootDirName;
}

/**
 * Resolves block comment syntax for CSS files.
 * @param {string} filePath - File path.
 * @returns {{kind: "block", blockStart: string, blockLinePrefix: string, blockEnd: string} | null} Syntax descriptor.
 */
function resolveCssCommentSyntax(filePath) {
	const extension = extname(filePath).toLowerCase();
	if (extensions.includes(extension)) {
		return {
			kind: "block",
			blockStart: "/*",
			blockLinePrefix: " *\t",
			blockEnd: " */"
		};
	}
	return null;
}

export const detector = {
	id: "css",
	priority: 70,
	markers,
	extensions,
	enabledByDefault: true,
	findNearestConfig(startPath) {
		return findNearestMarker(startPath, markers);
	},
	parseProjectName(_marker, _markerContent, rootDirName) {
		return parseCssProjectName(rootDirName);
	},
	resolveCommentSyntax(filePath) {
		return resolveCssCommentSyntax(filePath);
	}
};
