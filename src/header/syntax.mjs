/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/header/syntax.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:16-07:00 (1790969296)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { extname } from "node:path";
import { getCommentSyntaxForFile } from "../detectors/index.mjs";
import { DEFAULT_HEADER_SPACING, resolveLayoutCount } from "../constants.mjs";

/**
 * @fileoverview Header comment syntax helpers for mapping file extensions to comment styles.
 * @module fix-headers/header/syntax
 */

/**
 * @typedef {{
 *  kind: "block" | "line" | "html",
 *  linePrefix?: string,
 *  lineSeparator?: string,
 *  blockStart?: string,
 *  blockLinePrefix?: string,
 *  blockEnd?: string,
 *  spacing?: number
 * }} HeaderSyntax
 */

/**
 * Resolves comment syntax for a file path based on extension.
 * @param {string} filePath - Absolute or relative file path.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number }} [options={}] - Syntax resolution options. `spacing` is the number of empty comment lines just inside the header's opening and closing (default 1).
 * @returns {HeaderSyntax} Header syntax descriptor.
 */
export function getHeaderSyntaxForFile(filePath, options = {}) {
	const extension = extname(filePath).toLowerCase();
	const spacing = resolveLayoutCount(options.spacing, "spacing", DEFAULT_HEADER_SPACING);
	if (extension.length === 0) {
		return { kind: "block", blockStart: "/**", blockLinePrefix: " *\t", blockEnd: " */", spacing };
	}

	return { ...getCommentSyntaxForFile(filePath, options), spacing };
}

/**
 * Renders header body lines using a chosen syntax. `syntax.spacing` empty comment lines (default 1) sit
 * just inside the opening and just before the closing delimiter, or a bare comment-prefix line above
 * and below a line-comment header.
 * @param {HeaderSyntax} syntax - Header syntax descriptor.
 * @param {string[]} lines - Header lines without comment wrappers.
 * @returns {string} Formatted header block.
 */
export function renderHeaderLines(syntax, lines) {
	const spacing = syntax.spacing ?? DEFAULT_HEADER_SPACING;

	if (syntax.kind === "line") {
		const linePrefix = syntax.linePrefix || "#";
		const lineSeparator = typeof syntax.lineSeparator === "string" ? syntax.lineSeparator : "\t";
		const empty = Array.from({ length: spacing }, () => linePrefix);
		return [...empty, ...lines.map((line) => `${linePrefix}${lineSeparator}${line}`), ...empty].join("\n");
	}

	const blockStart = syntax.blockStart || (syntax.kind === "html" ? "<!--" : "/**");
	const blockLinePrefix = syntax.blockLinePrefix || (syntax.kind === "html" ? "\t" : " *\t");
	const blockEnd = syntax.blockEnd || (syntax.kind === "html" ? "-->" : " */");
	const empty = Array.from({ length: spacing }, () => blockLinePrefix.trimEnd());

	return [blockStart, ...empty, ...lines.map((line) => `${blockLinePrefix}${line}`), ...empty, blockEnd].join("\n");
}
