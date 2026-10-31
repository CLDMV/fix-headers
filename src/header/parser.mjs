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
 * Splits the part of a file that stays above the header from the rest: a UTF-8 byte order
 * mark, which keeps byte 0, then what the file's detector keeps at the very top (front matter,
 * a shebang, `<?php`, an encoding declaration, a modeline, ...; see getPreservedPrefixForFile).
 * @param {string} filePath - File path used for detector selection.
 * @param {string} content - File content.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number, margin?: number }} [syntaxOptions={}] - Syntax/detector options.
 * @returns {{prefix: string, body: string}} Byte order mark and preserved prefix, and the remaining body.
 */
function splitPreservedPrefix(filePath, content, syntaxOptions = {}) {
	const bom = content.startsWith("\uFEFF") ? "\uFEFF" : "";
	const rest = content.slice(bom.length);
	const prefix = `${bom}${getPreservedPrefixForFile(filePath, rest, syntaxOptions)}`;
	return {
		prefix,
		body: content.slice(prefix.length)
	};
}

/**
 * The line ending of the first line break in a text.
 * @param {string} text - Text to read.
 * @returns {"\r\n" | "\n" | null} The line ending, or null when the text has no line break.
 */
function lineEnding(text) {
	const index = text.indexOf("\n");
	if (index === -1) {
		return null;
	}
	return index > 0 && text[index - 1] === "\r" ? "\r\n" : "\n";
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
		return content.match(new RegExp(`^${blockStart}[\\s\\S]*?${blockEnd}(?:\\r?\\n)*`));
	}

	if (syntax.kind === "line") {
		// `[^\n]`, not `.`: a line of a CRLF file ends in \r, which `.` does not match.
		const linePrefix = escapeRegex(syntax.linePrefix || "#");
		return content.match(new RegExp(`^(?:${linePrefix}[^\\n]*\\n)+(?:\\r?\\n)*`));
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
	return content.match(new RegExp(`^/\\*[\\s\\S]*?${blockEnd}(?:\\r?\\n)*`));
}

/**
 * Header field tags fix-headers writes. A line in a file header carrying one of these is that
 * field, and a repeated tag is a duplicate of it, except `@Copyright`: a `@Copyright` line
 * after the header's own is an additional copyright (see {@link replaceOrInsertHeader}).
 * @type {RegExp}
 */
const MANAGED_TAG = /^@(Project|Filename|Date|Author|Email|Last modified by|Last modified time|Copyright):/;

/**
 * Lead line fix-headers 2.2.3 wrote above a block it moved out of the header when that block
 * started with a `@Project:` line. It is no longer written; when such a block is merged into
 * the header as a copy of it, the lead line is dropped with its fields.
 * @type {string}
 */
const MOVED_BLOCK_LEAD = "Moved out of the file header by fix-headers:";

/**
 * Whether the lines of a comment make it a file header: one of them is a `@Project:` or a
 * `@Filename:` field line.
 * @param {Array<{raw: string, text: string}>} lines - The comment's lines.
 * @returns {boolean} Whether the comment is a file header.
 */
function isFileHeader(lines) {
	return lines.some((line) => /^@(?:Project|Filename):/.test(line.text));
}

/**
 * Splits one matched header segment into its lines, as written, with the comment's own
 * opening and closing delimiters taken off. Text sharing a line with a block opener is
 * given the syntax's block line prefix so it still reads as a line of a block comment.
 * @param {string} segment - One matched header comment (trailing blank lines included).
 * @param {{kind: "block" | "line" | "html", linePrefix?: string, blockLinePrefix?: string}} syntax - Header syntax descriptor.
 * @returns {Array<{raw: string, text: string}>} Each line as written and its text without the comment prefix.
 */
