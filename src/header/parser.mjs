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
 * Header field tags fix-headers writes. The first line in a header comment carrying one of
 * these is that field; a later line with the same tag is text the block carries (a second
 * `@Copyright` notice, say), never a field.
 * @type {RegExp}
 */
const MANAGED_TAG = /^@(Project|Filename|Date|Author|Email|Last modified by|Last modified time|Copyright):/;

/**
 * Comment lines that must keep their place at the top of a file (`#cloud-config`, a
 * `yaml-language-server` modeline, a `vim:` / `vi:` / `ex:` editor modeline). Found directly
 * above the first field of a line-comment header, they stay above it.
 * @type {RegExp}
 */
const DIRECTIVE_LINE = /^#cloud-config\b|^#\s*yaml-language-server:|^#\s+(?:vim?|ex):/;

/**
 * A PEP 263 encoding declaration (`# -*- coding: utf-8 -*-`, `# coding=utf-8`), which only
 * counts on the first or second line of a file. `coding` must start a word, so prose such as
 * `Decoding: base64` is not one.
 * @type {RegExp}
 */
const CODING_LINE = /^#.*?(?<![A-Za-z])coding[:=]\s*[-\w.]+/;

/**
 * Lead line of a block moved out of the header whose own first line is a `@Project:` line,
 * so that the block never reads as a stacked header (see {@link findProjectHeader}).
 * @type {string}
 */
const MOVED_BLOCK_LEAD = "Moved out of the file header by fix-headers:";

/**
 * Whether a header comment that follows the file's header is a stacked copy of a header:
 * its first non-empty line is a `@Project:` field.
 * @param {string} segment - The following comment.
 * @param {{kind: "block" | "line" | "html", linePrefix?: string, blockLinePrefix?: string}} syntax - Header syntax descriptor.
 * @returns {boolean} Whether it starts with `@Project:`.
 */
