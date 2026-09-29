/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/utils/diff.mjs
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
 * @fileoverview Minimal line-level unified diff for header blocks. Header blocks are a
 * handful of lines, so a plain longest-common-subsequence table is fast enough and keeps
 * the package free of a runtime diff dependency.
 * @module fix-headers/utils/diff
 */
/**
 * @typedef {{ type: " " | "-" | "+", line: string }} DiffOperation
 */
/**
 * Computes the line operations that turn `previous` into `next`.
 * @param {string[]} previous - Old lines.
 * @param {string[]} next - New lines.
 * @returns {DiffOperation[]} Ordered keep/remove/add operations.
 */
export function diffLines(previous: string[], next: string[]): DiffOperation[];
/**
 * Builds a unified diff between two texts.
 * @param {string | null} previous - Old text, or null when there was none.
 * @param {string} next - New text.
 * @param {{
 *  fromFile?: string,
 *  toFile?: string,
 *  context?: number,
 *  lineOffset?: number
 * }} [options={}] - `fromFile`/`toFile` label the `---`/`+++` lines (a null `previous`
 * labels the old side `/dev/null`); `context` is the number of unchanged lines kept
 * around each change (default 3); `lineOffset` is the number of file lines that precede
 * both texts, so hunk line numbers match the file.
 * @returns {string} Unified diff text, or an empty string when the texts are identical.
 */
export function createUnifiedDiff(previous: string | null, next: string, options?: {
    fromFile?: string;
    toFile?: string;
    context?: number;
    lineOffset?: number;
}): string;
export type DiffOperation = {
    type: " " | "-" | "+";
    line: string;
};
