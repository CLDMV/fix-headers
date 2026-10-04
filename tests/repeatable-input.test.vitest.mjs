/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/repeatable-input.test.vitest.mjs
 *	@Date: 2026-10-03T17:10:07-07:00 (1791072607)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T17:11:21-07:00 (1791072681)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseCliArgs, runCli } from "../src/cli.mjs";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview `input` / `--input` takes several paths: every file and folder given is
 * processed, each file once (#119).
 */

const IDENTITY = { authorName: "Input Tester", authorEmail: "input@example.com", companyName: "Catalyzed Motivation Inc." };

/**
 * Creates a workspace with header-less files in two folders.
 * @param {string} name - Workspace name.
 * @returns {Promise<string>} Workspace path.
 */
async function createInputWorkspace(name) {
	const workspace = await createWorkspace(name);
	await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "repeatable-input" }, null, 2));
	await writeWorkspaceFile(join(workspace, "a.mjs"), "export const a = 1;\n");
	await writeWorkspaceFile(join(workspace, "b.mjs"), "export const b = 2;\n");
	await writeWorkspaceFile(join(workspace, "c.mjs"), "export const c = 3;\n");
	await writeWorkspaceFile(join(workspace, "lib", "one.mjs"), "export const one = 1;\n");
	await writeWorkspaceFile(join(workspace, "lib", "two.mjs"), "export const two = 2;\n");
	return workspace;
}

describe("repeatable input", () => {
	it("parses repeated --input values into a de-duplicated list", () => {
		expect(parseCliArgs(["--input", "a.mjs"]).options.input).toEqual(["a.mjs"]);
		expect(parseCliArgs(["--input", "a.mjs", "--input", "b.mjs", "--input", "a.mjs"]).options.input).toEqual(["a.mjs", "b.mjs"]);
		expect(() => parseCliArgs(["--input", "a.mjs", "--input"])).toThrow(/Missing value for --input/);
	});

	it("processes every file given with --input, not just the last", async () => {
		const workspace = await createInputWorkspace("input-cli-two-files");
		try {
			const lines = [];
			const code = await runCli(
				["--cwd", workspace, "--input", "a.mjs", "--input", "b.mjs", "--author-name", "A", "--author-email", "a@x.dev", "--verbose"],
				{ stdout: (message) => lines.push(message) }
			);
			expect(code).toBe(0);
			expect(lines).toEqual(["fix-headers complete: scanned=2, updated=2, dryRun=false", "updated: a.mjs", "updated: b.mjs"]);
			expect(await readFile(join(workspace, "a.mjs"), "utf8")).toMatch(/^\/\*\*\n/);
			expect(await readFile(join(workspace, "b.mjs"), "utf8")).toMatch(/^\/\*\*\n/);
			expect(await readFile(join(workspace, "c.mjs"), "utf8")).toBe("export const c = 3;\n");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("takes the union of files and folders, each file once, in the order given", async () => {
		const workspace = await createInputWorkspace("input-api-union");
		try {
			const result = await fixHeaders({
				cwd: workspace,
				...IDENTITY,
				dryRun: true,
				input: ["b.mjs", "lib", "lib/one.mjs", "./b.mjs", join(workspace, "a.mjs")]
			});
			expect(result.changes.map((change) => change.file)).toEqual(["b.mjs", join("lib", "one.mjs"), join("lib", "two.mjs"), "a.mjs"]);
			expect(result.filesScanned).toBe(4);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("treats a string input as before and an empty list as no input", async () => {
		const workspace = await createInputWorkspace("input-api-string");
		try {
			const single = await fixHeaders({ cwd: workspace, ...IDENTITY, dryRun: true, input: "lib" });
			expect(single.filesScanned).toBe(2);

			const empty = await fixHeaders({ cwd: workspace, ...IDENTITY, dryRun: true, input: [] });
			expect(empty.filesScanned).toBe(5);

			const blanks = await fixHeaders({ cwd: workspace, ...IDENTITY, dryRun: true, input: ["", "  "] });
			expect(blanks.filesScanned).toBe(5);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("names the missing path when one of several inputs does not exist, and rejects non-path entries", async () => {
		const workspace = await createInputWorkspace("input-api-invalid");
		try {
			await expect(fixHeaders({ cwd: workspace, ...IDENTITY, dryRun: true, input: ["a.mjs", "missing.mjs"] })).rejects.toThrow(
				"Input path does not exist: missing.mjs"
			);
			await expect(fixHeaders({ cwd: workspace, ...IDENTITY, dryRun: true, input: ["a.mjs", 3] })).rejects.toThrow(
				/input must be a path or an array of paths/
			);
			await expect(fixHeaders({ cwd: workspace, ...IDENTITY, dryRun: true, input: 3 })).rejects.toThrow(
				/input must be a path or an array of paths/
			);
			expect(await readFile(join(workspace, "a.mjs"), "utf8")).toBe("export const a = 1;\n");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});
