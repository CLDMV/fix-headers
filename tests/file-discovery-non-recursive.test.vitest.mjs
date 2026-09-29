/**
 * @fileoverview Non-recursive `includeFolders` entries (`{ path, recursive: false }`): root-files-only
 * discovery, mixing with recursive entries for the same or a containing folder, input validation,
 * walkFiles' `recursive` option, and the `--include-folder-non-recursive` CLI flag.
 * @module fix-headers/tests/file-discovery-non-recursive
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseCliArgs, runCli } from "../src/cli.mjs";
import { discoverFiles } from "../src/core/file-discovery.mjs";
import { walkFiles } from "../src/utils/fs.mjs";
import { cleanupWorkspace, createWorkspace } from "./helpers/workspace.mjs";

/** A full CLI run looks up git history for every file, too slow for vitest's 5s default under load. */
const CLI_RUN_TIMEOUT = { timeout: 30_000 };

/** @type {string[]} */
const workspaces = [];

afterEach(async () => {
	while (workspaces.length > 0) {
		await cleanupWorkspace(/** @type {string} */ (workspaces.pop()));
	}
});

/**
 * Creates a workspace with root files, a nested source tree, and a package.json marker.
 * @returns {Promise<string>} Absolute workspace path.
 */
async function fixture() {
	const root = await createWorkspace("discovery-non-recursive");
	workspaces.push(root);
	const files = ["index.mjs", "devcheck.mjs", "src/a.mjs", "src/core/b.mjs", "tools/c.mjs"];
	for (const file of files) {
		const target = join(root, file);
		await mkdir(resolve(target, ".."), { recursive: true });
		await writeFile(target, `export const value = ${JSON.stringify(file)};\n`);
	}
	await writeFile(join(root, "package.json"), JSON.stringify({ name: "@fixture/non-recursive", version: "1.0.0" }));
	return root;
}

/**
 * Project-relative, forward-slashed, sorted paths.
 * @param {string} root - Workspace path.
 * @param {string[]} files - Discovered paths.
 * @returns {string[]} Relative sorted paths.
 */
const rel = (root, files) => files.map((file) => file.slice(root.length + 1).replace(/\\/g, "/")).sort();

describe("non-recursive includeFolders entries", () => {
	it("includes only the folder's own files", async () => {
		const root = await fixture();

		const files = await discoverFiles({
			projectRoot: root,
			includeExtensions: [".mjs"],
			includeFolders: [{ path: ".", recursive: false }]
		});

		expect(rel(root, files)).toEqual(["devcheck.mjs", "index.mjs"]);
	});

	it("treats a missing or true `recursive` like a plain string entry", async () => {
		const root = await fixture();
		const base = { projectRoot: root, includeExtensions: [".mjs"] };
		const plain = await discoverFiles({ ...base, includeFolders: ["src"] });

		expect(await discoverFiles({ ...base, includeFolders: [{ path: "src" }] })).toEqual(plain);
		expect(await discoverFiles({ ...base, includeFolders: [{ path: "src", recursive: true }] })).toEqual(plain);
		expect(rel(root, plain)).toEqual(["src/a.mjs", "src/core/b.mjs"]);
	});

	it("combines root files with recursive subfolders (the slothlet config shape)", async () => {
		const root = await fixture();

		const files = await discoverFiles({
			projectRoot: root,
			includeExtensions: [".mjs"],
			includeFolders: [{ path: ".", recursive: false }, "src"]
		});

		expect(rel(root, files)).toEqual(["devcheck.mjs", "index.mjs", "src/a.mjs", "src/core/b.mjs"]);
		expect(files.length).toBe(new Set(files).size);
	});

	it("yields each file once when the same folder is also listed recursively, in either order", async () => {
		const root = await fixture();
		const base = { projectRoot: root, includeExtensions: [".mjs"] };
		const recursive = await discoverFiles({ ...base, includeFolders: ["."] });

		expect(await discoverFiles({ ...base, includeFolders: [{ path: ".", recursive: false }, "."] })).toEqual(recursive);
		expect(await discoverFiles({ ...base, includeFolders: [".", { path: "./", recursive: false }] })).toEqual(recursive);
		expect(recursive).toHaveLength(5);
	});

	it("yields each file once when a non-recursive folder lies inside a recursive one", async () => {
		const root = await fixture();

		const files = await discoverFiles({
			projectRoot: root,
			includeExtensions: [".mjs"],
			includeFolders: [{ path: "src/core", recursive: false }, "src", { path: "src", recursive: false }]
		});

		expect(rel(root, files)).toEqual(["src/a.mjs", "src/core/b.mjs"]);
		expect(files.length).toBe(new Set(files).size);
	});

	it("collapses duplicate non-recursive entries", async () => {
		const root = await fixture();

		const files = await discoverFiles({
			projectRoot: root,
			includeExtensions: [".mjs"],
			includeFolders: [
				{ path: ".", recursive: false },
				{ path: "./", recursive: false }
			]
		});

		expect(rel(root, files)).toEqual(["devcheck.mjs", "index.mjs"]);
		expect(files).toHaveLength(2);
	});

	it("rejects entries that are neither a path string nor { path }", async () => {
		const root = await fixture();

		for (const entry of [42, null, { recursive: false }, { path: 7 }]) {
			await expect(discoverFiles({ projectRoot: root, includeFolders: [/** @type {any} */ (entry)] })).rejects.toThrow(
				/Invalid includeFolders entry/
			);
		}
	});
});