function isStackedHeader(segment, syntax) {
	const first = segmentLines(segment, syntax).find((line) => line.text !== "");
	return first !== undefined && first.text.startsWith("@Project:");
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
 * Classifies the lines of one header comment. A line is a `field` when it carries a managed
 * tag not seen earlier in the same comment, a `separator` when it is a dash line next to a
 * field, `blank` when empty, and `text` otherwise. Text is never deleted, so a line that
 * wraps a field's value is text too.
 * @param {Array<{raw: string, text: string}>} lines - The comment's lines.
 * @returns {Array<"field" | "separator" | "blank" | "text">} One kind per line.
 */
function classifyLines(lines) {
	const seen = new Set();
	/** @type {Array<"field" | "separator" | "blank" | "text" | "dash">} */
	const kinds = lines.map((line) => {
		const tag = line.text.match(MANAGED_TAG);
		if (line.text === "") {
			return "blank";
		}
		if (tag && !seen.has(tag[1])) {
			seen.add(tag[1]);
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
				return kinds[index];
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
 * empty line around them: description text, unknown `@Tag:` lines, a repeated managed tag,
 * a dash line among text, a line wrapping a field's value. `above` holds, for a line-comment
 * header only, the directive lines at the top of the comment (a `# -*- coding -*-` line,
 * `#cloud-config`, a `yaml-language-server` or `vim:` modeline); they are separate comments
 * the header's line match took in, and stay above the header. Lines come back as written
 * (comment prefix included), in their original order, with blank lines between them kept
 * and blank lines around them dropped.
 * @param {string} headerText - The existing header block (every stacked segment).
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {Parameters<typeof findProjectHeader>[2]} [syntaxOptions={}] - Syntax resolution options.
 * @param {number} [firstLine=0] - Zero-based line number of the header's first line in the file
 * (an encoding declaration only counts on the file's first two lines).
 * @returns {{above: string[], foreign: string[]}} The non-field lines, as written.
 */
export function splitHeaderText(headerText, filePath = "", syntaxOptions = {}, firstLine = 0) {
	const syntax = getHeaderSyntaxForFile(filePath, syntaxOptions);
	/** @type {string[]} */
	const above = [];
	/** @type {Array<{raw: string, kind: string}>} */
	const lines = [];
	let rest = headerText;
	let segment = matchHeaderSegment(rest, syntax);
	let firstSegment = true;
	while (segment && segment[0].length > 0) {
		const segmentLineList = segmentLines(segment[0], syntax);
		const kinds = classifyLines(segmentLineList);
		let start = 0;
		if (firstSegment && syntax.kind === "line") {
			// Directive lines at the very top of the comment are separate comments the header's
			// line match took in; they keep their place above the header.
			const isDirective = (index) =>
				DIRECTIVE_LINE.test(segmentLineList[index].raw) || (firstLine + index <= 1 && CODING_LINE.test(segmentLineList[index].raw));
			while (start < segmentLineList.length && kinds[start] === "text" && isDirective(start)) {
				above.push(segmentLineList[start].raw);
				start += 1;
			}
		}
		segmentLineList.slice(start).forEach((line, index) => lines.push({ raw: line.raw, kind: kinds[start + index] }));
		rest = rest.slice(segment[0].length);
		segment = matchHeaderSegment(rest, syntax);
		firstSegment = false;
	}

	const first = lines.findIndex((line) => line.kind === "text");
	if (first === -1) {
		return { above, foreign: [] };
	}
	const last = lines.map((line) => line.kind).lastIndexOf("text");
	const foreign = lines
		.slice(first, last + 1)
		.filter((line) => line.kind === "text" || line.kind === "blank")
		.map((line) => line.raw);
	return { above, foreign };
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
 * A line-comment block is the lines themselves. When the first line is a `@Project:` line, a
 * lead line comes first so the block never reads as a stacked header.
 * @param {string[]} lines - Lines as written, comment prefixes included.
 * @param {{kind: "block" | "line" | "html", linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string}} syntax - Header syntax descriptor.
 * @param {string} eol - Line ending to join the block with.
 * @returns {string} The comment block.
 */
function renderForeignBlock(lines, syntax, eol) {
	const html = syntax.kind === "html";
	const linePrefix =
		syntax.kind === "line"
			? `${syntax.linePrefix || "#"}${typeof syntax.lineSeparator === "string" ? syntax.lineSeparator : "\t"}`
			: syntax.blockLinePrefix || (html ? "\t" : " *\t");
	// A block whose first line is a @Project: line would read as a stacked header on the next
	// run and its lines would be taken for fields: a lead line keeps it a plain comment.
	const strip = syntax.kind === "line" ? new RegExp(`^${escapeRegex(syntax.linePrefix || "#")}[ \\t]*`) : html ? /^\s*/ : /^\s*\*?[ \t]*/;
	const firstText = lines.map((line) => line.replace(strip, "").trim()).find((text) => text !== "");
	const leadsWithProject = firstText !== undefined && firstText.startsWith("@Project:");
	const body = leadsWithProject ? [`${linePrefix}${MOVED_BLOCK_LEAD}`, ...lines] : lines;
	if (syntax.kind === "line") {
		return body.join(eol);
	}
	return [syntax.blockStart || (html ? "<!--" : "/**"), ...body, syntax.blockEnd || (html ? "-->" : " */")].join(eol);
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

		// The header itself is the first comment carrying @Project:; a comment after it is a
		// stacked copy only when it starts with @Project:.
		if (!segment || !(offset === 0 ? segment[0].includes("@Project:") : isStackedHeader(segment[0], syntax))) {
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
 * header field (see {@link splitHeaderText}) is never dropped: with
 * `strictHeaderBlock` (the default) it is written as its own comment block directly below
 * the header, separated from it and from the rest of the file by the margin; with
 * `strictHeaderBlock: false` it stays inside the header, after the fields. Directive lines a
 * line-comment header took in from directly above it stay above it.
 * @param {string} content - Original file content.
 * @param {string} newHeader - Generated header text.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number, margin?: number, strictHeaderBlock?: boolean }} [syntaxOptions={}] - Syntax resolution options.
 * @returns {{nextContent: string, changed: boolean, header: string, written: string}} Updated content result: `header` is the
 * header block as written, and `written` everything that took the old header's place (comment lines kept above the
 * header, the header, and the block of text moved below it).
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
		return { nextContent, changed: nextContent !== content, header: newHeader, written: newHeader };
	}

	const region = content.slice(existing.start, existing.end);
	const { above, foreign } = splitHeaderText(region, filePath, syntaxOptions, content.slice(0, existing.start).split("\n").length - 1);
	const eol = region.includes("\r\n") ? "\r\n" : "\n";
	const strict = syntaxOptions.strictHeaderBlock !== false;
	const header = foreign.length > 0 && !strict ? appendToHeader(newHeader, foreign, syntax) : newHeader;
	const lead = above.length > 0 ? `${above.join(eol)}${eol}` : "";
	const moved = foreign.length > 0 && strict ? renderForeignBlock(foreign, syntax, eol) : "";
	const after = content.slice(existing.end).replace(moved === "" ? /^\n+/ : /^(?:\r?\n)+/, "");
	const below = moved === "" ? after : `${moved}${after.trim() === "" ? eol : `${gap.replace(/\n/g, eol)}${after}`}`;
	const nextContent = `${content.slice(0, existing.start)}${lead}${below.trim() === "" ? `${header}\n` : `${header}${gap}${below}`}`;
	// What took the old header's place: lines kept above it, the header, and the block moved below it.
	const written = `${lead}${header}${moved === "" ? "" : `${gap}${moved}`}`;
	return { nextContent, changed: nextContent !== content, header, written };
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
