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
export function splitHeaderText(headerText: string, filePath?: string, syntaxOptions?: Parameters<typeof findProjectHeader>[2]): {
    foreign: string[];
    copyrights: string[];
};
/**
 * Returns the lines of an existing header block that are not header fields (the `foreign`
 * lines of {@link splitHeaderText}).
 * @param {string} headerText - The existing header block (every stacked segment).
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {Parameters<typeof findProjectHeader>[2]} [syntaxOptions={}] - Syntax resolution options.
 * @returns {string[]} The non-field lines, as written.
 */
export function extractForeignHeaderLines(headerText: string, filePath?: string, syntaxOptions?: Parameters<typeof findProjectHeader>[2]): string[];
/**
 * The holder named by a `@Copyright` value, for comparing two notices: the value without a
 * leading `Copyright`, `(c)` / `©`, the year or year range, and a trailing
 * `All rights reserved.`, with white space collapsed, trailing punctuation dropped and
 * lower-cased. `Copyright (c) 2013-2025 Example Inc. All rights reserved.` and
 * `Copyright (c) 2013-2026 Example Inc. All rights reserved.` name the same holder.
 * @param {string} value - A `@Copyright` value.
 * @returns {string} The holder (empty when the notice names none).
 */
export function copyrightHolder(value: string): string;
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
export function restoreTopLines(content: string, filePath?: string, syntaxOptions?: Parameters<typeof findProjectHeader>[2]): string;
/**
 * Finds the first top-level project header block in a file.
 * @param {string} content - File content.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number, margin?: number }} [syntaxOptions={}] - Syntax resolution options.
 * @returns {{start: number, end: number} | null} Header location.
 */
export function findProjectHeader(content: string, filePath?: string, syntaxOptions?: {
    language?: string;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    forcedDetectors?: string[];
    detectorSyntaxOverrides?: Record<string, {
        linePrefix?: string;
        lineSeparator?: string;
        blockStart?: string;
        blockLinePrefix?: string;
        blockEnd?: string;
    }>;
    spacing?: number;
    margin?: number;
}): {
    start: number;
    end: number;
} | null;
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
export function replaceOrInsertHeader(original: string, newHeader: string, filePath?: string, syntaxOptions?: {
    language?: string;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    forcedDetectors?: string[];
    detectorSyntaxOverrides?: Record<string, {
        linePrefix?: string;
        lineSeparator?: string;
        blockStart?: string;
        blockLinePrefix?: string;
        blockEnd?: string;
    }>;
    spacing?: number;
    margin?: number;
    strictHeaderBlock?: boolean;
}): {
    nextContent: string;
    changed: boolean;
    header: string;
    written: string;
    extraCopyrights: string[];
};
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
export function extractHeaderlessBody(original: string, filePath?: string, syntaxOptions?: {
    language?: string;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    forcedDetectors?: string[];
    detectorSyntaxOverrides?: Record<string, {
        linePrefix?: string;
        lineSeparator?: string;
        blockStart?: string;
        blockLinePrefix?: string;
        blockEnd?: string;
    }>;
    spacing?: number;
    margin?: number;
}): string;
