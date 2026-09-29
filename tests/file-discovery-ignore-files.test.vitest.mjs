/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/file-discovery-ignore-files.test.vitest.mjs
 *	@Date: 2026-09-28 18:00:27 -07:00 (1790643627)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 18:00:27 -07:00 (1790643627)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { execFile } from "node:child_process";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { discoverFiles } from "../src/core/file-discovery.mjs";
import { cleanupWorkspace, createIsolatedWorkspace, createWorkspace } from "./helpers/workspace.mjs";

/**
 * @fileoverview Discovery excludes nothing by name: a file is skipped only when an ignore file
 * ignores it (everything git honours — root and nested `.gitignore`, `.git/info/exclude`,
 * `core.excludesFile` — asked of git inside a work tree, parsed from `.gitignore` files outside
 * one) or when the consumer excludes it. `.git` itself is never walked (issue #71).
 *
 * Every git call — the fixtures' and fix-headers' own — reads a global config file this suite
 * writes (`GIT_CONFIG_GLOBAL`) and no system config, so a developer's `core.excludesFile` or
 * other global settings cannot change the results.
 * @module fix-headers/tests/file-discovery-ignore-files
 */

const execFileAsync = promisify(execFile);

/** Several git spawns per test (fixture setup plus discovery), too slow for vitest's 5s default under load. */
const GIT_TIMEOUT = { timeout: 30_000 };

/** Folder names the old discovery skipped without any ignore file saying so. */
const FORMERLY_SKIPPED = [
	"node_modules/pkg/index.mjs",
	"dist/out.mjs",
	"build/out.mjs",
	"coverage/report.mjs",
	"tmp/scratch.mjs",
	".next/server.mjs",
	".turbo/cache.mjs"
];

/** @type {string[]} */
const workspaces = [];
/** @type {string} */
let globalConfigPath = "";
/** @type {Record<string, string | undefined>} */
const savedEnv = {};

beforeAll(async () => {
	const configRoot = await createWorkspace("ignore-files-gitconfig");
	workspaces.push(configRoot);
	globalConfigPath = join(configRoot, "gitconfig");
	await writeFile(globalConfigPath, "");
	for (const name of ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "PATH"]) {
		savedEnv[name] = process.env[name];
	}
	process.env.GIT_CONFIG_GLOBAL = globalConfigPath;
	process.env.GIT_CONFIG_NOSYSTEM = "1";
});

afterEach(async () => {
	process.env.PATH = savedEnv.PATH;
	await writeFile(globalConfigPath, "");
});

afterAll(async () => {
	for (const [name, value] of Object.entries(savedEnv)) {
		if (value === undefined) {
			delete process.env[name];
		} else {
			process.env[name] = value;
		}
	}
	while (workspaces.length > 0) {
		await cleanupWorkspace(/** @type {string} */ (workspaces.pop()));
	}
});

/**
 * Writes files under a root, creating parent folders.
 * @param {string} root - Absolute root.
 * @param {Record<string, string> | string[]} files - Relative paths, or relative path → content.
 * @returns {Promise<void>} Completion promise.
 */
async function writeTree(root, files) {
	const entries = Array.isArray(files)
		? files.map((file) => [file, `export const value = ${JSON.stringify(file)};\n`])
		: Object.entries(files);
	for (const [file, content] of entries) {
		const target = join(root, file);
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, content);
	}
}

/**
 * Runs git in a directory.
 * @param {string} cwd - Working directory.
 * @param {string[]} args - Git arguments.
 * @returns {Promise<string>} Stdout.
 */
async function git(cwd, args) {
	const { stdout } = await execFileAsync("git", args, { cwd });
	return stdout;
}

/**
 * Creates a fixture folder inside this repo's gitignored tmp/ and initialises a git repository in it.
 * @param {string} name - Workspace name.
 * @returns {Promise<string>} Absolute repository root.
 */
async function gitWorkspace(name) {
	const root = await createWorkspace(name);
	workspaces.push(root);
	await git(root, ["init", "-q"]);
	return root;
}

/**
 * Creates a fixture folder outside any git work tree (OS temp directory).
 * @param {string} name - Workspace name.
 * @returns {Promise<string>} Absolute folder path.
 */
async function plainWorkspace(name) {
	const root = await createIsolatedWorkspace(`fh-${name}`);
	workspaces.push(root);
	return root;
}