function segmentLines(segment, syntax) {
	const body = segment.replace(/(?:\r?\n)+$/, "");
	if (syntax.kind === "line") {
		const prefix = new RegExp(`^${escapeRegex(syntax.linePrefix || "#")}[ \\t]*`);
		return body.split("\n").map((line) => {
			const raw = line.replace(/\r$/, "");
			return { raw, text: raw.replace(prefix, "").trim() };
		});
	}

	const html = syntax.kind === "html";
	const inner = html ? body.replace(/^<!--/, "").replace(/--!?>\s*$/, "") : body.replace(/^\/\*+/, "").replace(/\*+\/\s*$/, "");
	const linePrefix = syntax.blockLinePrefix || (html ? "\t" : " *\t");
	const strip = html ? /^\s*/ : /^\s*\*?[ \t]*/;
	const lines = inner.split("\n").map((line, index) => {
		const raw = index === 0 && line.trim() !== "" ? `${linePrefix}${line.trim()}` : line.trimEnd();
		return { raw, text: (index === 0 ? line : line.replace(strip, "")).trim() };
	});
	// What is left of the opener's and the closer's own lines is not a line of the comment.
	const first = lines[0].raw === "" ? 1 : 0;
	const last = lines.length > first && lines[lines.length - 1].raw.trim() === "" ? lines.length - 1 : lines.length;
	return lines.slice(first, last);
}

/**
 * Classifies the lines of one comment of a file header. A line is a `field` when it carries a
 * managed tag (a repeated tag is a duplicate of the field), except a `@Copyright` line after the
 * header's own first one, which is a `copyright`; a `separator` when it is a dash line next to
 * a field; `blank` when empty; and `text` otherwise. Text is never deleted, so a line that
 * wraps a field's value is text too.
 * @param {Array<{raw: string, text: string}>} lines - The comment's lines.
 * @param {{copyright: boolean}} state - Whether the header's own `@Copyright` line was seen, in
 * this comment or an earlier one of the same header; updated in place.
 * @returns {Array<"field" | "copyright" | "separator" | "blank" | "text">} One kind per line.
 */
function classifyLines(lines, state) {
	/** @type {Array<"field" | "copyright" | "separator" | "blank" | "text" | "dash">} */
	const kinds = lines.map((line) => {
		const tag = line.text.match(MANAGED_TAG);
		if (line.text === "") {
			return "blank";
		}
		if (tag && tag[1] === "Copyright") {
			if (state.copyright) {
				return "copyright";
			}
			state.copyright = true;
			return "field";
		}
		if (tag) {
			return "field";
		}
		return /^-{3,}$/.test(line.text) ? "dash" : "text";
	});

	/**
	 * Kind of the nearest line in a direction that is neither blank nor a dash line.
	 * @param {number} from - Start index.
	 * @param {number} step - Direction (-1 or 1).
	 * @returns {string | undefined} The neighbour's kind.
	 */
	const neighbour = (from, step) => {
		for (let index = from + step; index >= 0 && index < kinds.length; index += step) {
			if (kinds[index] !== "blank" && kinds[index] !== "dash") {
				return kinds[index] === "copyright" ? "field" : kinds[index];
			}
		}
		return undefined;
	};
	return kinds.map((kind, index) =>
		kind === "dash" ? (neighbour(index, -1) === "field" || neighbour(index, 1) === "field" ? "separator" : "text") : kind
	);
}

/**
 * Splits the text of an existing header block that is not header fields from the fields.
 * `foreign` holds every line that is neither a field, a separator next to a field, nor an
 * empty line around them: description text, unknown `@Tag:` lines, a dash line among text, a
 * line wrapping a field's value. `copyrights` holds the values of the `@Copyright` lines after
 * the header's own. A stacked copy's lead line (see {@link MOVED_BLOCK_LEAD}) is neither.
 * Lines come back as written (comment prefix included), in their original order, with blank
 * lines between them kept (unless a dropped line sat between the two pieces of text) and blank
 * lines around them dropped.
 * @param {string} headerText - The existing header block (every stacked segment).
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {Parameters<typeof findProjectHeader>[2]} [syntaxOptions={}] - Syntax resolution options.
 * @returns {{foreign: string[], copyrights: string[]}} The non-field lines, as written, and the additional copyright values.
 */
