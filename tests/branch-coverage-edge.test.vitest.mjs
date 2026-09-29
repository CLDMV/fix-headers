/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/branch-coverage-edge.test.vitest.mjs
 *	@Date: 2026-06-08T06:17:54-07:00 (1780924674)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-08 06:17:54 -07:00 (1780924674)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, expect, it } from "vitest";
import { runCliAsMain } from "../src/cli.mjs";
import { getCommentSyntaxForFile } from "../src/detectors/index.mjs";

/**
 * @fileoverview Covers a few defensive branches that real inputs don't otherwise reach:
 * the `runCliAsMain` no-argv guard and the `resolveCommentSyntax`-returns-null fall-through
 * in `getCommentSyntaxForFile`.
 * @module fix-headers/tests/branch-coverage-edge
 */

describe("defensive branch coverage", () => {
	it("runCliAsMain returns false when argv has no entry point (argv[1] absent)", () => {
		expect(runCliAsMain([])).toBe(false);
	});

	it("getCommentSyntaxForFile falls through to the default when a matching detector yields no syntax", () => {
		const nullDetector = {
			id: "null-syntax",
			extensions: [".mjs"],
			resolveCommentSyntax() {
				return null;
			}
		};
		const syntax = getCommentSyntaxForFile("/repo/src/file.mjs", { detectors: [nullDetector] });
		expect(syntax).toEqual({ kind: "block", blockStart: "/**", blockLinePrefix: " *\t", blockEnd: " */" });
	});
});