/**
 * Discovers `.mjs` files and returns them root-relative, forward-slashed and sorted.
 * @param {string} root - Discovery root.
 * @param {Record<string, unknown>} [options={}] - Extra discovery options.
 * @returns {Promise<string[]>} Relative sorted paths.
 */
async function discover(root, options = {}) {
	const files = await discoverFiles({ projectRoot: root, includeExtensions: [".mjs"], ...options });
	return files.map((file) => file.slice(root.length + 1).replace(/\\/g, "/")).sort();
}

describe("discovery inside a git work tree", () => {
	it("includes node_modules, dist, build, coverage, tmp, .next and .turbo when no ignore file lists them", GIT_TIMEOUT, async () => {
		const root = await gitWorkspace("ignore-none");
		await writeTree(root, ["src/a.mjs", ...FORMERLY_SKIPPED]);

		expect(await discover(root)).toEqual([...FORMERLY_SKIPPED, "src/a.mjs"].sort());
	});

	it("excludes exactly the folders a .gitignore lists", GIT_TIMEOUT, async () => {
		const root = await gitWorkspace("ignore-listed");
		await writeTree(root, ["src/a.mjs", ...FORMERLY_SKIPPED]);
		await writeTree(root, { ".gitignore": "node_modules/\ndist/\ncoverage/\ntmp/\n" });

		expect(await discover(root)).toEqual([".next/server.mjs", ".turbo/cache.mjs", "build/out.mjs", "src/a.mjs"]);
	});

	it("never walks .git, even with ignore files disabled", GIT_TIMEOUT, async () => {
		const root = await gitWorkspace("ignore-dotgit");
		await writeTree(root, ["src/a.mjs", ".git/probe.mjs", ".git/hooks/probe.mjs"]);

		expect(await discover(root)).toEqual(["src/a.mjs"]);
		expect(await discover(root, { gitignore: false })).toEqual(["src/a.mjs"]);
	});

	it("applies a nested .gitignore to its own folder only", GIT_TIMEOUT, async () => {
		const root = await gitWorkspace("ignore-nested");
		await writeTree(root, ["generated.mjs", "lib/generated.mjs", "src/generated.mjs", "src/deep/generated.mjs", "src/keep.mjs"]);
		await writeTree(root, { "src/.gitignore": "generated.mjs\n" });

		expect(await discover(root)).toEqual(["generated.mjs", "lib/generated.mjs", "src/keep.mjs"]);
	});

	it("honours negation patterns, with a nested file overriding its parent", GIT_TIMEOUT, async () => {
		const root = await gitWorkspace("ignore-negation");
		await writeTree(root, ["a.gen.mjs", "keep.gen.mjs", "lib/lib.gen.mjs", "lib/other.gen.mjs", "dist/drop.mjs", "dist/keep.mjs"]);
		await writeTree(root, { ".gitignore": "*.gen.mjs\n!keep.gen.mjs\ndist/*\n!dist/keep.mjs\n", "lib/.gitignore": "!lib.gen.mjs\n" });

		expect(await discover(root)).toEqual(["dist/keep.mjs", "keep.gen.mjs", "lib/lib.gen.mjs"]);
	});

	it("honours .git/info/exclude", GIT_TIMEOUT, async () => {
		const root = await gitWorkspace("ignore-info-exclude");
		await writeTree(root, ["src/a.mjs", "secret/s.mjs"]);
		await writeFile(join(root, ".git", "info", "exclude"), "secret/\n");

		expect(await discover(root)).toEqual(["src/a.mjs"]);
	});

	it("honours core.excludesFile", GIT_TIMEOUT, async () => {
		const root = await gitWorkspace("ignore-excludes-file");
		await writeTree(root, ["src/a.mjs", "src/b.local.mjs"]);
		const excludesFile = join(root, "..", `${root.split("/").at(-1)}.excludes`);
		workspaces.push(excludesFile);
		await writeFile(excludesFile, "*.local.mjs\n");
		await writeFile(globalConfigPath, `[core]\n\texcludesFile = ${excludesFile}\n`);

		expect(await discover(root)).toEqual(["src/a.mjs"]);
	});

	it("includes a tracked file even when an ignore pattern matches it", GIT_TIMEOUT, async () => {
		const root = await gitWorkspace("ignore-tracked");
		await writeTree(root, ["src/a.mjs", "dist/tracked.mjs", "dist/untracked.mjs"]);
		await writeTree(root, { ".gitignore": "dist/\n" });
		await git(root, ["add", "-f", "dist/tracked.mjs"]);

		expect(await discover(root)).toEqual(["dist/tracked.mjs", "src/a.mjs"]);
	});

	it("gitignore: false disables every ignore file", GIT_TIMEOUT, async () => {
		const root = await gitWorkspace("ignore-disabled");
		await writeTree(root, ["src/a.mjs", "dist/d.mjs", "secret/s.mjs"]);
		await writeTree(root, { ".gitignore": "dist/\n" });
		await writeFile(join(root, ".git", "info", "exclude"), "secret/\n");

		expect(await discover(root, { gitignore: false })).toEqual(["dist/d.mjs", "secret/s.mjs", "src/a.mjs"]);
	});

	it("explicit gitignore paths replace the repository's ignore files", GIT_TIMEOUT, async () => {
		const root = await gitWorkspace("ignore-explicit");
		await writeTree(root, ["src/a.mjs", "src/drop.mjs", "dist/d.mjs", "secret/s.mjs"]);
		await writeTree(root, { ".gitignore": "dist/\n", "custom.ignore": "src/drop.mjs\n" });
		await writeFile(join(root, ".git", "info", "exclude"), "secret/\n");

		expect(await discover(root, { gitignore: "custom.ignore" })).toEqual(["dist/d.mjs", "secret/s.mjs", "src/a.mjs"]);
		expect(await discover(root, { gitignore: ["custom.ignore", ".gitignore"] })).toEqual(["secret/s.mjs", "src/a.mjs"]);
		// an explicit file that can't be read contributes no rules
		expect(await discover(root, { gitignore: ["missing.ignore"] })).toEqual(["dist/d.mjs", "secret/s.mjs", "src/a.mjs", "src/drop.mjs"]);
	});

	it("still applies the consumer's excludeFolders", GIT_TIMEOUT, async () => {
		const root = await gitWorkspace("ignore-exclude-folders");
		await writeTree(root, ["src/a.mjs", "src/generated/g.mjs", "dist/d.mjs", "node_modules/pkg/index.mjs"]);

		expect(await discover(root, { excludeFolders: ["dist", "src/generated"] })).toEqual(["node_modules/pkg/index.mjs", "src/a.mjs"]);
	});

	it("uses the repository's rules when discovery starts in a subfolder", GIT_TIMEOUT, async () => {
		const root = await gitWorkspace("ignore-subfolder");
		await writeTree(root, ["packages/app/src/a.mjs", "packages/app/dist/d.mjs", "packages/app/coverage/c.mjs"]);
		await writeTree(root, { ".gitignore": "dist/\n" });

		expect(await discover(join(root, "packages", "app"))).toEqual(["coverage/c.mjs", "src/a.mjs"]);
	});

	it("treats a root the enclosing repository ignores as a standalone folder with its own .gitignore files", GIT_TIMEOUT, async () => {
		const root = await gitWorkspace("ignore-ignored-root");
		await writeTree(root, ["vendor/lib/a.mjs", "vendor/lib/dist/d.mjs", "vendor/lib/gen/g.mjs"]);
		await writeTree(root, { ".gitignore": "vendor/\n", "vendor/lib/.gitignore": "gen/\n" });

		expect(await discover(join(root, "vendor", "lib"))).toEqual(["a.mjs", "dist/d.mjs"]);
	});

	it("walks a symlinked include folder and applies ignore rules inside it", GIT_TIMEOUT, async () => {
		const root = await gitWorkspace("ignore-symlink");
		await writeTree(root, ["src/a.mjs", "src/gen/g.mjs"]);
		await writeTree(root, { ".gitignore": "gen/\n" });
		await symlink(join(root, "src"), join(root, "src-link"), "dir");

		expect(await discover(root)).toEqual(["src/a.mjs"]);
		expect(await discover(root, { includeFolders: ["src-link"] })).toEqual(["src-link/a.mjs"]);
	});
});

