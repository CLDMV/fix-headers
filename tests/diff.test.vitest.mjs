/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/diff.test.vitest.mjs
 *	@Date: 2026-09-28T09:14:18-07:00 (1790612058)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28T09:14:18-07:00 (1790612058)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, expect, it } from "vitest";
import { createUnifiedDiff, diffLines } from "../src/utils/diff.mjs";

describe("diffLines", () => {
	it("keeps common lines and marks removals before additions", () => {
		expect(diffLines(["a", "b", "c"], ["a", "x", "c"])).toEqual([
			{ type: " ", line: "a" },
			{ type: "-", line: "b" },
			{ type: "+", line: "x" },
			{ type: " ", line: "c" }
		]);
	});

	it("emits trailing removals and additions once one side runs out", () => {
		expect(diffLines(["a", "b", "c"], ["a"])).toEqual([
			{ type: " ", line: "a" },
			{ type: "-", line: "b" },
			{ type: "-", line: "c" }
		]);
		expect(diffLines(["a"], ["a", "b"])).toEqual([
			{ type: " ", line: "a" },
			{ type: "+", line: "b" }
		]);
	});

	it("prefers an addition when that keeps a longer common subsequence", () => {
		expect(diffLines(["b"], ["a", "b"])).toEqual([
			{ type: "+", line: "a" },
			{ type: " ", line: "b" }
		]);
	});
});

describe("createUnifiedDiff", () => {
	it("returns an empty string for identical text", () => {
		expect(createUnifiedDiff("same\ntext", "same\ntext")).toBe("");
	});

	it("labels files and writes one hunk with three lines of context", () => {
		const previous = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].join("\n");
		const next = ["1", "2", "3", "4", "five", "6", "7", "8", "9"].join("\n");

		expect(createUnifiedDiff(previous, next, { fromFile: "a/x.mjs", toFile: "b/x.mjs" })).toBe(
			["--- a/x.mjs", "+++ b/x.mjs", "@@ -2,7 +2,7 @@", " 2", " 3", " 4", "-5", "+five", " 6", " 7", " 8"].join("\n")
		);
	});

	it("uses default labels and shifts hunk line numbers by lineOffset", () => {
		expect(createUnifiedDiff("old", "new", { lineOffset: 1 })).toBe(["--- a", "+++ b", "@@ -2,1 +2,1 @@", "-old", "+new"].join("\n"));
	});

	it("diffs against /dev/null when there was no previous text", () => {
		expect(createUnifiedDiff(null, "one\ntwo", { toFile: "b/new.mjs" })).toBe(
			["--- /dev/null", "+++ b/new.mjs", "@@ -0,0 +1,2 @@", "+one", "+two"].join("\n")
		);
		expect(createUnifiedDiff(null, "one", { lineOffset: 1 })).toContain("@@ -1,0 +2,1 @@");
	});

	it("points an empty new range at the preceding line", () => {
		expect(createUnifiedDiff("keep\ndrop", "keep", { context: 0 })).toBe(["--- a", "+++ b", "@@ -2,1 +1,0 @@", "-drop"].join("\n"));
	});

	it("splits distant changes into separate hunks and merges close ones", () => {
		const previous = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`);
		const distant = [...previous];
		distant[1] = "changed 2";
		distant[17] = "changed 18";
		const distantDiff = createUnifiedDiff(previous.join("\n"), distant.join("\n"));
		expect(distantDiff.match(/^@@/gm)).toHaveLength(2);
		expect(distantDiff).toContain("@@ -1,5 +1,5 @@");
		expect(distantDiff).toContain("@@ -15,6 +15,6 @@");

		const close = [...previous];
		close[1] = "changed 2";
		close[8] = "changed 9";
		const closeDiff = createUnifiedDiff(previous.join("\n"), close.join("\n"));
		expect(closeDiff.match(/^@@/gm)).toHaveLength(1);
		expect(closeDiff).toContain("@@ -1,12 +1,12 @@");
	});

	it("clamps a negative context to zero", () => {
		expect(createUnifiedDiff("a\nb\nc", "a\nx\nc", { context: -5 })).toBe(["--- a", "+++ b", "@@ -2,1 +2,1 @@", "-b", "+x"].join("\n"));
	});
});
