/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/go.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
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
import { isModeline, takeTopLines } from "./top-lines.mjs";

/**
 * @fileoverview Go detector implementation.
 * @module fix-headers/detectors/go
 */

const extensions = [".go"];

/**
 * Resolves Go comment syntax.
 * @param {string} filePath - File path.
 * @returns {{kind: "block", blockStart: string, blockLinePrefix: string, blockEnd: string} | null} Syntax descriptor.
 */
function resolveGoCommentSyntax(filePath) {
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
 * A build constraint line: `//go:build <expr>` or the older `// +build <tags>`.
 * @type {RegExp}
 */
const BUILD_CONSTRAINT = /^\/\/(?:go:build|\s*\+build)\s/;

/**
 * Resolves the build constraints at the very top of a Go file, with the blank lines after
 * them. A `// +build` line only counts when nothing but blank lines and `//` comments come
 * before it and a blank line follows it, so the constraints and that blank line stay above
 * the header.
 * @param {string} _filePath - File path.
 * @param {string} content - File content.
 * @returns {string} Preserved prefix.
 */
function resolveGoPreservedPrefix(_filePath, content) {
	const lines = takeTopLines(content, (line) => BUILD_CONSTRAINT.test(line) || isModeline(line));
	if (!lines.split(/\r?\n/).some((line) => BUILD_CONSTRAINT.test(line))) {
		return "";
	}
	const rest = content.slice(lines.length);
	return `${lines}${rest.slice(0, rest.length - rest.replace(/^(?:[ \t]*\r?\n)*/, "").length)}`;
}

export const detector = {
	id: "go",
	extensions,
	enabledByDefault: true,
	resolvePreservedPrefix(filePath, content) {
		return resolveGoPreservedPrefix(filePath, content);
	},
	resolveCommentSyntax(filePath) {
		return resolveGoCommentSyntax(filePath);
	}
};