describe("discovery outside a git work tree", () => {
	it("includes every folder when there are no ignore files", async () => {
		const root = await plainWorkspace("plain-none");
		await writeTree(root, ["src/a.mjs", ...FORMERLY_SKIPPED]);

		expect(await discover(root)).toEqual([...FORMERLY_SKIPPED, "src/a.mjs"].sort());
	});

	it("parses the root and nested .gitignore files, nested rules scoped to their folder", async () => {
		const root = await plainWorkspace("plain-nested");
		await writeTree(root, [
			"src/a.mjs",
			"dist/d.mjs",
			"x.gen.mjs",
			"lib/keep.gen.mjs",
			"lib/y.gen.mjs",
			"lib/cache/c.mjs",
			"cache/c.mjs",
			"node_modules/pkg/index.mjs"
		]);
		await writeTree(root, { ".gitignore": "dist/\n*.gen.mjs\n", "lib/.gitignore": "!keep.gen.mjs\ncache/\n" });

		expect(await discover(root)).toEqual(["cache/c.mjs", "lib/keep.gen.mjs", "node_modules/pkg/index.mjs", "src/a.mjs"]);
		expect(await discover(root, { gitignore: false })).toHaveLength(8);
	});

	it("ignores an include folder under an ignored folder, whatever a nested .gitignore re-includes", async () => {
		const root = await plainWorkspace("plain-excluded-parent");
		await writeTree(root, ["src/a.mjs", "vendor/pkg/p.mjs", "vendor/pkg/deep/d.mjs"]);
		await writeTree(root, { ".gitignore": "vendor/\n", "vendor/pkg/.gitignore": "!*.mjs\n" });

		// as in git, a file cannot be re-included when a parent folder is excluded
		expect(await discover(root, { includeFolders: ["vendor/pkg"] })).toEqual([]);
		expect(await discover(root, { includeFolders: ["src", "vendor/pkg"] })).toEqual(["src/a.mjs"]);
	});

	it("does not apply the root's ignore files to an include folder outside the root", async () => {
		const parent = await plainWorkspace("plain-outside");
		const root = join(parent, "project");
		await writeTree(parent, ["project/src/a.mjs", "project/gen/g.mjs", "sibling/gen/s.mjs"]);
		await writeTree(parent, { "project/.gitignore": "gen/\n" });

		const files = await discoverFiles({ projectRoot: root, includeExtensions: [".mjs"], includeFolders: [".", "../sibling"] });
		expect(files.map((file) => file.slice(parent.length + 1)).sort()).toEqual(["project/src/a.mjs", "sibling/gen/s.mjs"]);
	});

	it("falls back to parsing .gitignore files when git is not available", GIT_TIMEOUT, async () => {
		const root = await gitWorkspace("ignore-no-git");
		await writeTree(root, ["src/a.mjs", "dist/d.mjs", "secret/s.mjs"]);
		await writeTree(root, { ".gitignore": "dist/\n" });
		await writeFile(join(root, ".git", "info", "exclude"), "secret/\n");
		const emptyBin = join(root, "..", `${root.split("/").at(-1)}-empty-bin`);
		workspaces.push(emptyBin);
		await mkdir(emptyBin);
		process.env.PATH = emptyBin;

		// .git/info/exclude is git's own state; without git only the .gitignore files are read.
		expect(await discover(root)).toEqual(["secret/s.mjs", "src/a.mjs"]);
	});
});

