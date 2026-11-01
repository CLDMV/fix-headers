/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/header-regex-timing.test.vitest.mjs
 *	@Date: 2026-10-31T12:00:00-07:00 (1793473200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-31T12:00:00-07:00 (1793473200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, expect, it } from "vitest";
import { isModeline } from "../src/detectors/top-lines.mjs";
import { copyrightHolder, replaceOrInsertHeader } from "../src/header/parser.mjs";
import { hasAngleTag, trimTrailingSlashes } from "../src/utils/text.mjs";

/**
 * @fileoverview Inputs shaped like the polynomial-backtracking cases CodeQL reported on #162
 * (long runs of white space with no match after them) are read in linear time, with the same
 * results as short inputs.
 */

const RUN = 50_000;
const SPACES = " ".repeat(RUN);
const TABS = "\t".repeat(RUN);

/**
 * Runs a function and returns its result, failing when it takes a second or more.
 * @template T
 * @param {() => T} run - The work.
 * @returns {T} Its result.
 */
function fast(run) {
	const started = performance.now();
	const result = run();
	expect(performance.now() - started).toBeLessThan(1000);
	return result;
}

describe("regular expressions stay linear on long white space (#162)", () => {
	it("reads a copyright holder with long runs of spaces or tabs and no notice words after them", () => {
		expect(fast(() => copyrightHolder(`a${SPACES}b`))).toBe("a b");
		expect(fast(() => copyrightHolder(`a${TABS}b`))).toBe("a b");
		expect(fast(() => copyrightHolder(`Copyright (c) 2020${SPACES}-${TABS}x`))).toBe("- x");
		expect(fast(() => copyrightHolder(`Example Inc${SPACES}All rights reserved${TABS}.`))).toBe("example inc all rights reserved");
		expect(fast(() => copyrightHolder(`Example Inc.${SPACES}All rights reserved.`))).toBe("example inc");
		expect(fast(() => copyrightHolder(`${SPACES}.${TABS}`))).toBe("");
	});

	it("reads the new header's @Copyright with a long run of tabs after the tag", () => {
		const content =
			"/**\n *\t@Project: demo\n *\t@Copyright: Copyright (c) 2020 Example Inc.\n *\t@Copyright: Copyright (c) 2010 Other\n */\n\ncode();\n";
		for (const value of [`${TABS}x`, `${TABS}`, `Copyright (c) 2020 Example Inc.${TABS}`]) {
			const next = `/**\n *\t@Project: x\n *\t@Copyright:${value}\n */`;
			const result = fast(() => replaceOrInsertHeader(content, next, "/r/a.mjs"));
			expect(result.extraCopyrights).toEqual(["Copyright (c) 2010 Other"]);
		}
	});

	it("reads a modeline line with long runs of spaces or tabs", () => {
		expect(fast(() => isModeline(`# vim: x${SPACES}y`))).toBe(false);
		expect(fast(() => isModeline(`# vim: ts=4${TABS}sw=4`))).toBe(true);
		expect(fast(() => isModeline(`# vim: set${SPACES}`))).toBe(false);
		expect(fast(() => isModeline(`# vim: set${SPACES}ts=4:`))).toBe(true);
		expect(fast(() => isModeline(`/* vim: set ts=2: ${"*".repeat(RUN)}b*/`))).toBe(true);
		expect(fast(() => isModeline(`/* vim: ts=2 ${"*".repeat(RUN)}*/`))).toBe(true);
		expect(fast(() => isModeline(`<!-- vim: set ts=2:${SPACES}-->`))).toBe(true);
		expect(fast(() => isModeline(`<!-- vim: ts=2${SPACES}is,${TABS}-->`))).toBe(false);
	});
});

describe("text scans (CodeQL #1, #2)", () => {
	it("hasAngleTag matches /<[^>]+>/ on short inputs", () => {
		for (const text of ["", "Nate", "Nate <CLDMV>", "<>", "<><a>", "a<b", "<a<>", "<<a>", "x>y<", "<>>"]) {
			expect(hasAngleTag(text)).toBe(/<[^>]+>/.test(text));
		}
	});

	it("hasAngleTag reads a long run of < in linear time", () => {
		expect(fast(() => hasAngleTag("<".repeat(RUN)))).toBe(false);
		expect(fast(() => hasAngleTag("<>".repeat(RUN)))).toBe(false);
	});

	it("trimTrailingSlashes matches .replace(/\\/+$/, '') on short inputs", () => {
		for (const text of ["", "/", "///", "a", "a/", "a//b//", "/a/"]) {
			expect(trimTrailingSlashes(text)).toBe(text.replace(/\/+$/, ""));
		}
	});

	it("trimTrailingSlashes reads a long run of / in linear time", () => {
		expect(fast(() => trimTrailingSlashes(`${"/".repeat(RUN)}a`))).toBe(`${"/".repeat(RUN)}a`);
		expect(fast(() => trimTrailingSlashes("/".repeat(RUN)))).toBe("");
	});
});
