import { extname } from "node:path";
import { getCommentSyntaxForFile } from "../detectors/index.mjs";

/**
 * @fileoverview Header comment syntax helpers for mapping file extensions to comment styles.
 * @module fix-headers/header/syntax
 */

/**
 * @typedef {{
 *  kind: "block" | "line" | "html",
 *  linePrefix?: string,
 *  blockStart?: string,
 *  blockLinePrefix?: string,
 *  blockEnd?: string
 * }} HeaderSyntax
 */

/**
 * Resolves comment syntax for a file path based on extension.
 * @param {string} filePath - Absolute or relative file path.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }> }} [options={}] - Syntax resolution options.
 * @returns {HeaderSyntax} Header syntax descriptor.
 */
export function getHeaderSyntaxForFile(filePath, options = {}) {
	const extension = extname(filePath).toLowerCase();
	if (extension.length === 0) {
		return { kind: "block", blockStart: "/**", blockLinePrefix: " *\t", blockEnd: " */" };
	}

	return getCommentSyntaxForFile(filePath, options);
}

/**
 * Renders header body lines using a chosen syntax.
 * @param {HeaderSyntax} syntax - Header syntax descriptor.
 * @param {string[]} lines - Header lines without comment wrappers.
 * @returns {string} Formatted header block.
 */
export function renderHeaderLines(syntax, lines) {
	if (syntax.kind === "line") {
		return lines.map((line) => `${syntax.linePrefix || "#"}\t${line}`).join("\n");
	}

	const blockStart = syntax.blockStart || (syntax.kind === "html" ? "<!--" : "/**");
	const blockLinePrefix = syntax.blockLinePrefix || (syntax.kind === "html" ? "\t" : " *\t");
	const blockEnd = syntax.blockEnd || (syntax.kind === "html" ? "-->" : " */");

	if (syntax.kind === "html") {
		return `${blockStart}\n${lines.map((line) => `${blockLinePrefix}${line}`).join("\n")}\n${blockEnd}`;
	}

	return `${blockStart}\n${lines.map((line) => `${blockLinePrefix}${line}`).join("\n")}\n${blockEnd}`;
}
