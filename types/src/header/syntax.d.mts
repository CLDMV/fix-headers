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
export function getHeaderSyntaxForFile(filePath: string, options?: {
    language?: string;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    detectorSyntaxOverrides?: Record<string, {
        linePrefix?: string;
        blockStart?: string;
        blockLinePrefix?: string;
        blockEnd?: string;
    }>;
}): HeaderSyntax;
/**
 * Renders header body lines using a chosen syntax.
 * @param {HeaderSyntax} syntax - Header syntax descriptor.
 * @param {string[]} lines - Header lines without comment wrappers.
 * @returns {string} Formatted header block.
 */
export function renderHeaderLines(syntax: HeaderSyntax, lines: string[]): string;
export type HeaderSyntax = {
    kind: "block" | "line" | "html";
    linePrefix?: string;
    blockStart?: string;
    blockLinePrefix?: string;
    blockEnd?: string;
};
