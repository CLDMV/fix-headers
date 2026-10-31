/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/header/parser.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:50:30-07:00 (1791093030)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { DEFAULT_HEADER_MARGIN, DEFAULT_MAX_HEADER_SCAN_LINES, resolveLayoutCount } from "../constants.mjs";
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
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number, margin?: number }} [syntaxOptions={}] - Syntax/detector options.
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

	// Block comments (/* … */ family). A block comment opens with `/*` and is
	// terminated by the FIRST `*/` after the opener (block comments do not nest in
	// JS/JSONC/CSS/PHP). Match that real grammar rather than the detector's *styled*
	// tokens: `blockStart` may be `/*` or `/**` (so anchor on `/*`, which prefixes
	// both), and `blockEnd` carries a leading space (" */") that exists for GENERATION
	// only. Using the styled " */" to bound an EXISTING header is the data-loss bug —
	// any real closer that isn't byte-for-byte " */" (e.g. `**/`, a tab-indented `*/`,
	// or `*/` at column 0) is skipped, so the lazy match runs on to the next `*/`
	// downstream (inside a `//` line comment, a string literal, or another block) and
	// everything in between is deleted on replace. Trim the styled space off so we stop
	// at the header's own terminator.
	const blockEnd = escapeRegex((syntax.blockEnd || " */").trim());
	return content.match(new RegExp(`^/\\*[\\s\\S]*?${blockEnd}\\n*`));
}

/**
 * Header field tags fix-headers writes. A header line holding one of these, a `-----`
 * separator, or nothing is part of the managed header; any other line is text the header
 * block merely carries (see {@link extractForeignHeaderLines}).
 * @type {RegExp}
 */
const MANAGED_HEADER_LINE = /^(?:@(?:Project|Filename|Date|Author|Email|Last modified by|Last modified time|Copyright):.*|-{3,})?$/;

/**
 * Splits one matched header segment into its lines, as written, with the comment's own
 * opening and closing delimiters taken off. Text sharing a line with a block opener is
 * given the syntax's block line prefix so it still reads as a line of a block comment.
 * @param {string} segment - One matched header comment (trailing blank lines included).
 * @param {{kind: "block" | "line" | "html", linePrefix?: string, blockLinePrefix?: string}} syntax - Header syntax descriptor.
 * @returns {Array<{raw: string, text: string}>} Each line as written and its text without the comment prefix.
 */
function segmentLines(segment, syntax) {
	const body = segment.replace(/\n+$/, "");
	if (syntax.kind === "line") {
		const prefix = new RegExp(`^${escapeRegex(syntax.linePrefix || "#")}[ \\t]*`);
		return body.split("\n").map((raw) => ({ raw, text: raw.replace(prefix, "").trim() }));
	}

	const html = syntax.kind === "html";
	const inner = html ? body.replace(/^<!--/, "").replace(/--!?>\s*$/, "") : body.replace(/^\/\*+/, "").replace(/\*+\/\s*$/, "");
	const linePrefix = syntax.blockLinePrefix || (html ? "\t" : " *\t");
	const strip = html ? /^\s*/ : /^\s*\*?[ \t]*/;
	const lines = inner.split("\n").map((line, index) => {
		const raw = index === 0 && line.trim() !== "" ? `${linePrefix}${line.trim()}` : line.trimEnd();
		return { raw, text: (index === 0 ? line.trim() : line.replace(strip, "")).trim() };
	});
	// What is left of the opener's and the closer's own lines is not a line of the comment.
	const first = lines[0].raw === "" ? 1 : 0;
	const last = lines.length > first && lines[lines.length - 1].raw.trim() === "" ? lines.length - 1 : lines.length;
	return lines.slice(first, last);
}

/**
 * Returns the lines of an existing header block that are not header fields: description
 * text and anything else the block carries besides the fields fix-headers writes, the
 * `-----` separators and empty lines. Lines come back as written (comment prefix included),
 * in their original order, with blank lines between them kept and blank lines around them
 * dropped. Unknown `@Tag:` lines count as such text. Empty when the block holds only fields.
 * @param {string} headerText - The existing header block (every stacked segment).
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {Parameters<typeof findProjectHeader>[2]} [syntaxOptions={}] - Syntax resolution options.
 * @returns {string[]} The non-field lines, as written.
 */
export function extractForeignHeaderLines(headerText, filePath = "", syntaxOptions = {}) {
	const syntax = getHeaderSyntaxForFile(filePath, syntaxOptions);
	/** @type {Array<{raw: string, text: string}>} */
	const lines = [];
	let rest = headerText;
	let segment = matchHeaderSegment(rest, syntax);
	while (segment && segment[0].length > 0) {
		lines.push(...segmentLines(segment[0], syntax));
		rest = rest.slice(segment[0].length);
		segment = matchHeaderSegment(rest, syntax);
	}

	const foreign = lines.map((line) => !MANAGED_HEADER_LINE.test(line.text));
	const first = foreign.indexOf(true);
	if (first === -1) {
		return [];
	}
	const last = foreign.lastIndexOf(true);
	return lines
		.slice(first, last + 1)
		.filter((line) => line.text === "" || !MANAGED_HEADER_LINE.test(line.text))
		.map((line) => line.raw);
}

/**
 * Wraps non-field header lines in a comment block of their own, in the file's comment syntax.
 * A line-comment block is the lines themselves.
 * @param {string[]} lines - Lines as written, comment prefixes included.
 * @param {{kind: "block" | "line" | "html", blockStart?: string, blockEnd?: string}} syntax - Header syntax descriptor.
 * @returns {string} The comment block.
 */
