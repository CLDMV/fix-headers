/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/php.mjs
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
 * @fileoverview PHP detector implementation.
 * @module fix-headers/detectors/php
 */

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

/**
 * The PHP opening tag at the start of a file, with the rest of its line.
 * @type {RegExp}
 */
const OPENING_TAG = /^<\?php(?:\s|$)/i;

export const detector = {
	id: "php",
	extensions,
	enabledByDefault: true,
	// Everything before `<?php` is output as text, so the opening tag's line stays first and the
	// header goes inside the PHP code after it.
	keepsAboveHeader: (line, index) => index === 0 && OPENING_TAG.test(line),
	resolveContentSkipReason(content) {
		return OPENING_TAG.test(content.replace(/^\uFEFF/, ""))
			? null
			: "the file does not start with <?php, so a comment at the top would be output as text";
	},
	resolveCommentSyntax(filePath) {
		return resolvePhpCommentSyntax(filePath);
	}
};