export function splitHeaderText(headerText, filePath = "", syntaxOptions = {}) {
	const syntax = getHeaderSyntaxForFile(filePath, syntaxOptions);
	/** @type {Array<{raw: string, kind: string}>} */
	const lines = [];
	/** @type {string[]} */
	const copyrights = [];
	const state = { copyright: false };
	let rest = headerText;
	let segment = matchHeaderSegment(rest, syntax);
	let firstSegment = true;
	while (segment && segment[0].length > 0) {
		const segmentLineList = segmentLines(segment[0], syntax);
		const kinds = classifyLines(segmentLineList, state);
		const lead = segmentLineList.findIndex((line) => line.text !== "");
		if (!firstSegment && lead !== -1 && segmentLineList[lead].text === MOVED_BLOCK_LEAD) {
			// A copy of the header that fix-headers 2.2.3 moved out with a lead line: the lead
			// line is fix-headers' own, and goes with the copy's fields.
			kinds[lead] = "separator";
		}
		segmentLineList.forEach((line, index) => {
			if (kinds[index] === "copyright") {
				copyrights.push(line.text.replace(MANAGED_TAG, "").trim());
			}
			lines.push({ raw: line.raw, kind: kinds[index] });
		});
		rest = rest.slice(segment[0].length);
		segment = matchHeaderSegment(rest, syntax);
		firstSegment = false;
	}

	const first = lines.findIndex((line) => line.kind === "text");
	if (first === -1) {
		return { foreign: [], copyrights };
	}
	const last = lines.map((line) => line.kind).lastIndexOf("text");
	/** @type {string[]} */
	const foreign = [];
	/** @type {string[]} */
	let blanks = [];
	let dropped = false;
	for (const line of lines.slice(first, last + 1)) {
		if (line.kind === "text") {
			// Blank lines between two pieces of text are kept, unless a dropped line (a field,
			// a separator) sat between them: then they were the spacing around that field.
			foreign.push(...(dropped ? [] : blanks), line.raw);
			blanks = [];
			dropped = false;
		} else if (line.kind === "blank") {
			blanks.push(line.raw);
		} else {
			dropped = true;
		}
	}
	return { foreign, copyrights };
}

/**
 * Returns the lines of an existing header block that are not header fields (the `foreign`
 * lines of {@link splitHeaderText}).
 * @param {string} headerText - The existing header block (every stacked segment).
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {Parameters<typeof findProjectHeader>[2]} [syntaxOptions={}] - Syntax resolution options.
 * @returns {string[]} The non-field lines, as written.
 */
export function extractForeignHeaderLines(headerText, filePath = "", syntaxOptions = {}) {
	return splitHeaderText(headerText, filePath, syntaxOptions).foreign;
}

/**
 * Wraps non-field header lines in a comment block of their own, in the file's comment syntax.
 * A line-comment block is the lines themselves. The lines hold no `@Project:` or `@Filename:`
 * field line (every such line is a field), so the block is never a file header and the next
 * run leaves it alone.
 * @param {string[]} lines - Lines as written, comment prefixes included.
 * @param {{kind: "block" | "line" | "html", linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string}} syntax - Header syntax descriptor.
 * @param {string} eol - Line ending to join the block with.
 * @returns {string} The comment block.
 */
