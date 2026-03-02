import { extname } from "node:path";
import { findNearestMarker } from "./shared.mjs";

/**
 * @fileoverview HTML detector implementation.
 * @module fix-headers/detectors/html
 */

const markers = ["index.html", "vite.config.js", "vite.config.mjs", "next.config.js", "next.config.mjs"];
const extensions = [".html", ".htm"];

/**
 * Parses HTML project name from marker context.
 * @param {string} rootDirName - Fallback directory name.
 * @returns {string} Project name.
 */
function parseHtmlProjectName(rootDirName) {
	return rootDirName;
}

/**
 * Resolves HTML comment syntax for HTML-like files.
 * @param {string} filePath - File path.
 * @returns {{kind: "html", blockStart: string, blockLinePrefix: string, blockEnd: string} | null} Syntax descriptor.
 */
function resolveHtmlCommentSyntax(filePath) {
	const extension = extname(filePath).toLowerCase();
	if (extensions.includes(extension)) {
		return {
			kind: "html",
			blockStart: "<!--",
			blockLinePrefix: "\t",
			blockEnd: "-->"
		};
	}
	return null;
}

export const detector = {
	id: "html",
	priority: 70,
	markers,
	extensions,
	enabledByDefault: true,
	findNearestConfig(startPath) {
		return findNearestMarker(startPath, markers);
	},
	parseProjectName(_marker, _markerContent, rootDirName) {
		return parseHtmlProjectName(rootDirName);
	},
	resolveCommentSyntax(filePath) {
		return resolveHtmlCommentSyntax(filePath);
	}
};