describe("discovery over a folder holding several repositories", () => {
	it("applies each repository's own rules under a plain parent folder", GIT_TIMEOUT, async () => {
		const parent = await plainWorkspace("multi-plain");
		for (const name of ["repo-a", "repo-b", "skipped"]) {
			await mkdir(join(parent, name));
			await git(join(parent, name), ["init", "-q"]);
		}
		await writeTree(parent, [
			"loose.mjs",
			"repo-a/src/a.mjs",
			"repo-a/dist/a.mjs",
			"repo-b/src/b.mjs",
			"repo-b/dist/b.mjs",
			"skipped/s.mjs"
		]);
		await writeTree(parent, { ".gitignore": "skipped/\n", "repo-a/.gitignore": "dist/\n" });
		await writeFile(join(parent, "repo-b", ".git", "info", "exclude"), "src/\n");

		expect(await discover(parent)).toEqual(["loose.mjs", "repo-a/src/a.mjs", "repo-b/dist/b.mjs"]);
	});

	it("applies a nested repository's own rules, not the enclosing repository's", GIT_TIMEOUT, async () => {
		const root = await gitWorkspace("multi-git");
		for (const name of ["nested", "ignored-nested"]) {
			await mkdir(join(root, name));
			await git(join(root, name), ["init", "-q"]);
		}
		await writeTree(root, ["src/o.mjs", "dist/o.mjs", "nested/dist/n.mjs", "nested/gen/n.mjs", "ignored-nested/i.mjs"]);
		await writeTree(root, { ".gitignore": "dist/\nignored-nested/\n", "nested/.gitignore": "gen/\n" });

		expect(await discover(root)).toEqual(["nested/dist/n.mjs", "src/o.mjs"]);
	});
});