function renderForeignBlock(lines, syntax, eol) {
	const html = syntax.kind === "html";
	if (syntax.kind === "line") {
		return lines.join(eol);
	}
	return [syntax.blockStart || (html ? "<!--" : "/**"), ...lines, syntax.blockEnd || (html ? "-->" : " */")].join(eol);
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
 * The holder named by a `@Copyright` value, for comparing two notices: the value without a
 * leading `Copyright`, `(c)` / `©`, the year or year range, and a trailing
 * `All rights reserved.`, with white space collapsed, trailing punctuation dropped and
 * lower-cased. `Copyright (c) 2013-2025 Example Inc. All rights reserved.` and
 * `Copyright (c) 2013-2026 Example Inc. All rights reserved.` name the same holder.
 * @param {string} value - A `@Copyright` value.
 * @returns {string} The holder (empty when the notice names none).
 */
export function copyrightHolder(value) {
	return value
		.replace(/^\s*copyright\b/i, "")
		.replace(/^(?:\s*(?:\(c\)|©))+/i, "")
		.replace(/^\s*\d{4}(?:\s*[-–,]\s*\d{4})*/, "")
		.replace(/\s*all rights reserved\.?\s*$/i, "")
		.replace(/\s+/g, " ")
		.replace(/[\s.,;]+$/, "")
		.trim()
		.toLowerCase();
}

/**
 * Writes additional `@Copyright` lines into a rendered header, directly under its own
 * `@Copyright` line (or under its last field line when it has none), in the same field format.
 * @param {string} header - Rendered header block.
 * @param {string[]} values - Additional copyright values, in order.
 * @returns {string} The header carrying them.
 */
function insertCopyrights(header, values) {
	const lines = header.split("\n");
	const own = lines.findIndex((line) => line.includes("@Copyright:"));
	const lastField = lines.map((line) => /@[A-Za-z][A-Za-z ]*:/.test(line)).lastIndexOf(true);
	const at = own !== -1 ? own : lastField;
	if (values.length === 0 || at === -1) {
		return header;
	}
	const fieldPrefix = lines[at].slice(0, lines[at].indexOf("@"));
	return [...lines.slice(0, at + 1), ...values.map((value) => `${fieldPrefix}@Copyright: ${value}`), ...lines.slice(at + 1)].join("\n");
}

/**
 * Length of the run of file headers (see {@link isFileHeader}), with the blank lines after
 * each, at the start of a text.
 * @param {string} text - Text to read.
 * @param {{kind: "block" | "line" | "html", linePrefix?: string, blockLinePrefix?: string, blockEnd?: string}} syntax - Header syntax descriptor.
 * @returns {number} Length of the run (0 when the text does not start with a file header).
 */
function leadingHeadersLength(text, syntax) {
	let length = 0;
	let segment = matchHeaderSegment(text, syntax);
	while (segment && segment[0].length > 0 && isFileHeader(segmentLines(segment[0], syntax))) {
		length += segment[0].length;
		segment = matchHeaderSegment(text.slice(length), syntax);
	}
	return length;
}

/**
 * Repairs a file an earlier fix-headers version wrote its header above lines that must come
 * first (`<?php`, `@charset`, a shebang, Go build constraints, a modeline, ...; see
 * getPreservedPrefixForFile), or above a byte order mark. The top of the file is read as one
 * run: lines already kept at the top (possibly none), then file headers with blank lines, then
 * lines that would be kept at the top if they directly followed the first ones (or a byte
 * order mark). Those last lines are moved up to join the first ones, in order, and the headers
 * placed after them, where the header is then rewritten as usual. Any other content before
 * those lines leaves the file as it is: nothing is moved up past it.
 * @param {string} content - File content.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {Parameters<typeof findProjectHeader>[2]} [syntaxOptions={}] - Syntax resolution options.
 * @returns {string} The content with the lines back at the top (unchanged when there is nothing to repair).
 */
export function restoreTopLines(content, filePath = "", syntaxOptions = {}) {
	let bom = content.startsWith("\uFEFF") ? "\uFEFF" : "";
	let rest = content.slice(bom.length);
	// The top of the file read as one run: lines already kept at the top, then file headers,
	// then lines that would be kept at the top if they directly followed the first ones.
	const kept = getPreservedPrefixForFile(filePath, rest, syntaxOptions);
	const syntax = getHeaderSyntaxForFile(filePath, syntaxOptions);
	const start = kept.length;
	let headersLength = leadingHeadersLength(rest.slice(start), syntax);
	if (headersLength === 0) {
		return content;
	}
	const movedBom = bom === "" && start === 0 && rest.startsWith("\uFEFF", headersLength);
	if (movedBom) {
		// An earlier version wrote the header above the byte order mark (and, not finding the
		// header after it, left that one in place too): the mark goes back to byte 0, and the
		// header after it is a copy of the header.
		bom = "\uFEFF";
		rest = `${rest.slice(0, headersLength)}${rest.slice(headersLength + 1)}`;
		headersLength += leadingHeadersLength(rest.slice(headersLength), syntax);
	}
	const headers = rest.slice(start, start + headersLength);
	const after = rest.slice(start + headersLength);
	// Whether a line may stay at the top is judged on the joined run (a coding line counts on
	// line 2 directly after a kept shebang).
	const joined = getPreservedPrefixForFile(filePath, `${kept}${after}`, syntaxOptions);
	const top = joined.length > kept.length ? joined.slice(kept.length) : "";
	if (top === "" && !movedBom) {
		return content;
	}
	const topLines = top === "" || top.endsWith("\n") ? top : `${top}${lineEnding(content) ?? "\n"}`;
	return `${bom}${kept}${topLines}${headers}${after.slice(top.length)}`;
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

		// The header is the file's first comment when it is a file header (a @Project: or a
		// @Filename: field line); every file header stacked directly after it is a copy of it.
		if (!segment || !isFileHeader(segmentLines(segment[0], syntax))) {
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
 * Replaces or inserts a project header block. The existing header is the file's first comment
 * (after what stays above it, see {@link splitPreservedPrefix}) when it is a file header, plus
 * every file header stacked directly after it, which are copies of it: their fields are
 * replaced by the new header's. Text in them that is not a header field (see
 * {@link splitHeaderText}) is never dropped: with `strictHeaderBlock` (the default) it is
 * written as its own comment block directly below the header, separated from it and from the
 * rest of the file by the margin; with `strictHeaderBlock: false` it stays inside the header,
 * after the fields. A `@Copyright` line after the header's own that names the same holder as
 * the new header's (see {@link copyrightHolder}) is a duplicate and dropped; one naming another
 * holder is kept as an additional `@Copyright` field under the new header's, in order, and
 * reported in `extraCopyrights`.
 * @param {string} original - Original file content.
 * @param {string} newHeader - Generated header text.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number, margin?: number, strictHeaderBlock?: boolean }} [syntaxOptions={}] - Syntax resolution options.
 * @returns {{nextContent: string, changed: boolean, header: string, written: string, extraCopyrights: string[]}} Updated
 * content result: `header` is the header block as written, `written` everything that took the old header's place (the
 * header and the block of text moved below it), and `extraCopyrights` the additional copyright values the header keeps.
 */
