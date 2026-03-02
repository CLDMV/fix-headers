import { DEFAULT_MAX_HEADER_SCAN_LINES } from "../constants.mjs";
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
 * Finds the first top-level project header block in a file.
 * @param {string} content - File content.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }> }} [syntaxOptions={}] - Syntax resolution options.
 * @returns {{start: number, end: number} | null} Header location.
 */
export function findProjectHeader(content, filePath = "", syntaxOptions = {}) {
	const scanLines = content.split("\n").slice(0, DEFAULT_MAX_HEADER_SCAN_LINES).join("\n");
	const syntax = getHeaderSyntaxForFile(filePath, syntaxOptions);

	let match = null;
	if (syntax.kind === "html") {
		const blockStart = escapeRegex(syntax.blockStart || "<!--");
		const blockEnd = escapeRegex(syntax.blockEnd || "-->");
		match = scanLines.match(new RegExp(`^${blockStart}[\\s\\S]*?${blockEnd}\\n*`));
	} else if (syntax.kind === "line") {
		const linePrefix = escapeRegex(syntax.linePrefix || "#");
		match = scanLines.match(new RegExp(`^(?:${linePrefix}.*\\n)+\\n*`));
	} else {
		const blockStart = escapeRegex(syntax.blockStart || "/**");
		const blockEnd = escapeRegex(syntax.blockEnd || " */");
		match = scanLines.match(new RegExp(`^${blockStart}[\\s\\S]*?${blockEnd}\\n*`));
	}

	if (!match) {
		return null;
	}

	if (!match[0].includes("@Project:")) {
		return null;
	}

	return {
		start: 0,
		end: match[0].length
	};
}

/**
 * Replaces or inserts a project header block.
 * @param {string} content - Original file content.
 * @param {string} newHeader - Generated header text.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }> }} [syntaxOptions={}] - Syntax resolution options.
 * @returns {{nextContent: string, changed: boolean}} Updated content result.
 */
export function replaceOrInsertHeader(content, newHeader, filePath = "", syntaxOptions = {}) {
	const existing = findProjectHeader(content, filePath, syntaxOptions);
	if (!existing) {
		const nextContent = `${newHeader}\n\n${content.replace(/^\n+/, "")}`;
		return { nextContent, changed: nextContent !== content };
	}

	const before = content.slice(0, existing.start);
	const after = content.slice(existing.end).replace(/^\n+/, "");
	const nextContent = `${before}${newHeader}\n\n${after}`;
	return { nextContent, changed: nextContent !== content };
}
