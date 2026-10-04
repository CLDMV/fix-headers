/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/file-discovery-dependency-folders.test.vitest.mjs
 *	@Date: 2026-10-03T17:13:58-07:00 (1791072838)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T17:16:18-07:00 (1791072978)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { afterEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { runCli } from "../src/cli.mjs";
import { DEPENDENCY_FOLDERS, discoverFiles } from "../src/core/file-discovery.mjs";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview Dependency folders (`node_modules`, `bower_components`, `jspm_packages`,
 * `.pnpm-store`, `.yarn`, and a Composer or Go `vendor`) are never walked, at any depth and
 * whatever the ignore files say, unless a path inside one is named explicitly (#123).
 */

const execFileAsync = promisify(execFile);
const DEPENDENCY_SOURCE = "module.exports = 1;\n";

/**
 * Project-relative, forward-slashed, sorted file list.
 * @param {string} base - Fixture root.
 * @param {string[]} files - Absolute discovered paths.
 * @returns {string[]} Relative sorted paths.
 */
const rel = (base, files) => files.map((file) => file.slice(base.length + 1).replace(/\\/g, "/")).sort();

/**
 * Writes a fixture project with no `.gitignore`: own source at several depths, and dependency
 * folders at the root, inside a sub-package, and three or more levels down.
 * @param {string} root - Fixture root.
 * @returns {Promise<void>} Completion promise.
 */
async function writeProject(root) {
	const files = {
		"package.json": JSON.stringify({ name: "dependency-folders" }),
		"src/a.mjs": "export const a = 1;\n",
		"node_modules/pkg/index.js": DEPENDENCY_SOURCE,
		"node_modules/pkg/node_modules/inner/index.js": DEPENDENCY_SOURCE,
		"packages/sub/package.json": JSON.stringify({ name: "sub" }),
		"packages/sub/src/b.mjs": "export const b = 2;\n",
		"packages/sub/node_modules/dep/index.js": DEPENDENCY_SOURCE,
		"one/two/three/own.mjs": "export const own = 3;\n",
		"one/two/three/node_modules/deep/index.js": DEPENDENCY_SOURCE,
		"bower_components/lib/lib.js": DEPENDENCY_SOURCE,
		"jspm_packages/npm/x.js": DEPENDENCY_SOURCE,
		".pnpm-store/v3/files/x.js": DEPENDENCY_SOURCE,
		".yarn/unplugged/pkg/index.js": DEPENDENCY_SOURCE,
		"dist/out.js": "export const out = 1;\n",
		"build/out.js": "export const built = 1;\n",
		"coverage/lcov.js": "export const cov = 1;\n"
	};
	for (const [path, content] of Object.entries(files)) {
		await writeWorkspaceFile(join(root, path), content);
	}
}

const OWN_FILES = ["build/out.js", "coverage/lcov.js", "dist/out.js", "one/two/three/own.mjs", "packages/sub/src/b.mjs", "src/a.mjs"];

describe("dependency folders are never walked by default", () => {
	/** @type {string | null} */
	let root = null;

	afterEach(async () => {
		if (root) {
			await cleanupWorkspace(root);
		}
		root = null;
	});

	it("lists the default dependency folders", () => {
		expect(DEPENDENCY_FOLDERS).toEqual(["node_modules", "bower_components", "jspm_packages", ".pnpm-store", ".yarn"]);
	});

	it("skips them at the root, in sub-packages and three or more levels down without a .gitignore", async () => {
		root = await createWorkspace("dependency-folders-default");
		await writeProject(root);

		expect(rel(root, await discoverFiles({ projectRoot: root }))).toEqual(OWN_FILES);
		expect(rel(root, await discoverFiles({ projectRoot: root, gitignore: false }))).toEqual(OWN_FILES);
	});

	it("a default run leaves every dependency file untouched", async () => {
		root = await createWorkspace("dependency-folders-run");
		await writeProject(root);

		const lines = [];
		const code = await runCli(["--cwd", root, "--author-name", "A", "--author-email", "a@x.dev"], { stdout: (line) => lines.push(line) });
		expect(code).toBe(0);
		expect(lines[0]).toBe(`fix-headers complete: scanned=${OWN_FILES.length}, updated=${OWN_FILES.length}, dryRun=false`);
		for (const path of [
			"node_modules/pkg/index.js",
			"packages/sub/node_modules/dep/index.js",
			"one/two/three/node_modules/deep/index.js",
			".yarn/unplugged/pkg/index.js"
		]) {
			expect(await readFile(join(root, path), "utf8")).toBe(DEPENDENCY_SOURCE);
		}
		expect(await readFile(join(root, "src", "a.mjs"), "utf8")).toMatch(/^\/\*\*\n/);
	});

	it("skips them even when git tracks them", async () => {
		root = await createWorkspace("dependency-folders-git");
		await writeProject(root);
		await execFileAsync("git", ["init"], { cwd: root });
		await execFileAsync("git", ["add", "-A"], { cwd: root });

		expect(rel(root, await discoverFiles({ projectRoot: root }))).toEqual(OWN_FILES);
	});

	it("still processes a dependency folder named with includeFolders or input", async () => {
		root = await createWorkspace("dependency-folders-explicit");
		await writeProject(root);

		expect(rel(root, await discoverFiles({ projectRoot: root, includeFolders: ["node_modules/pkg"] }))).toEqual([
			"node_modules/pkg/index.js"
		]);
		expect(
			rel(root, await discoverFiles({ projectRoot: root, includeFolders: [".", "node_modules/pkg", "one/two/three/node_modules"] }))
		).toEqual([...OWN_FILES, "node_modules/pkg/index.js", "one/two/three/node_modules/deep/index.js"].sort());

		const lines = [];
		await runCli(["--cwd", root, "--dry-run", "--verbose", "--include-folder", "packages/sub/node_modules"], {
			stdout: (line) => lines.push(line)
		});
		expect(lines).toEqual(["fix-headers complete: scanned=1, updated=1, dryRun=true", "updated: packages/sub/node_modules/dep/index.js"]);

		const folderInput = await fixHeaders({ cwd: root, dryRun: true, input: "node_modules/pkg" });
		expect(folderInput.changes.map((change) => change.file.replace(/\\/g, "/"))).toEqual(["node_modules/pkg/index.js"]);

		const fileInput = await fixHeaders({ cwd: root, dryRun: true, input: "node_modules/pkg/node_modules/inner/index.js" });
		expect(fileInput.filesScanned).toBe(1);
	});

	it("skips a Composer or Go vendor folder but keeps any other folder named vendor", async () => {
		root = await createWorkspace("dependency-folders-vendor");
		const files = {
			"composer/composer.json": JSON.stringify({ name: "acme/app" }),
			"composer/src/App.php": "<?php\n",
			"composer/vendor/autoload.php": "<?php\n",
			"composer/vendor/acme/lib/Lib.php": "<?php\n",
			"gomod/go.mod": "module example.com/app\n",
			"gomod/main.go": "package main\n",
			"gomod/vendor/modules.txt": "# example.com/dep v1.0.0\n",
			"gomod/vendor/example.com/dep/dep.go": "package dep\n",
			"web/vendor/own.js": "export const own = 1;\n",
			"web/resources/views/vendor/mail/layout.html": "<p>hi</p>\n"
		};
		for (const [path, content] of Object.entries(files)) {
			await writeWorkspaceFile(join(root, path), content);
		}

		expect(rel(root, await discoverFiles({ projectRoot: root }))).toEqual([
			"composer/src/App.php",
			"gomod/main.go",
			"web/resources/views/vendor/mail/layout.html",
			"web/vendor/own.js"
		]);
		expect(rel(root, await discoverFiles({ projectRoot: root, includeFolders: [".", "composer/vendor/acme"] }))).toContain(
			"composer/vendor/acme/lib/Lib.php"
		);
	});
});