export function replaceOrInsertHeader(original, newHeader, filePath = "", syntaxOptions = {}) {
	// A header an earlier version wrote above lines that must come first goes back below them.
	const content = restoreTopLines(original, filePath, syntaxOptions);
	const existing = findProjectHeader(content, filePath, syntaxOptions);
	const syntax = getHeaderSyntaxForFile(filePath, syntaxOptions);
	// A line-comment header needs one blank line after it, or the comment that follows would read as part of it.
	const configuredMargin = resolveLayoutCount(syntaxOptions.margin, "margin", DEFAULT_HEADER_MARGIN);
	const margin = syntax.kind === "line" ? Math.max(1, configuredMargin) : configuredMargin;
	/**
	 * Writes text in the file's line ending.
	 * @param {string} text - Text with \n line breaks.
	 * @param {string} eol - The file's line ending.
	 * @returns {string} The text with that line ending.
	 */
	const withEol = (text, eol) => (eol === "\n" ? text : text.replace(/\r?\n/g, eol));
	if (!existing) {
		const { prefix, body } = splitPreservedPrefix(filePath, content, syntaxOptions);
		// A new header takes the line ending the file already uses.
		const eol = lineEnding(content) ?? "\n";
		const header = withEol(newHeader, eol);
		const rest = body.replace(/^(?:\r?\n)+/, "");
		// A kept top line that ends the file without a line break still needs one before the header.
		const joiner = prefix.replace(/^\uFEFF/, "") !== "" && !prefix.endsWith("\n") ? eol : "";
		// With nothing after the header there is no next content to separate from, so the file just ends with the header.
		const nextContent = `${prefix}${joiner}${rest.trim() === "" ? `${header}${eol}` : `${header}${eol.repeat(margin + 1)}${rest}`}`;
		return { nextContent, changed: nextContent !== original, header, written: header, extraCopyrights: [] };
	}

	const region = content.slice(existing.start, existing.end);
	const { foreign, copyrights } = splitHeaderText(region, filePath, syntaxOptions);
	const ownCopyright = newHeader.match(/@Copyright:[ \t]*(.*?)[ \t]*$/m);
	const holders = new Set(ownCopyright ? [copyrightHolder(ownCopyright[1])] : []);
	/** @type {string[]} */
	const extraCopyrights = [];
	for (const value of copyrights) {
		const holder = copyrightHolder(value);
		if (!holders.has(holder)) {
			holders.add(holder);
			extraCopyrights.push(value);
		}
	}
	// The header is written in the line ending of the content after it (the file's own), so a
	// CRLF file stays CRLF, and a header an earlier run wrote with \n in a CRLF file is repaired.
	const eol = lineEnding(content.slice(existing.end)) ?? lineEnding(region) ?? "\n";
	const gap = eol.repeat(margin + 1);
	const strict = syntaxOptions.strictHeaderBlock !== false;
	const fields = insertCopyrights(newHeader, extraCopyrights);
	const header = withEol(foreign.length > 0 && !strict ? appendToHeader(fields, foreign, syntax) : fields, eol);
	const moved = foreign.length > 0 && strict ? renderForeignBlock(foreign, syntax, eol) : "";
	const after = content.slice(existing.end).replace(/^(?:\r?\n)+/, "");
	const below = moved === "" ? after : `${moved}${after.trim() === "" ? eol : `${gap}${after}`}`;
	const nextContent = `${content.slice(0, existing.start)}${below.trim() === "" ? `${header}${eol}` : `${header}${gap}${below}`}`;
	// What took the old header's place: the header and the block moved below it.
	const written = `${header}${moved === "" ? "" : `${gap}${moved}`}`;
	return { nextContent, changed: nextContent !== original, header, written, extraCopyrights };
}

