/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/header/parser.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { DEFAULT_MAX_HEADER_SCAN_LINES } from "../constants.mjs";
import { getPreservedPrefixForFile } from "../detectors/index.mjs";
import { getHeaderSyntaxForFile } from "./syntax.mjs";

/**
 * @fileoverview Header parser utilities for extracting and replacing top-of-file headers.
 * @module fix-headers/header/parser
 */

/**
 * Escapes special regex characters in literal text.
 * @param {string} text - Literal text.
 * @returns {string} Regex-safe text.
 */
function escapeRegex(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits detector-defined preserved prefix from file content when present.
 * @param {string} filePath - File path used for detector selection.
 * @param {string} content - File content.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }> }} [syntaxOptions={}] - Syntax/detector options.
 * @returns {{prefix: string, body: string}} Shebang prefix and remaining body.
 */
function splitPreservedPrefix(filePath, content, syntaxOptions = {}) {
	const prefix = getPreservedPrefixForFile(filePath, content, syntaxOptions);
	if (prefix.length === 0) {
		return { prefix: "", body: content };
	}

	return {
		prefix,
		body: content.slice(prefix.length)
	};
}

/**
 * Matches a top-of-content header block for a given syntax.
 * @param {string} content - Content slice to match from start.
 * @param {{kind: "block" | "line" | "html", linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string}} syntax - Header syntax descriptor.
 * @returns {RegExpMatchArray | null} Matched header segment.
 */
function matchHeaderSegment(content, syntax) {
	if (syntax.kind === "html") {
		const blockStart = escapeRegex(syntax.blockStart || "<!--");
		const blockEnd = escapeRegex(syntax.blockEnd || "-->");
		return content.match(new RegExp(`^${blockStart}[\\s\\S]*?${blockEnd}\\n*`));
	}

	if (syntax.kind === "line") {
		const linePrefix = escapeRegex(syntax.linePrefix || "#");
		return content.match(new RegExp(`^(?:${linePrefix}.*\\n)+\\n*`));
	}

	const blockStart = escapeRegex(syntax.blockStart || "/**");
	const blockEnd = escapeRegex(syntax.blockEnd || " */");
	return content.match(new RegExp(`^${blockStart}[\\s\\S]*?${blockEnd}\\n*`));
}

/**
 * Finds the first top-level project header block in a file.
 * @param {string} content - File content.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }> }} [syntaxOptions={}] - Syntax resolution options.
 * @returns {{start: number, end: number} | null} Header location.
 */
export function findProjectHeader(content, filePath = "", syntaxOptions = {}) {
	const { prefix, body } = splitPreservedPrefix(filePath, content, syntaxOptions);
	const scanLines = body.split("\n").slice(0, DEFAULT_MAX_HEADER_SCAN_LINES).join("\n");
	const syntax = getHeaderSyntaxForFile(filePath, syntaxOptions);
	const match = matchHeaderSegment(scanLines, syntax);

	if (!match) {
		return null;
	}

	let offset = 0;
	let end = 0;
	while (true) {
		const remaining = scanLines.slice(offset);
		const segment = matchHeaderSegment(remaining, syntax);

		if (!segment || !segment[0].includes("@Project:")) {
			break;
		}

		offset += segment[0].length;
		end = offset;
	}

	if (end === 0) {
		return null;
	}

	return {
		start: prefix.length,
		end: prefix.length + end
	};
}

/**
 * Replaces or inserts a project header block.
 * @param {string} content - Original file content.
 * @param {string} newHeader - Generated header text.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }> }} [syntaxOptions={}] - Syntax resolution options.
 * @returns {{nextContent: string, changed: boolean}} Updated content result.
 */
export function replaceOrInsertHeader(content, newHeader, filePath = "", syntaxOptions = {}) {
	const existing = findProjectHeader(content, filePath, syntaxOptions);
	if (!existing) {
		const { prefix, body } = splitPreservedPrefix(filePath, content, syntaxOptions);
		const nextContent = `${prefix}${newHeader}\n\n${body.replace(/^\n+/, "")}`;
		return { nextContent, changed: nextContent !== content };
	}

	const before = content.slice(0, existing.start);
	const after = content.slice(existing.end).replace(/^\n+/, "");
	const nextContent = `${before}${newHeader}\n\n${after}`;
	return { nextContent, changed: nextContent !== content };
}
