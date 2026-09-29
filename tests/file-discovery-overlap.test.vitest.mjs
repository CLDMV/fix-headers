/**
 * @fileoverview Overlapping `includeFolders` must never return (or walk) a file more than once:
 * `"."` next to its subfolders, nested roots, duplicate entries, alternate spellings of one
 * folder, symlinked roots, and `.gitignore` / `excludeFolders` combined with overlap. Also covers
 * the order of the result and the downstream `filesScanned` count (issue #59).
 * @module fix-headers/tests/file-discovery-overlap
 */

import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverFiles } from "../src/core/file-discovery.mjs";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import { cleanupWorkspace, createWorkspace } from "./helpers/workspace.mjs";

const EXTENSIONS = [".mjs", ".cjs", ".jsonv", ".jsonc"];

/** The include list @cldmv/slothlet passes, which reproduced issue #59 (1922 discovered vs 964 unique). */
const SLOTHLET_INCLUDE_FOLDERS = [".configs", ".github", "api_tests", ".", "src", "tests", "tools"];

/** @type {string[]} */
const workspaces = [];

afterEach(async () => {
	vi.doUnmock("../src/utils/fs.mjs");
	vi.resetModules();
	while (workspaces.length > 0) {
		await cleanupWorkspace(/** @type {string} */ (workspaces.pop()));
	}
});

/**
 * Creates a workspace and writes each listed file with placeholder content.
 * @param {string[]} files - Project-relative file paths.
 * @param {Record<string, string>} [extra={}] - Extra project-relative files with explicit content.
 * @returns {Promise<string>} Absolute workspace path.
 */
async function fixture(files, extra = {}) {
	const root = await createWorkspace("discovery-overlap");
	workspaces.push(root);
	const entries = [...files.map((file) => [file, `export const value = ${JSON.stringify(file)};\n`]), ...Object.entries(extra)];
	for (const [file, content] of entries) {
		const target = join(root, file);
		await mkdir(resolve(target, ".."), { recursive: true });
		await writeFile(target, content);
	}
	return root;
}

/**
 * Builds the slothlet-shaped tree: root files, dot-folders, several source folders, plus
 * node_modules / coverage / tmp noise, kept out of the result by the fixture's .gitignore (coverage,
 * tmp) and the tests' excludeFolders (node_modules).
 * @returns {Promise<string>} Absolute workspace path.
 */
async function slothletShapedFixture() {
	return fixture(
		[
			"index.mjs",
			"index.cjs",
			"devcheck.mjs",
			".configs/eslint.config.mjs",
			".configs/vitest.config.mjs",
			".github/scripts/release.mjs",
			"api_tests/api_test/math.mjs",
			"api_tests/api_test/nested/deep.mjs",
			"src/slothlet.mjs",
			"src/lib/helpers/resolve.mjs",
			"src/lib/settings.jsonv",
			"tests/vitest/suite.test.vitest.mjs",
			"tests/fixtures/config.jsonc",
			"tools/dev/analyze.mjs",
			"docs/example.mjs",
			"node_modules/pkg/index.mjs",
			"coverage/report.mjs",
			"tmp/scratch.mjs"
		],
		{ ".gitignore": "coverage\ntmp\n", "package.json": JSON.stringify({ name: "@fixture/slothlet-shaped", version: "1.0.0" }) }
	);
}

/**
 * Project-relative, forward-slashed paths in result order.
 * @param {string} root - Workspace path.
 * @param {string[]} files - Discovered paths.
 * @returns {string[]} Relative paths.
 */
const rel = (root, files) => files.map((file) => file.slice(root.length + 1).replace(/\\/g, "/"));

/**
 * Loads discoverFiles with walkFiles wrapped so each root it starts a walk from is recorded.
 * (walkFiles' own recursion calls the unwrapped function, so only top-level walks are seen.)
 * @returns {Promise<{ discover: typeof discoverFiles, walked: string[] }>} Fresh discoverFiles and the walked roots.
 */
async function loadWithWalkSpy() {
	/** @type {string[]} */
	const walked = [];
	vi.resetModules();
	vi.doMock("../src/utils/fs.mjs", async (importOriginal) => {
		const original = /** @type {typeof import("../src/utils/fs.mjs")} */ (await importOriginal());
		return {
			...original,
			/** @type {typeof original.walkFiles} */
			async walkFiles(dirPath, options) {
				walked.push(dirPath);
				return original.walkFiles(dirPath, options);
			}
		};
	});
	const module = await import("../src/core/file-discovery.mjs");
	return { discover: module.discoverFiles, walked };
}