function renderForeignBlock(lines, syntax) {
	if (syntax.kind === "line") {
		return lines.join("\n");
	}
	const html = syntax.kind === "html";
	return [syntax.blockStart || (html ? "<!--" : "/**"), ...lines, syntax.blockEnd || (html ? "-->" : " */")].join("\n");
}

/**
 * Places non-field lines inside a rendered header, after its fields: an empty comment line,
 * then the lines, then the header's closing spacing and delimiter.
 * @param {string} header - Rendered header block.
 * @param {string[]} lines - Lines as written, comment prefixes included.
 * @param {{kind: "block" | "line" | "html", linePrefix?: string, blockLinePrefix?: string, spacing?: number}} syntax - Header syntax descriptor.
 * @returns {string} The header carrying the lines.
 */
function appendToHeader(header, lines, syntax) {
	const headerLines = header.split("\n");
	const html = syntax.kind === "html";
	const empty = syntax.kind === "line" ? syntax.linePrefix || "#" : (syntax.blockLinePrefix || (html ? "\t" : " *\t")).trimEnd();
	const tail = Math.min(headerLines.length - 1, (syntax.spacing ?? 1) + (syntax.kind === "line" ? 0 : 1));
	const at = headerLines.length - tail;
	return [...headerLines.slice(0, at), empty, ...lines, ...headerLines.slice(at)].join("\n");
}

/**
 * Finds the first top-level project header block in a file.
 * @param {string} content - File content.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number, margin?: number }} [syntaxOptions={}] - Syntax resolution options.
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
 * Replaces or inserts a project header block. Text in the existing header that is not a
 * header field (see {@link extractForeignHeaderLines}) is never dropped: with
 * `strictHeaderBlock` (the default) it is written as its own comment block directly below
 * the header, separated from it and from the rest of the file by the margin; with
 * `strictHeaderBlock: false` it stays inside the header, after the fields.
 * @param {string} content - Original file content.
 * @param {string} newHeader - Generated header text.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number, margin?: number, strictHeaderBlock?: boolean }} [syntaxOptions={}] - Syntax resolution options.
 * @returns {{nextContent: string, changed: boolean, header: string}} Updated content result; `header` is the header block as written.
 */
export function replaceOrInsertHeader(content, newHeader, filePath = "", syntaxOptions = {}) {
	const existing = findProjectHeader(content, filePath, syntaxOptions);
	const syntax = getHeaderSyntaxForFile(filePath, syntaxOptions);
	// A line-comment header needs one blank line after it, or the comment that follows would read as part of it.
	const configuredMargin = resolveLayoutCount(syntaxOptions.margin, "margin", DEFAULT_HEADER_MARGIN);
	const margin = syntax.kind === "line" ? Math.max(1, configuredMargin) : configuredMargin;
	const gap = "\n".repeat(margin + 1);
	if (!existing) {
		const { prefix, body } = splitPreservedPrefix(filePath, content, syntaxOptions);
		const rest = body.replace(/^\n+/, "");
		// With nothing after the header there is no next content to separate from, so the file just ends with the header.
		const nextContent = `${prefix}${rest.trim() === "" ? `${newHeader}\n` : `${newHeader}${gap}${rest}`}`;
		return { nextContent, changed: nextContent !== content, header: newHeader };
	}

	const foreign = extractForeignHeaderLines(content.slice(existing.start, existing.end), filePath, syntaxOptions);
	const strict = syntaxOptions.strictHeaderBlock !== false;
	const header = foreign.length > 0 && !strict ? appendToHeader(newHeader, foreign, syntax) : newHeader;
	const after = content.slice(existing.end).replace(/^\n+/, "");
	const below =
		foreign.length > 0 && strict ? `${renderForeignBlock(foreign, syntax)}${after.trim() === "" ? "\n" : `${gap}${after}`}` : after;
	const nextContent = `${content.slice(0, existing.start)}${below.trim() === "" ? `${header}\n` : `${header}${gap}${below}`}`;
	return { nextContent, changed: nextContent !== content, header };
}

/**
 * Returns a file's content with its project header taken out: the file as it would read
 * with no header at all. Blank lines between the header and the next content, and a body
 * that is only whitespace, are dropped, so two versions of a file that differ only in their
 * header (its fields, framing, spacing or margin, or whether it has one) give the same body.
 * @param {string} content - File content.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number, margin?: number }} [syntaxOptions={}] - Syntax resolution options.
 * @returns {string} The content outside the header.
 */
export function extractHeaderlessBody(content, filePath = "", syntaxOptions = {}) {
	const existing = findProjectHeader(content, filePath, syntaxOptions);
	if (existing) {
		// Non-field text in the header counts as content, read as if it sat in its own block
		// below the header, so moving it out (strictHeaderBlock) is not a content edit.
		const prefix = content.slice(0, existing.start);
		const written = replaceOrInsertHeader(content, "", filePath, { ...syntaxOptions, strictHeaderBlock: true }).nextContent.slice(
			prefix.length
		);
		const rest = written.replace(/^\n+/, "");
		return `${prefix}${rest.trim() === "" ? "" : rest}`;
	}
	const { prefix, body } = splitPreservedPrefix(filePath, content, syntaxOptions);
	const rest = body.replace(/^\n+/, "");
	return `${prefix}${rest.trim() === "" ? "" : rest}`;
}
