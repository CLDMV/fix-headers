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

/**
 * @fileoverview CSS detector implementation.
 * @module fix-headers/detectors/css
 */

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
	extensions,
	enabledByDefault: true,
	resolveCommentSyntax(filePath) {
		return resolveCssCommentSyntax(filePath);
	}
};
