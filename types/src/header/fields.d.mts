/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/header/fields.mjs
 *	@Date: 2026-09-28T09:14:18-07:00 (1790612058)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28T09:14:18-07:00 (1790612058)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
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
export declare const HEADER_FIELDS: ReadonlyArray<HeaderFieldName>;
export type HeaderFieldName = "projectName" | "filename" | "createdAt" | "authorName" | "authorEmail" | "lastModifiedByName" | "lastModifiedByEmail" | "lastModifiedAt" | "copyrightStartYear" | "copyrightEndYear" | "companyName";
export type HeaderFields = Record<HeaderFieldName, string | null>;
export type HeaderFieldIssue = {
    field: HeaderFieldName;
    previous: string | null;
    detected: string | null;
};
/**
 * Parses every known field out of a header block. Values are the text as written in
 * the header (dates keep their `date (timestamp)` form); a field that is missing or
 * cannot be parsed is `null`.
 * @param {string} headerText - Header block text.
 * @returns {HeaderFields} Parsed field values.
 */
export declare function parseHeaderFields(headerText: string): HeaderFields;
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
export declare function compareHeaderFields(previousHeader: string | null, nextHeader: string): HeaderFieldIssue[];
