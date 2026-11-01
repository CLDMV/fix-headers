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
import { isShebang } from "./top-lines.mjs";

/**
 * @fileoverview Python detector implementation.
 * @module fix-headers/detectors/python
 */

const extensions = [".py"];

/**
 * A PEP 263 encoding declaration (`# -*- coding: utf-8 -*-`, `# coding=utf-8`). `coding` must
 * start a word, so prose such as `Decoding: base64` is not one.
 * @type {RegExp}
 */
const CODING_LINE = /^#.*?(?<![A-Za-z])coding[:=]\s*[-\w.]+/;

/**
 * Whether a line at the top of a Python file keeps its place above the header: a shebang on
 * line 1, or a PEP 263 encoding declaration on line 1 or 2 (Python reads it nowhere else).
 * @param {string} line - The line.
 * @param {number} index - Zero-based line number.
 * @returns {boolean} Whether the line stays above the header.
 */
function keepsAboveHeader(line, index) {
	return isShebang(line, index) || (index <= 1 && CODING_LINE.test(line));
}

export const detector = {
	id: "python",
	extensions,
	enabledByDefault: true,
	keepsAboveHeader,
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