/**
 * Returns a file's content with its project header taken out: the file as it would read
 * with no header at all. Blank lines between the header and the next content, and a body
 * that is only whitespace, are dropped, so two versions of a file that differ only in their
 * header (its fields, framing, spacing or margin, or whether it has one) give the same body.
 * @param {string} original - File content.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number, margin?: number }} [syntaxOptions={}] - Syntax resolution options.
 * @returns {string} The content outside the header.
 */
export function extractHeaderlessBody(original, filePath = "", syntaxOptions = {}) {
	// Read a file an earlier version left with its header above lines that must come first as
	// it reads once repaired, so the repair is not a content edit.
	const content = restoreTopLines(original, filePath, syntaxOptions);
	const existing = findProjectHeader(content, filePath, syntaxOptions);
	if (existing) {
		// Non-field text in the header counts as content, read as if it sat in its own block
		// below the header, so moving it out (strictHeaderBlock) is not a content edit.
		const prefix = content.slice(0, existing.start);
		const written = replaceOrInsertHeader(content, "", filePath, { ...syntaxOptions, strictHeaderBlock: true }).nextContent.slice(
			prefix.length
		);
		const rest = written.replace(/^(?:\r?\n)+/, "");
		return `${prefix}${rest.trim() === "" ? "" : rest}`;
	}
	const { prefix, body } = splitPreservedPrefix(filePath, content, syntaxOptions);
	const rest = body.replace(/^(?:\r?\n)+/, "");
	return `${prefix}${rest.trim() === "" ? "" : rest}`;
}
