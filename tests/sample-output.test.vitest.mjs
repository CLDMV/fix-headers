/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/sample-output.test.vitest.mjs
 *	@Date: 2026-09-28T09:14:18-07:00 (1790612058)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28T09:14:18-07:00 (1790612058)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCliArgs, runCli } from "../src/cli.mjs";
import { fixHeaders as coreFixHeaders } from "../src/core/fix-headers.mjs";
import { HEADER_FIELDS } from "../src/header/fields.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * Builds a stale header for `src/one.mjs` whose project, filename and copyright no longer match.
 * @param {string} [prefix=""] - Text placed before the header (e.g. a shebang line).
 * @returns {string} File content with the stale header.
 */
function staleFile(prefix = "") {
	return `${prefix}/**\n *\t@Project: old-project-name\n *\t@Filename: /src/old-name.mjs\n *\t@Date: 2026-01-01 00:00:00 +00:00 (1735689600)\n *\t@Author: Existing Author\n *\t@Email: <existing@example.com>\n *\t-----\n *\t@Last modified by: Existing Author (existing@example.com)\n *\t@Last modified time: 2026-01-02 00:00:00 +00:00 (1735776000)\n *\t-----\n *\t@Copyright: Copyright (c) 2013-2026 Old Company All rights reserved.\n */\n\nexport const one = true;\n`;
}

/**
 * Runs the core in dry-run sample mode against `src/one.mjs` of a fresh workspace.
 * @param {string} name - Workspace/project name.
 * @param {string} content - Content for `src/one.mjs`.
 * @param {Record<string, unknown>} [options={}] - Extra fixHeaders options.
 * @returns {Promise<Awaited<ReturnType<typeof coreFixHeaders>>["changes"][number]>} The single change entry.
 */
async function sampleFor(name, content, options = {}) {
	const workspace = await createWorkspace(name);
	try {
		await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name }, null, 2));
		await writeWorkspaceFile(join(workspace, "src", "one.mjs"), content);
		const result = await coreFixHeaders({
			cwd: workspace,
			input: "src/one.mjs",
			dryRun: true,
			authorName: "Detected Author",
			authorEmail: "detected@example.com",
			companyName: "New Company Inc.",
			copyrightStartYear: 2020,
			...options
		});
		expect(result.changes).toHaveLength(1);
		return result.changes[0];
	} finally {
		await cleanupWorkspace(workspace);
	}
}

