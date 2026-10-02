/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/python.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:14-07:00 (1790969294)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { extname } from "node:path";

/**
 * @fileoverview Python detector implementation.
 * @module fix-headers/detectors/python
 */

const extensions = [".py"];

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
	extensions,
	enabledByDefault: true,
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
