/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/html.mjs
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