describe("sample output field issues and diff", () => {
	it("reports the differing fields and a unified diff for a stale header", async () => {
		const change = await sampleFor("sample-issues-stale", staleFile(), { sampleOutput: true });
		const currentYear = String(new Date().getFullYear());

		expect(change.changed).toBe(true);
		const issues = change.sample.issues;
		const byField = Object.fromEntries(issues.map((issue) => [issue.field, issue]));
		expect(issues.map((issue) => issue.field)).toEqual(
			["projectName", "filename", "lastModifiedAt", "copyrightStartYear", "copyrightEndYear", "companyName"].filter(
				(field) => field !== "copyrightEndYear" || currentYear !== "2026"
			)
		);
		expect(byField.projectName).toEqual({ field: "projectName", previous: "old-project-name", detected: "sample-issues-stale" });
		expect(byField.filename).toEqual({ field: "filename", previous: "/src/old-name.mjs", detected: "/src/one.mjs" });
		expect(byField.lastModifiedAt.previous).toBe("2026-01-02 00:00:00 +00:00 (1735776000)");
		expect(byField.copyrightStartYear).toEqual({ field: "copyrightStartYear", previous: "2013", detected: "2020" });
		expect(byField.companyName).toEqual({ field: "companyName", previous: "Old Company", detected: "New Company Inc." });
		// Preserved identity fields are compared against what is written, so they do not show up.
		expect(byField.authorName).toBeUndefined();
		expect(byField.lastModifiedByName).toBeUndefined();

		const diff = change.sample.diff;
		expect(diff.startsWith("--- a/src/one.mjs\n+++ b/src/one.mjs\n@@ -1,12 +1,12 @@\n")).toBe(true);
		expect(diff).toContain("\n- *\t@Project: old-project-name\n");
		expect(diff).toContain("\n+ *\t@Project: sample-issues-stale\n");
		expect(diff).toContain("\n  *\t@Author: Existing Author\n");
		expect(diff).toContain("\n+ *\t@Copyright: Copyright (c) 2020-");
	});

	it("reports author identity changes when the update is forced", async () => {
		const change = await sampleFor("sample-issues-forced", staleFile(), {
			sampleOutput: true,
			forceAuthorUpdate: true,
			forceLastModifiedAuthorUpdate: true
		});
		const byField = Object.fromEntries(change.sample.issues.map((issue) => [issue.field, issue]));

		expect(byField.authorName).toEqual({ field: "authorName", previous: "Existing Author", detected: "Detected Author" });
		expect(byField.authorEmail).toEqual({ field: "authorEmail", previous: "existing@example.com", detected: "detected@example.com" });
		expect(byField.lastModifiedByName).toEqual({ field: "lastModifiedByName", previous: "Existing Author", detected: "Detected Author" });
		expect(byField.lastModifiedByEmail).toEqual({
			field: "lastModifiedByEmail",
			previous: "existing@example.com",
			detected: "detected@example.com"
		});
		expect(change.sample.diff).toContain("\n+ *\t@Author: Detected Author\n");
	});

	it("shows the whole header as added when the file had none", async () => {
		const change = await sampleFor("sample-issues-new", "export const one = true;\n", { sampleOutput: true });

		expect(change.sample.previousValue).toBeNull();
		expect(change.sample.issues.map((issue) => issue.field)).toEqual([...HEADER_FIELDS]);
		expect(change.sample.issues.every((issue) => issue.previous === null)).toBe(true);
		const lines = change.sample.diff.split("\n");
		expect(lines.slice(0, 3)).toEqual(["--- /dev/null", "+++ b/src/one.mjs", "@@ -0,0 +1,12 @@"]);
		expect(lines.slice(3).every((line) => line.startsWith("+"))).toBe(true);
		expect(lines.slice(3).map((line) => line.slice(1))).toEqual(change.sample.newValue.split("\n"));
	});

	it("numbers hunks relative to the file when a shebang precedes the header", async () => {
		const existing = await sampleFor("sample-issues-shebang", staleFile("#!/usr/bin/env node\n"), { sampleOutput: true });
		expect(existing.sample.diff).toContain("@@ -2,12 +2,12 @@");

		const inserted = await sampleFor("sample-issues-shebang-new", "#!/usr/bin/env node\nexport const one = true;\n", {
			sampleOutput: true
		});
		expect(inserted.sample.diff).toContain("@@ -1,0 +2,12 @@");
	});

	it("adds no sample when sampleOutput is off", async () => {
		const change = await sampleFor("sample-issues-off", staleFile());
		expect(change.changed).toBe(true);
		expect(change.sample).toBeUndefined();
	});
});

