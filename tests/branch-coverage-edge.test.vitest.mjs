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
import { detectProjectFromMarkers } from "../src/detect/project.mjs";
import { getCommentSyntaxForFile } from "../src/detectors/index.mjs";

/**
 * @fileoverview Covers a few defensive branches that real inputs don't otherwise reach:
 * the `runCliAsMain` no-argv guard, the finite-priority side of the detector tie-break, and
 * the `resolveCommentSyntax`-returns-null fall-through in `getCommentSyntaxForFile`.
 * @module fix-headers/tests/branch-coverage-edge
 */

describe("defensive branch coverage", () => {
	it("runCliAsMain returns false when argv has no entry point (argv[1] absent)", () => {
		expect(runCliAsMain([])).toBe(false);
	});

	it("detector tie-break uses a finite priority over a lower one at equal root depth", async () => {
		const root = "/srv/repos/fix-headers";
		const lower = {
			id: "lower",
			extensions: [".mjs"],
			priority: 0,
			async findNearestConfig() {
				return { root, marker: "missing-lower.marker" };
			},
			parseProjectName() {
				return "lower";
			}
		};
		const higher = {
			id: "higher",
			extensions: [".mjs"],
			priority: 5,
			async findNearestConfig() {
				return { root, marker: "missing-higher.marker" };
			},
			parseProjectName() {
				return "higher";
			}
		};

		const detected = await detectProjectFromMarkers(root, { detectors: [lower, higher], preferredExtension: ".mjs" });
		expect(detected.language).toBe("higher");
	});

	it("keeps the deeper match when a later candidate has a shallower root", async () => {
		const deep = {
			id: "deep",
			extensions: [".mjs"],
			priority: 0,
			async findNearestConfig() {
				return { root: "/srv/repos/fix-headers/src", marker: "missing-deep.marker" };
			},
			parseProjectName() {
				return "deep";
			}
		};
		const shallow = {
			id: "shallow",
			extensions: [".mjs"],
			priority: 0,
			async findNearestConfig() {
				return { root: "/srv/repos/fix-headers", marker: "missing-shallow.marker" };
			},
			parseProjectName() {
				return "shallow";
			}
		};

		const detected = await detectProjectFromMarkers("/srv/repos/fix-headers", { detectors: [deep, shallow], preferredExtension: ".mjs" });
		expect(detected.language).toBe("deep");
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
