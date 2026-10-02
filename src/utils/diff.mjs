/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/utils/diff.mjs
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
export function diffLines(previous, next) {
	const rows = previous.length;
	const columns = next.length;
	/** @type {number[][]} */
	const table = Array.from({ length: rows + 1 }, () => new Array(columns + 1).fill(0));

	for (let row = rows - 1; row >= 0; row -= 1) {
		for (let column = columns - 1; column >= 0; column -= 1) {
			table[row][column] =
				previous[row] === next[column] ? table[row + 1][column + 1] + 1 : Math.max(table[row + 1][column], table[row][column + 1]);
		}
	}

	/** @type {DiffOperation[]} */
	const operations = [];
	let row = 0;
	let column = 0;
	while (row < rows && column < columns) {
		if (previous[row] === next[column]) {
			operations.push({ type: " ", line: previous[row] });
			row += 1;
			column += 1;
		} else if (table[row + 1][column] >= table[row][column + 1]) {
			operations.push({ type: "-", line: previous[row] });
			row += 1;
		} else {
			operations.push({ type: "+", line: next[column] });
			column += 1;
		}
	}
	for (; row < rows; row += 1) {
		operations.push({ type: "-", line: previous[row] });
	}
	for (; column < columns; column += 1) {
		operations.push({ type: "+", line: next[column] });
	}

	return operations;
}

/**
 * Formats one side of a hunk range (`start,count`). An empty range points at the line
 * before it, as `diff -u` does.
 * @param {number} linesBefore - Lines on this side that precede the hunk.
 * @param {number} count - Lines on this side inside the hunk.
 * @returns {string} Range text.
 */
function formatRange(linesBefore, count) {
	return `${count === 0 ? linesBefore : linesBefore + 1},${count}`;
}

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
export function createUnifiedDiff(previous, next, options = {}) {
	const previousLines = previous === null ? [] : previous.split("\n");
	const nextLines = next.split("\n");
	const operations = diffLines(previousLines, nextLines);
	const context = Math.max(0, options.context ?? 3);
	const lineOffset = options.lineOffset ?? 0;

	/** @type {Array<{ first: number, last: number }>} */
	const groups = [];
	operations.forEach((operation, index) => {
		if (operation.type === " ") {
			return;
		}
		const current = groups[groups.length - 1];
		if (current && index - current.last <= context * 2 + 1) {
			current.last = index;
		} else {
			groups.push({ first: index, last: index });
		}
	});

	if (groups.length === 0) {
		return "";
	}

	const fromFile = options.fromFile ?? "a";
	const toFile = options.toFile ?? "b";
	const output = [`--- ${previous === null ? "/dev/null" : fromFile}`, `+++ ${toFile}`];

	for (const group of groups) {
		const start = Math.max(0, group.first - context);
		const end = Math.min(operations.length, group.last + context + 1);
		const before = operations.slice(0, start);
		const hunk = operations.slice(start, end);
		const previousBefore = before.filter((operation) => operation.type !== "+").length + lineOffset;
		const nextBefore = before.filter((operation) => operation.type !== "-").length + lineOffset;
		const previousCount = hunk.filter((operation) => operation.type !== "+").length;
		const nextCount = hunk.filter((operation) => operation.type !== "-").length;

		output.push(`@@ -${formatRange(previousBefore, previousCount)} +${formatRange(nextBefore, nextCount)} @@`);
		for (const operation of hunk) {
			output.push(`${operation.type}${operation.line}`);
		}
	}

	return output.join("\n");
}