describe("cli --diff and --verbose issue output", () => {
	const sampleResult = {
		filesScanned: 2,
		filesUpdated: 2,
		dryRun: true,
		changes: [
			{
				file: "src/a.mjs",
				changed: true,
				sample: {
					previousValue: "old",
					newValue: "new",
					diff: "--- a/src/a.mjs\n+++ b/src/a.mjs\n@@ -1,1 +1,1 @@\n-old\n+new",
					issues: [
						{ field: "authorName", previous: "Old Author", detected: "New Author" },
						{ field: "companyName", previous: null, detected: "ACME" }
					]
				}
			},
			{ file: "src/b.mjs", changed: true, sample: { previousValue: "same", newValue: "same", diff: "", issues: [] } },
			{ file: "src/c.mjs", changed: false }
		]
	};

	/**
	 * Runs the CLI against a stub runner and captures stdout plus the runner options.
	 * @param {string[]} argv - CLI arguments.
	 * @param {unknown} [result=sampleResult] - Runner result.
	 * @returns {Promise<{ code: number, output: string, options: Record<string, unknown> }>} Captured run.
	 */
	async function run(argv, result = sampleResult) {
		const stdout = [];
		let options = {};
		const code = await runCli(argv, {
			runner: async (runnerOptions) => {
				options = runnerOptions;
				return result;
			},
			stdout: (message) => stdout.push(message)
		});
		return { code, output: stdout.join("\n"), options };
	}

	it("parses --diff as a control flag", () => {
		expect(parseCliArgs(["--diff"]).diff).toBe(true);
		expect(parseCliArgs([]).diff).toBe(false);
		expect(parseCliArgs(["--diff"]).options.sampleOutput).toBeUndefined();
	});

	it("--diff requests samples and prints only the diffs", async () => {
		const { code, output, options } = await run(["--diff"]);

		expect(code).toBe(0);
		expect(options.sampleOutput).toBe(true);
		expect(output).toContain("--- a/src/a.mjs\n+++ b/src/a.mjs\n@@ -1,1 +1,1 @@\n-old\n+new");
		expect(output).not.toContain("sample:");
		expect(output).not.toContain("issues:");
		expect(output).not.toContain("src/b.mjs");
	});

	it("--diff with --json passes sampleOutput through to the runner", async () => {
		const { options, output } = await run(["--diff", "--json"]);
		expect(options.sampleOutput).toBe(true);
		expect(JSON.parse(output)).toEqual(sampleResult);
	});

	it("--verbose with --sample-output prints each file's issues", async () => {
		const { output, options } = await run(["--verbose", "--sample-output"]);

		expect(options.sampleOutput).toBe(true);
		expect(output).toContain(
			[
				"updated: src/a.mjs",
				"updated: src/b.mjs",
				"issues: src/a.mjs",
				'  authorName: found "Old Author", expected "New Author"',
				'  companyName: found (missing), expected "ACME"',
				"issues: src/b.mjs",
				"  (no field differences; header formatting only)",
				"sample: src/a.mjs"
			].join("\n")
		);
		expect(output).not.toContain("--- a/src/a.mjs");
	});

	it("--verbose with --diff prints issues and diffs", async () => {
		const { output } = await run(["--verbose", "--diff"]);
		expect(output).toContain('issues: src/a.mjs\n  authorName: found "Old Author", expected "New Author"');
		expect(output).toContain("--- a/src/a.mjs");
		expect(output).not.toContain("sample:");
	});

	it("--verbose alone prints no issues", async () => {
		const { output, options } = await run(["--verbose"]);
		expect(options.sampleOutput).toBeUndefined();
		expect(output).toContain("updated: src/a.mjs");
		expect(output).not.toContain("issues:");
	});

	it("tolerates malformed issue and diff payloads", async () => {
		const { output } = await run(["--verbose", "--diff"], {
			changes: [
				{ changed: true, sample: { newValue: "x", issues: [null, { previous: "p" }] } },
				{ file: "src/d.mjs", changed: true, sample: { newValue: "x", issues: "invalid", diff: 42 } }
			]
		});

		expect(output).toContain(
			'issues: <unknown-file>\n  <unknown-field>: found (missing), expected (missing)\n  <unknown-field>: found "p", expected (missing)'
		);
		expect(output).toContain("issues: src/d.mjs\n  (no field differences; header formatting only)");
		expect(output).not.toContain("---");
	});

	it("prints diffs and issues for non-object results without failing", async () => {
		const { code, output } = await run(["--verbose", "--diff"], "ok");
		expect(code).toBe(0);
		expect(output).toBe("fix-headers complete");
	});

	it("prints a real diff end to end through the default runner", async () => {
		const workspace = await createWorkspace("sample-cli-e2e");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "sample-cli-e2e" }, null, 2));
			await writeWorkspaceFile(join(workspace, "src", "one.mjs"), staleFile());
			const stdout = [];
			const code = await runCli(["--cwd", workspace, "--input", "src/one.mjs", "--dry-run", "--diff", "--verbose"], {
				stdout: (message) => stdout.push(message)
			});
			const output = stdout.join("\n");

			expect(code).toBe(0);
			expect(output).toContain("updated: src/one.mjs");
			expect(output).toContain('  projectName: found "old-project-name", expected "sample-cli-e2e"');
			expect(output).toContain("--- a/src/one.mjs\n+++ b/src/one.mjs\n@@ -1,12 +1,12 @@");
			expect(output).toContain("\n- *\t@Project: old-project-name\n");
			expect(output).toContain("\n+ *\t@Project: sample-cli-e2e\n");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});
