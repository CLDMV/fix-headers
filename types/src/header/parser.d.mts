/**
 * Splits the text of an existing header block that is not header fields from the fields.
 * `foreign` holds the lines that are neither fields, their wrapped continuations, the
 * separators between them, nor empty lines around them: description text, unknown `@Tag:`
 * lines, a repeated managed tag, a dash line among text. `above` holds, for a line-comment
 * header only, the comment lines directly above the first field with no blank line between
 * (a `# -*- coding -*-` line, `#cloud-config`, a modeline); they are separate comments the
 * header's line match took in, and stay above the header. Lines come back as written
 * (comment prefix included), in their original order, with blank lines between them kept
 * and blank lines around them dropped.
 * @param {string} headerText - The existing header block (every stacked segment).
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {Parameters<typeof findProjectHeader>[2]} [syntaxOptions={}] - Syntax resolution options.
 * @returns {{above: string[], foreign: string[]}} The non-field lines, as written.
 */
export function splitHeaderText(headerText: string, filePath?: string, syntaxOptions?: Parameters<typeof findProjectHeader>[2]): {
    above: string[];
    foreign: string[];
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
 * Replaces or inserts a project header block. Text in the existing header that is not a
 * header field (see {@link splitHeaderText}) is never dropped: with
 * `strictHeaderBlock` (the default) it is written as its own comment block directly below
 * the header, separated from it and from the rest of the file by the margin; with
 * `strictHeaderBlock: false` it stays inside the header, after the fields. Comment lines a
 * line-comment header took in from directly above it stay above it.
 * @param {string} content - Original file content.
 * @param {string} newHeader - Generated header text.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number, margin?: number, strictHeaderBlock?: boolean }} [syntaxOptions={}] - Syntax resolution options.
 * @returns {{nextContent: string, changed: boolean, header: string, written: string}} Updated content result: `header` is the
 * header block as written, and `written` everything that took the old header's place (comment lines kept above the
 * header, the header, and the block of text moved below it).
 */
export function replaceOrInsertHeader(content: string, newHeader: string, filePath?: string, syntaxOptions?: {
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
};
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
export function extractHeaderlessBody(content: string, filePath?: string, syntaxOptions?: {
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
