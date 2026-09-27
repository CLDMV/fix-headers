/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/header/syntax.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */
export type HeaderSyntax = {
    kind: "block" | "line" | "html";
    linePrefix?: string;
    lineSeparator?: string;
    blockStart?: string;
    blockLinePrefix?: string;
    blockEnd?: string;
};
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
 *  blockEnd?: string
 * }} HeaderSyntax
 */
/**
 * Resolves comment syntax for a file path based on extension.
 * @param {string} filePath - Absolute or relative file path.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }> }} [options={}] - Syntax resolution options.
 * @returns {HeaderSyntax} Header syntax descriptor.
 */
export declare function getHeaderSyntaxForFile(filePath: string, options?: {
    language?: string;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    detectorSyntaxOverrides?: Record<string, {
        linePrefix?: string;
        lineSeparator?: string;
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
export declare function renderHeaderLines(syntax: HeaderSyntax, lines: string[]): string;
