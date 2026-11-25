/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: src/detectors/node.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T13:49:52-08:00 (1795643392)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { basename, extname } from "node:path";
import { isShebang } from "./top-lines.mjs";

/**
 * @fileoverview Node.js detector implementation.
 * @module fix-headers/detectors/node
 */

const extensions = [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".tsx", ".jsx"];

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

/**
 * A TypeScript declaration file name (`x.d.ts`, `x.d.mts`, `x.d.cts`), capturing the stem and the
 * declaration extension.
 * @type {RegExp}
 */
const DECLARATION_FILE = /^(.+)\.d\.(ts|mts|cts)$/i;

/**
 * The source extensions `tsc` emits each declaration extension from.
 * @type {Record<string, string[]>}
 */
const DECLARATION_SOURCES = {
	ts: [".ts", ".tsx", ".js", ".jsx"],
	mts: [".mts", ".mjs"],
	cts: [".cts", ".cjs"]
};

/**
 * Reads the `@Filename` value from the comment a file opens with.
 * @param {string} content - File content.
 * @returns {string | null} The `@Filename` value, or null when the file does not open with a comment that has one.
 */
function leadingHeaderFilename(content) {
	const match = /^\s*\/\*[\s\S]*?\*\//.exec(content.replace(/^\uFEFF/, ""));
	if (!match) {
		return null;
	}
	const field = /^[\s*]*@Filename:[ \t]*(\S+)/m.exec(match[0]);
	return field ? field[1] : null;
}

/**
 * Whether a path names a TypeScript declaration file (`.d.ts`, `.d.mts` or `.d.cts`).
 * @param {string} filePath - File path.
 * @returns {boolean} True for a declaration file.
 */
export function isDeclarationFile(filePath) {
	return DECLARATION_FILE.test(basename(filePath));
}

/**
 * Says why a generated declaration file is skipped. `tsc` copies the source file's header into
 * the `.d.ts` / `.d.mts` / `.d.cts` it emits, `@Filename` included, and the source run already
 * maintains that header. Rewriting the copy only makes fix-headers and `tsc` undo each other on
 * every run, so a declaration file whose header names its own source file is left alone. A
 * declaration whose header names any other file (a hand-written one that was moved) is fixed as usual.
 * @param {string} content - File content.
 * @param {string} filePath - File path.
 * @returns {string | null} Skip reason, or null.
 */
export function declarationCopySkipReason(content, filePath) {
	const declaration = DECLARATION_FILE.exec(basename(filePath));
	if (!declaration) {
		return null;
	}
	const named = leadingHeaderFilename(content);
	if (named === null) {
		return null;
	}
	const namedBase = basename(named);
	const [, stem, kind] = declaration;
	const isSourceCopy = DECLARATION_SOURCES[kind.toLowerCase()].some((extension) => namedBase === `${stem}${extension}`);
	return isSourceCopy ? `the file is a declaration generated from ${namedBase} and carries its header (tsc copies it)` : null;
}

export const detector = {
	id: "node",
	extensions,
	enabledByDefault: true,
	// A hashbang (`#!`, any interpreter) is only valid as the first two characters of a
	// JavaScript or TypeScript file.
	keepsAboveHeader: isShebang,
	resolveContentSkipReason(content, filePath) {
		return declarationCopySkipReason(content, filePath);
	},
	resolveCommentSyntax(filePath) {
		return resolveNodeCommentSyntax(filePath);
	}
};
