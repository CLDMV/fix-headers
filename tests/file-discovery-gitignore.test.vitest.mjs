/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/file-discovery-gitignore.test.vitest.mjs
 *	@Date: 2026-06-07T22:45:29-07:00 (1780897529)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-07 22:45:29 -07:00 (1780897529)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverFiles } from "../src/core/file-discovery.mjs";

/**
 * @fileoverview Real-filesystem coverage for discoverFiles' ignore behavior: project-root
 * anchored build/cache dirs (a nested `tools/build` is SOURCE and must be processed while a
 * top-level `/build` is skipped), any-depth `node_modules`/`.git`, and `.gitignore` support
 * (auto-detect, disable, and explicit-file).
 * @module fix-headers/tests/file-discovery-gitignore
 */

describe("discoverFiles ignore scoping + .gitignore", () => {
	/** @type {string | null} */
	let root = null;

	afterEach(async () => {
		if (root) {
			await rm(root, { recursive: true, force: true });
		}
		root = null;
	});

	/**
	 * Builds a fixture tree with a .gitignore, a nested vs top-level `build`, and node_modules.
	 * @returns {Promise<string>} Absolute fixture root.
	 */
	async function fixture() {
		root = await mkdtemp(join(tmpdir(), "fh-disc-"));
		for (const dir of ["src", "ignored", "tools/build", "build", "node_modules/pkg"]) {
			await mkdir(join(root, dir), { recursive: true });
		}
		await writeFile(join(root, ".gitignore"), "ignored/\n*.skip.mjs\n/build\n");
		await writeFile(join(root, "src", "keep.mjs"), "// keep");
		await writeFile(join(root, "src", "drop.skip.mjs"), "// matched by *.skip.mjs");
		await writeFile(join(root, "ignored", "a.mjs"), "// inside a gitignored dir");
		await writeFile(join(root, "tools", "build", "nested.mjs"), "// nested build = source, keep");
		await writeFile(join(root, "build", "out.mjs"), "// top-level build = output, skip");
		await writeFile(join(root, "node_modules", "pkg", "dep.mjs"), "// vendored, skip at any depth");
		return root;
	}

	/**
	 * Project-relative, forward-slashed, sorted file list.
	 * @param {string} base - Fixture root.
	 * @param {string[]} files - Absolute discovered paths.
	 * @returns {string[]} Relative sorted paths.
	 */
	const rel = (base, files) => files.map((f) => f.slice(base.length + 1).replace(/\\/g, "/")).sort();

	it("auto-detects .gitignore: keeps nested build, skips top-level build / node_modules / gitignored", async () => {
		const base = await fixture();
		const files = await discoverFiles({ projectRoot: base, includeExtensions: [".mjs"] });
		expect(rel(base, files)).toEqual(["src/keep.mjs", "tools/build/nested.mjs"]);
	});

	it("gitignore:false falls back to top-level anchoring + always-ignore only", async () => {
		const base = await fixture();
		const files = await discoverFiles({ projectRoot: base, includeExtensions: [".mjs"], gitignore: false });
		// top-level /build and node_modules still skipped; gitignored ignored/ + *.skip kept
		expect(rel(base, files)).toEqual(["ignored/a.mjs", "src/drop.skip.mjs", "src/keep.mjs", "tools/build/nested.mjs"]);
	});

	it("accepts an explicit gitignore file path", async () => {
		const base = await fixture();
		await writeFile(join(base, "custom.ignore"), "src/keep.mjs\n");
		const files = await discoverFiles({ projectRoot: base, includeExtensions: [".mjs"], gitignore: "custom.ignore" });
		const list = rel(base, files);
		expect(list).not.toContain("src/keep.mjs");
		// the real .gitignore is NOT consulted when an explicit file is given, so drop.skip.mjs survives
		expect(list).toContain("src/drop.skip.mjs");
	});

	it("accepts an array of gitignore file paths (non-string entries ignored)", async () => {
		const base = await fixture();
		await writeFile(join(base, "extra.ignore"), "src/drop.skip.mjs\n");
		const files = await discoverFiles({
			projectRoot: base,
			includeExtensions: [".mjs"],
			gitignore: ["extra.ignore", 42]
		});
		const list = rel(base, files);
		expect(list).not.toContain("src/drop.skip.mjs");
		expect(list).toContain("src/keep.mjs");
	});
});