describe("discoverFiles with overlapping includeFolders (issue #59)", () => {
	it("returns each file once for the slothlet shape: '.' next to its subfolders", async () => {
		const root = await slothletShapedFixture();
		const base = { projectRoot: root, includeExtensions: EXTENSIONS, excludeFolders: ["coverage", "tmp", "node_modules"] };

		const overlapping = await discoverFiles({ ...base, includeFolders: SLOTHLET_INCLUDE_FOLDERS });
		const dotOnly = await discoverFiles({ ...base, includeFolders: ["."] });

		expect(overlapping.length).toBe(new Set(overlapping).size);
		expect(overlapping.length).toBe(dotOnly.length);
		expect(overlapping.length).toBe(15);
		expect(overlapping).toEqual(dotOnly);
	});

	it("walks only the '.' root for the slothlet shape instead of one walk per folder", async () => {
		const root = await slothletShapedFixture();
		const { discover, walked } = await loadWithWalkSpy();

		await discover({ projectRoot: root, includeExtensions: EXTENSIONS, includeFolders: SLOTHLET_INCLUDE_FOLDERS });

		// before the fix: seven walks, with everything under "." walked twice
		expect(walked).toEqual([root]);
	});

	it("collapses nested roots in either order and skips the inner walk", async () => {
		const root = await fixture(["src/a.mjs", "src/core/b.mjs", "src/core/deep/c.mjs"]);

		for (const includeFolders of [
			["src", "src/core"],
			["src/core", "src"],
			["src/core/deep", "src", "src/core"]
		]) {
			const { discover, walked } = await loadWithWalkSpy();
			const files = await discover({ projectRoot: root, includeExtensions: [".mjs"], includeFolders });
			expect(rel(root, files).sort()).toEqual(["src/a.mjs", "src/core/b.mjs", "src/core/deep/c.mjs"]);
			expect(rel(root, walked)).toEqual(["src"]);
		}
	});

	it("collapses duplicate entries and differently spelled paths to one folder", async () => {
		const root = await fixture(["src/a.mjs", "src/b.mjs"]);

		for (const includeFolders of [
			["src", "src"],
			["./src", "src/", "src"],
			["src/", "./src/", "src/../src"]
		]) {
			const { discover, walked } = await loadWithWalkSpy();
			const files = await discover({ projectRoot: root, includeExtensions: [".mjs"], includeFolders });
			expect(rel(root, files).sort()).toEqual(["src/a.mjs", "src/b.mjs"]);
			expect(walked).toHaveLength(1);
		}
	});

	it("keeps output identical to the per-folder order for non-overlapping inputs", async () => {
		const root = await fixture(["tools/t.mjs", "src/a.mjs", "src/lib/b.mjs", "lib/c.mjs"]);
		const options = { projectRoot: root, includeExtensions: [".mjs"], includeFolders: ["tools", "src", "lib"] };

		const files = await discoverFiles(options);
		const perFolder = [];
		for (const folder of options.includeFolders) {
			perFolder.push(...(await discoverFiles({ ...options, includeFolders: [folder] })));
		}

		expect(files).toEqual(perFolder);
		expect(rel(root, files).slice(0, 1)).toEqual(["tools/t.mjs"]);
		expect(rel(root, files).at(-1)).toBe("lib/c.mjs");
	});

	it("is deterministic: overlapping inputs return the containing root's walk order on every call", async () => {
		const root = await fixture(["a.mjs", "src/b.mjs", "src/core/c.mjs", "tools/d.mjs"]);
		const base = { projectRoot: root, includeExtensions: [".mjs"] };
		const dotOnly = await discoverFiles({ ...base, includeFolders: ["."] });

		const first = await discoverFiles({ ...base, includeFolders: ["src/core", "tools", ".", "src"] });
		const second = await discoverFiles({ ...base, includeFolders: ["src/core", "tools", ".", "src"] });

		expect(first).toEqual(dotOnly);
		expect(second).toEqual(first);
	});

	it("applies .gitignore and excludeFolders when an overlapping subfolder is listed explicitly", async () => {
		const root = await fixture(["src/keep.mjs", "src/generated/skip.mjs", "ignored/a.mjs", "src/drop.skip.mjs", "top.mjs"], {
			".gitignore": "ignored/\n*.skip.mjs\n"
		});
		const base = { projectRoot: root, includeExtensions: [".mjs"], excludeFolders: ["src/generated"] };

		const files = await discoverFiles({ ...base, includeFolders: [".", "src", "ignored", "src/generated", "./src"] });

		expect(rel(root, files).sort()).toEqual(["src/keep.mjs", "top.mjs"]);
		expect(files).toEqual(await discoverFiles({ ...base, includeFolders: ["."] }));
	});

	it("still walks an explicitly listed folder the containing walk never enters", async () => {
		const root = await fixture(["src/a.mjs", "node_modules/pkg/dep.mjs", "build/out.mjs", "build/sub/deep.mjs"], {
			".gitignore": "build/\n"
		});
		const { discover, walked } = await loadWithWalkSpy();

		const files = await discover({
			projectRoot: root,
			includeExtensions: [".mjs"],
			excludeFolders: ["node_modules"],
			includeFolders: [".", "node_modules/pkg", "build", "build/sub"]
		});

		// The "." walk never enters the excluded node_modules, so the explicit node_modules/pkg is
		// walked on its own and keeps contributing its files (a name exclusion only stops the walk
		// from entering the folder). The gitignored build/ is different: an includeFolders entry does
		// not override the ignore file, everything under build/ is ignored, so neither build nor
		// build/sub is walked and they contribute nothing.
		expect(rel(root, files).sort()).toEqual(["node_modules/pkg/dep.mjs", "src/a.mjs"]);
		expect(files.length).toBe(new Set(files).size);
		expect(rel(root, walked)).toEqual(["", "node_modules/pkg"]);
	});

	it("walks node_modules and root build folders from '.' when nothing ignores them (issue #71)", async () => {
		const root = await fixture(["src/a.mjs", "node_modules/pkg/dep.mjs", "build/out.mjs", "build/sub/deep.mjs"]);
		const { discover, walked } = await loadWithWalkSpy();

		const files = await discover({
			projectRoot: root,
			includeExtensions: [".mjs"],
			includeFolders: [".", "node_modules/pkg", "build", "build/sub"]
		});

		expect(rel(root, files).sort()).toEqual(["build/out.mjs", "build/sub/deep.mjs", "node_modules/pkg/dep.mjs", "src/a.mjs"]);
		expect(rel(root, walked)).toEqual([""]);
	});

	it("collapses a symlinked root onto the real folder it points at", async () => {
		const root = await fixture(["src/a.mjs", "src/core/b.mjs"]);
		await symlink(join(root, "src"), join(root, "src-link"), "dir");
		await symlink(join(root, "src", "core"), join(root, "core-link"), "dir");
		const base = { projectRoot: root, includeExtensions: [".mjs"] };

		// walkFiles does not follow symlinked directories, so "." alone never reaches src-link/core-link
		expect(rel(root, await discoverFiles({ ...base, includeFolders: ["."] })).sort()).toEqual(["src/a.mjs", "src/core/b.mjs"]);

		// a symlinked include root is walked through the link when it's the only entry ...
		expect(rel(root, await discoverFiles({ ...base, includeFolders: ["src-link"] })).sort()).toEqual([
			"src-link/a.mjs",
			"src-link/core/b.mjs"
		]);

		// ... and collapses onto the real folder when that folder (or a parent) is listed too
		for (const includeFolders of [
			["src", "src-link"],
			["src-link", "src"],
			[".", "core-link"],
			["src-link", "core-link"]
		]) {
			const files = await discoverFiles({ ...base, includeFolders });
			expect(files).toHaveLength(2);
			expect(new Set(files.map((file) => file.split("/").at(-1)))).toEqual(new Set(["a.mjs", "b.mjs"]));
		}
	});

	it("reports the de-duplicated count as filesScanned through fixHeaders", async () => {
		const root = await slothletShapedFixture();

		const result = await fixHeaders({
			cwd: root,
			dryRun: true,
			includeExtensions: EXTENSIONS,
			includeFolders: SLOTHLET_INCLUDE_FOLDERS,
			excludeFolders: ["coverage", "tmp", "node_modules"]
		});

		expect(result.filesScanned).toBe(15);
		expect(result.changes).toHaveLength(15);
		expect(new Set(result.changes.map((change) => change.file)).size).toBe(15);
	});

	it("de-duplicates overlapping includeFolders under a directory input as well", async () => {
		const root = await slothletShapedFixture();

		const result = await fixHeaders({
			cwd: root,
			input: "src",
			dryRun: true,
			includeExtensions: EXTENSIONS,
			includeFolders: [".", "lib", "lib/helpers"]
		});

		expect(result.filesScanned).toBe(3);
	});
});

describe("discoverFiles with a filesystem-root container", () => {
	it("treats a nested root as covered when the container is '/'", async () => {
		/** @type {string[]} */
		const walked = [];
		vi.resetModules();
		vi.doMock("node:fs/promises", async (importOriginal) => {
			const original = /** @type {typeof import("node:fs/promises")} */ (await importOriginal());
			return {
				...original,
				async stat() {
					return { isDirectory: () => true };
				}
			};
		});
		vi.doMock("../src/utils/fs.mjs", () => ({
			async walkFiles(dirPath) {
				walked.push(dirPath);
				return [];
			}
		}));
		try {
			const { discoverFiles: discover } = await import("../src/core/file-discovery.mjs");
			await discover({ projectRoot: "/", gitignore: false, includeFolders: ["fh-issue-59-not-a-real-folder", "."] });
			expect(walked).toEqual(["/"]);
		} finally {
			vi.doUnmock("node:fs/promises");
		}
	});
});
