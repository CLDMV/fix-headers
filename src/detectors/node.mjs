/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/node.mjs
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
import { isShebang } from "./top-lines.mjs";

/**
 * @fileoverview Node.js detector implementation.
 * @module fix-headers/detectors/node
 */

const extensions = [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"];

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
	extensions,
	enabledByDefault: true,
	// A hashbang (`#!`, any interpreter) is only valid as the first two characters of a
	// JavaScript or TypeScript file.
	keepsAboveHeader: isShebang,
	resolveCommentSyntax(filePath) {
		return resolveNodeCommentSyntax(filePath);
	}
};
