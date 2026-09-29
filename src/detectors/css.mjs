/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/css.mjs
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
import { findNearestMarker, parsePackageJsonName } from "./shared.mjs";

/**
 * @fileoverview CSS detector implementation.
 * @module fix-headers/detectors/css
 */

const markers = ["package.json", "postcss.config.js", "postcss.config.cjs", "postcss.config.mjs"];
const extensions = [".css"];

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
	// CSS lives in the project it belongs to: take the name from its package.json, like the
	// Node detector; a postcss config alone carries no name, so the folder name is used then.
	parseProjectName(marker, markerContent, rootDirName) {
		return marker === "package.json" ? parsePackageJsonName(markerContent, rootDirName) : rootDirName;
	},
	resolveCommentSyntax(filePath) {
		return resolveCssCommentSyntax(filePath);
	}
};
