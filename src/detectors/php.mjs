/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/php.mjs
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
 * @fileoverview PHP detector implementation.
 * @module fix-headers/detectors/php
 */

const markers = ["composer.json"];
const extensions = [".php"];

/**
 * Resolves PHP comment syntax.
 * @param {string} filePath - File path.
 * @returns {{kind: "block", blockStart: string, blockLinePrefix: string, blockEnd: string} | null} Syntax descriptor.
 */
function resolvePhpCommentSyntax(filePath) {
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
	id: "php",
	priority: 80,
	markers,
	extensions,
	enabledByDefault: true,
	findNearestConfig(startPath) {
		return findNearestMarker(startPath, markers);
	},
	parseProjectName(_marker, markerContent, rootDirName) {
		try {
			const parsed = JSON.parse(markerContent);
			if (typeof parsed.name === "string" && parsed.name.trim().length > 0) {
				return parsed.name.trim();
			}
			return rootDirName;
		} catch {
			return rootDirName;
		}
	},
	resolveCommentSyntax(filePath) {
		return resolvePhpCommentSyntax(filePath);
	}
};
