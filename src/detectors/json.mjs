/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/json.mjs
 *	@Date: 2026-03-01T20:00:00-08:00 (1772424000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:13-07:00 (1790969293)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { extname } from "node:path";

/**
 * @fileoverview JSON-family detector implementation.
 * @module fix-headers/detectors/json
 */

const extensions = [".jsonv", ".jsonc", ".json5"];

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
	extensions,
	enabledByDefault: true,
	resolveCommentSyntax(filePath) {
		return resolveJsonCommentSyntax(filePath);
	}
};
