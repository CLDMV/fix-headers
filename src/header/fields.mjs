/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/header/fields.mjs
 *	@Date: 2026-09-28T09:14:18-07:00 (1790612058)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:16-07:00 (1790969296)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Parses the individual fields back out of a rendered header block and
 * compares two header blocks field by field.
 * @module fix-headers/header/fields
 */

/**
 * Header field identifiers, in the order they appear in a rendered header.
 * @type {ReadonlyArray<HeaderFieldName>}
 */
export const HEADER_FIELDS = Object.freeze([
	"projectName",
	"filename",
	"createdAt",
	"authorName",
	"authorEmail",
	"lastModifiedByName",
	"lastModifiedByEmail",
	"lastModifiedAt",
	"copyrightStartYear",
	"copyrightEndYear",
	"companyName"
]);

/**
 * @typedef {"projectName" | "filename" | "createdAt" | "authorName" | "authorEmail" | "lastModifiedByName" | "lastModifiedByEmail" | "lastModifiedAt" | "copyrightStartYear" | "copyrightEndYear" | "companyName"} HeaderFieldName
 */

/**
 * @typedef {Record<HeaderFieldName, string | null>} HeaderFields
 */

/**
 * @typedef {{ field: HeaderFieldName, previous: string | null, detected: string | null }} HeaderFieldIssue
 */

/**
 * Reads the trimmed text after a `@Label:` tag.
 * @param {string} headerText - Header block text.
 * @param {string} label - Tag label without the `@` and trailing colon.
 * @returns {string | null} Tag value, or null when the tag is absent or empty.
 */
function readTag(headerText, label) {
	const match = headerText.match(new RegExp(`@${label}:[ \\t]*(.*)$`, "m"));
	const value = match ? match[1].trim() : "";
	return value.length > 0 ? value : null;
}

/**
 * Splits a `Name (email)` last-modified-by value into its parts.
 * @param {string | null} value - Raw `@Last modified by` value.
 * @returns {{ name: string | null, email: string | null }} Identity parts.
 */
function splitLastModifiedBy(value) {
	if (value === null) {
		return { name: null, email: null };
	}

	// String scan rather than a regex: the email is the "(...)" group that closes the value,
	// opening at the first "(" after any earlier ")". Same result as /^(.*?)\s*\(([^)]*)\)$/
	// without that pattern's polynomial backtracking on long runs of spaces or "(".
	if (!value.endsWith(")")) {
		return { name: value, email: null };
	}
	const body = value.slice(0, -1);
	const open = body.indexOf("(", body.lastIndexOf(")") + 1);
	if (open === -1) {
		return { name: value, email: null };
	}

	return { name: body.slice(0, open).trimEnd() || null, email: body.slice(open + 1) || null };
}

/**
 * Splits a copyright notice into its year range and company name.
 * @param {string | null} value - Raw `@Copyright` value.
 * @returns {{ startYear: string | null, endYear: string | null, companyName: string | null }} Copyright parts.
 */
function splitCopyright(value) {
	const none = { startYear: null, endYear: null, companyName: null };
	// Only anchored, unambiguous regex pieces plus string checks for the tail: a single
	// regex with the optional year range and a lazy company before "All rights reserved"
	// backtracks polynomially on long runs of spaces.
	const start = value?.match(/^Copyright\s+\(c\)\s+(\d{4})/i);
	if (!start) {
		return none;
	}
	let rest = value.slice(start[0].length);
	const range = rest.match(/^\s*-\s*(\d{4})/);
	if (range) {
		rest = rest.slice(range[0].length);
	}

	const lower = rest.toLowerCase();
	const suffix = lower.endsWith("all rights reserved.") ? 20 : lower.endsWith("all rights reserved") ? 19 : 0;
	if (suffix === 0 || !/^\s/.test(rest)) {
		return none;
	}

	return {
		startYear: start[1],
		endYear: range ? range[1] : null,
		companyName: rest.slice(0, -suffix).trim() || null
	};
}

/**
 * Parses every known field out of a header block. Values are the text as written in
 * the header (dates keep their `date (timestamp)` form); a field that is missing or
 * cannot be parsed is `null`.
 * @param {string} headerText - Header block text.
 * @returns {HeaderFields} Parsed field values.
 */
export function parseHeaderFields(headerText) {
	const lastModifiedBy = splitLastModifiedBy(readTag(headerText, "Last modified by"));
	const copyright = splitCopyright(readTag(headerText, "Copyright"));
	const email = readTag(headerText, "Email");

	return {
		projectName: readTag(headerText, "Project"),
		filename: readTag(headerText, "Filename"),
		createdAt: readTag(headerText, "Date"),
		authorName: readTag(headerText, "Author"),
		authorEmail: email === null ? null : email.replace(/^<(.*)>$/, "$1"),
		lastModifiedByName: lastModifiedBy.name,
		lastModifiedByEmail: lastModifiedBy.email,
		lastModifiedAt: readTag(headerText, "Last modified time"),
		copyrightStartYear: copyright.startYear,
		copyrightEndYear: copyright.endYear,
		companyName: copyright.companyName
	};
}

/**
 * Compares an existing header with the header written by this run, field by field.
 * Both sides are parsed with {@link parseHeaderFields}, so a field only appears when
 * the written value really differs from what the file had. Values fix-headers
 * preserves (the original author and last-modified identity, unless forced) therefore
 * show up only when they actually change.
 * @param {string | null} previousHeader - Existing header text, or null when the file had none.
 * @param {string} nextHeader - Header text written by this run.
 * @returns {HeaderFieldIssue[]} One entry per differing field, in header order.
 */
export function compareHeaderFields(previousHeader, nextHeader) {
	const previous = parseHeaderFields(previousHeader ?? "");
	const detected = parseHeaderFields(nextHeader);

	return HEADER_FIELDS.filter((field) => previous[field] !== detected[field]).map((field) => ({
		field,
		previous: previous[field],
		detected: detected[field]
	}));
}
