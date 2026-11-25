/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: src/detectors/c.mjs
 *	@Date: 2026-11-25T08:41:13-08:00 (1795624873)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T13:07:23-08:00 (1795640843)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { extname } from "node:path";

/**
 * @fileoverview C and C++ detector implementation.
 * @module fix-headers/detectors/c
 */

const extensions = [".c", ".h", ".cc", ".cpp", ".cxx", ".hh", ".hpp", ".hxx"];

/**
 * How many lines at the top of a file are read for a third-party license notice.
 * @type {number}
 */
const PROLOGUE_SCAN_LINES = 400;

/**
 * Wording that marks a comment as a license or copyright notice.
 * @type {RegExp}
 */
const LICENSE_NOTICE = /\bcopyright\b|\blicen[cs]e[ds]?\b|SPDX-License-Identifier|\bpublic domain\b/i;

/**
 * A `@Project:` or `@Filename:` field line, which makes a comment a fix-headers header.
 * @type {RegExp}
 */
const HEADER_FIELD = /^[\s*/]*@(?:Project|Filename):/m;

/**
 * Resolves C/C++ comment syntax. The header is a plain `/* … *\/` comment, not `/** … *\/`,
 * so Doxygen does not take it as the documentation of the first declaration below it.
 * @param {string} filePath - File path.
 * @returns {{kind: "block", blockStart: string, blockLinePrefix: string, blockEnd: string} | null} Syntax descriptor.
 */
function resolveCCommentSyntax(filePath) {
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

/**
 * Collects the comments in a C file's prologue: everything before its first line of code.
 * Blank lines, comments and preprocessor directives (with their `\` continuations) belong to
 * the prologue, so a notice below `#define` / `#include` lines is still found, as in the
 * SQLite amalgamation, whose public-domain notice follows a few `#define` lines.
 * @param {string} content - File content.
 * @returns {string[]} Comment texts, in order.
 */
function prologueComments(content) {
	const lines = content
		.replace(/^\uFEFF/, "")
		.split("\n")
		.slice(0, PROLOGUE_SCAN_LINES);
	/** @type {string[]} */
	const comments = [];
	/** @type {string[] | null} */
	let block = null;
	/** @type {string[] | null} */
	let lineRun = null;
	let continued = false;

	for (const rawLine of lines) {
		const line = rawLine.replace(/\r$/, "");
		if (block) {
			block.push(line);
			if (line.includes("*/")) {
				comments.push(block.join("\n"));
				block = null;
			}
			continue;
		}
		if (continued) {
			continued = line.endsWith("\\");
			continue;
		}
		const trimmed = line.trim();
		if (lineRun && !trimmed.startsWith("//")) {
			comments.push(lineRun.join("\n"));
			lineRun = null;
		}
		if (trimmed.length === 0) {
			continue;
		}
		if (trimmed.startsWith("//")) {
			(lineRun ??= []).push(trimmed);
			continue;
		}
		if (trimmed.startsWith("/*")) {
			const closing = trimmed.indexOf("*/", 2);
			if (closing === -1) {
				block = [trimmed];
				continue;
			}
			comments.push(trimmed.slice(0, closing + 2));
			// Code after the comment on the same line ends the prologue.
			if (trimmed.slice(closing + 2).trim().length > 0) {
				break;
			}
			continue;
		}
		if (trimmed.startsWith("#")) {
			continued = trimmed.endsWith("\\");
			continue;
		}
		break;
	}
	if (lineRun) {
		comments.push(lineRun.join("\n"));
	}
	return comments;
}

export const detector = {
	id: "c",
	extensions,
	enabledByDefault: true,
	// Third-party C (a vendored library such as the SQLite amalgamation) carries its own
	// license notice above or between its first preprocessor lines and must stay untouched. A
	// file whose first comment is already a fix-headers header is the project's own.
	resolveContentSkipReason(content) {
		const comments = prologueComments(content);
		if (comments.length > 0 && HEADER_FIELD.test(comments[0])) {
			return null;
		}
		return comments.some((comment) => !HEADER_FIELD.test(comment) && LICENSE_NOTICE.test(comment))
			? "the file starts with a license or copyright notice that is not a fix-headers header (third-party code)"
			: null;
	},
	resolveCommentSyntax(filePath) {
		return resolveCCommentSyntax(filePath);
	}
};
