/**
 * @fileoverview Header comment syntax helpers for mapping file extensions to comment styles.
 * @module fix-headers/header/syntax
 */
/**
 * @typedef {{
 *  kind: "block" | "line" | "html",
 *  linePrefix?: string,
 *  lineSeparator?: string,
 *  blockStart?: string,
 *  blockLinePrefix?: string,
 *  blockEnd?: string,
 *  spacing?: number
 * }} HeaderSyntax
 */
/**
 * Resolves comment syntax for a file path based on extension.
 * @param {string} filePath - Absolute or relative file path.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number }} [options={}] - Syntax resolution options. `spacing` is the number of empty comment lines just inside the header's opening and closing (default 1).
 * @returns {HeaderSyntax} Header syntax descriptor.
 */
export function getHeaderSyntaxForFile(filePath: string, options?: {
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
}): HeaderSyntax;
/**
 * Renders header body lines using a chosen syntax. `syntax.spacing` empty comment lines (default 1) sit
 * just inside the opening and just before the closing delimiter, or a bare comment-prefix line above
 * and below a line-comment header.
 * @param {HeaderSyntax} syntax - Header syntax descriptor.
 * @param {string[]} lines - Header lines without comment wrappers.
 * @returns {string} Formatted header block.
 */
export function renderHeaderLines(syntax: HeaderSyntax, lines: string[]): string;
export type HeaderSyntax = {
    kind: "block" | "line" | "html";
    linePrefix?: string;
    lineSeparator?: string;
    blockStart?: string;
    blockLinePrefix?: string;
    blockEnd?: string;
    spacing?: number;
};