describe("walkFiles recursive option", () => {
	it("lists only the directory's own files when recursive is false", async () => {
		const root = await fixture();
		const options = { allowedExtensions: new Set([".mjs"]), ignoreFolders: new Set() };

		expect(rel(root, await walkFiles(root, { ...options, recursive: false }))).toEqual(["devcheck.mjs", "index.mjs"]);
		expect(await walkFiles(root, options)).toHaveLength(5);
	});
});

describe("--include-folder-non-recursive CLI flag", () => {
	it("appends a non-recursive entry in order alongside --include-folder", () => {
		const parsed = parseCliArgs(["--include-folder", "src", "--include-folder-non-recursive", ".", "--include-folder", "tools"]);

		expect(parsed.options.includeFolders).toEqual(["src", { path: ".", recursive: false }, "tools"]);
	});

	it("works as the only include flag", () => {
		expect(parseCliArgs(["--include-folder-non-recursive", "."]).options.includeFolders).toEqual([{ path: ".", recursive: false }]);
	});

	it("requires a value", () => {
		expect(() => parseCliArgs(["--include-folder-non-recursive"])).toThrow("Missing value for --include-folder-non-recursive");
		expect(() => parseCliArgs(["--include-folder-non-recursive", "--dry-run"])).toThrow("Missing value for --include-folder-non-recursive");
	});

	it("is listed in the help text", async () => {
		/** @type {string[]} */
		const output = [];
		await runCli(["--help"], { stdout: (message) => output.push(message) });

		expect(output.join("\n")).toContain("--include-folder-non-recursive <path>");
	});

	it("scans root files once next to a recursive include of the same folder", CLI_RUN_TIMEOUT, async () => {
		const root = await fixture();
		/** @type {string[]} */
		const output = [];

		const code = await runCli(
			[
				"--cwd",
				root,
				"--dry-run",
				"--json",
				"--include-extension",
				".mjs",
				"--include-folder-non-recursive",
				".",
				"--include-folder",
				"src",
				"--include-folder",
				"."
			],
			{ stdout: (message) => output.push(message), stderr: (message) => output.push(message) }
		);

		expect(code).toBe(0);
		expect(JSON.parse(output.join("\n")).filesScanned).toBe(5);
	});

	it("scans only root files when it is the only include", CLI_RUN_TIMEOUT, async () => {
		const root = await fixture();
		/** @type {string[]} */
		const output = [];

		const code = await runCli(["--cwd", root, "--dry-run", "--include-extension", ".mjs", "--include-folder-non-recursive", "."], {
			stdout: (message) => output.push(message)
		});

		expect(code).toBe(0);
		expect(output).toContain("fix-headers complete: scanned=2, updated=2, dryRun=true");
	});
});
