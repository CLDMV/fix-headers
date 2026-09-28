/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/date-check.test.vitest.mjs
 *	@Date: 2026-09-28T09:16:17-07:00 (1790612177)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28T09:16:17-07:00 (1790612177)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { join } from "node:path";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { parseCliArgs, runCli } from "../src/cli.mjs";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import { checkHeaderDates, normalizeDatePayload, repairDateEpoch } from "../src/header/dates.mjs";
import { formatIsoDate, parseHeaderDate } from "../src/utils/time.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview Header date validation (`check`), epoch repair, `fixCreatedDate`, and `normalizeDateFormat`.
 * @module fix-headers/tests/date-check
 */

const execFileAsync = promisify(execFile);

/**
 * Timeout for tests that build a git fixture and run the full pipeline (some several times):
 * each run spawns two git processes per file, which exceeds vitest's 5s default under coverage
 * instrumentation and parallel workers.
 */
const GIT_FIXTURE_TIMEOUT = { timeout: 30_000 };

/** Author/committer date of every fixture commit, and its unix timestamp. */
const COMMIT_DATE = "2026-09-20T15:33:32+00:00";
const COMMIT_TIMESTAMP = 1789918412;

/**
 * Renders a JS header block with the given date values.
 * @param {string} fileName - Project-relative file path (without leading slash).
 * @param {string} createdValue - Raw `@Date` value.
 * @param {string} modifiedValue - Raw `@Last modified time` value.
 * @param {string} [author="Someone Else"] - `@Author` / `@Last modified by` name.
 * @returns {string} File content with header.
 */
function fileWithHeader(fileName, createdValue, modifiedValue, author = "Someone Else") {
	return `/**\n *\t@Project: date-check\n *\t@Filename: /${fileName}\n *\t@Date: ${createdValue}\n *\t@Author: ${author}\n *\t@Email: <else@example.com>\n *\t-----\n *\t@Last modified by: ${author} (else@example.com)\n *\t@Last modified time: ${modifiedValue}\n *\t-----\n *\t@Copyright: Copyright (c) 2020-2026 Catalyzed Motivation Inc. All rights reserved.\n */\n\nexport const value = 1;\n`;
}

/**
 * Initializes a git repository and commits everything with a fixed author/committer date.
 * @param {string} workspace - Workspace path.
 * @returns {Promise<void>} Completion promise.
 */
async function commitWorkspace(workspace) {
	const env = { ...process.env, GIT_AUTHOR_DATE: COMMIT_DATE, GIT_COMMITTER_DATE: COMMIT_DATE };
	await execFileAsync("git", ["init"], { cwd: workspace });
	await execFileAsync("git", ["config", "user.name", "Date Check Tester"], { cwd: workspace });
	await execFileAsync("git", ["config", "user.email", "date-check@example.com"], { cwd: workspace });
	await execFileAsync("git", ["add", "."], { cwd: workspace });
	await execFileAsync("git", ["commit", "--no-gpg-sign", "-m", "initial"], { cwd: workspace, env });
}

/**
 * Creates a committed workspace holding the standard date-check fixtures.
 * - `src/good.mjs`: dates match git, written in another offset/format, foreign author identity.
 * - `src/epoch.mjs`: `@Date` epoch is a year off its datetime text.
 * - `src/invented.mjs`: consistent but invented midnight `@Date`, `@Last modified time` a day after the commit.
 * - `src/bare.mjs`: no header at all.
 * - `src/untracked.mjs` (written after the commit): invented `@Date`, but no git history.
 * @param {string} name - Workspace name.
 * @returns {Promise<string>} Workspace path.
 */
async function createDateFixture(name) {
	const workspace = await createWorkspace(name);
	await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "date-check" }, null, 2));
	await writeWorkspaceFile(
		join(workspace, "src", "good.mjs"),
		fileWithHeader("src/good.mjs", "2026-09-20 08:33:32 -07:00 (1789918412)", "2026-09-20T15:33:32+00:00 (1789918412)")
	);
	await writeWorkspaceFile(
		join(workspace, "src", "epoch.mjs"),
		fileWithHeader("src/epoch.mjs", "2026-09-20T15:33:32+00:00 (1758382412)", "2026-09-20T15:33:32+00:00 (1789918412)")
	);
	await writeWorkspaceFile(
		join(workspace, "src", "invented.mjs"),
		fileWithHeader("src/invented.mjs", "2026-09-20 00:00:00 -07:00 (1789887600)", "2026-09-21 09:00:00 -07:00 (1790006400)")
	);
	await writeWorkspaceFile(join(workspace, "src", "bare.mjs"), "export const bare = true;\n");
	await commitWorkspace(workspace);
	await writeWorkspaceFile(
		join(workspace, "src", "untracked.mjs"),
		fileWithHeader("src/untracked.mjs", "2026-09-20 00:00:00 -07:00 (1789887600)", "2026-09-20 00:00:00 -07:00 (1789887600)")
	);
	return workspace;
}

/**
 * Reads the `@Date` and `@Last modified time` lines of a workspace file.
 * @param {string} workspace - Workspace path.
 * @param {string} fileName - Project-relative file path.
 * @returns {Promise<{created: string, modified: string}>} Raw header values.
 */
async function readDates(workspace, fileName) {
	const content = await readFile(join(workspace, fileName), "utf8");
	return {
		created: content.match(/@Date: (.*)$/m)[1],
		modified: content.match(/@Last modified time: (.*)$/m)[1]
	};
}

/**
 * Maps a check-mode result to `{ file: check[] }`, omitting files without issues.
 * @param {{changes: Array<{file: string, dateIssues?: Array<{check: string}>}>}} result - Check-mode result.
 * @returns {Record<string, string[]>} Issue ids per file.
 */
function issueIdsByFile(result) {
	return Object.fromEntries(
		result.changes
			.filter((change) => change.dateIssues.length > 0)
			.map((change) => [change.file, change.dateIssues.map((issue) => issue.check)])
	);
}

describe("parseHeaderDate / formatIsoDate", () => {
	it("parses the git T-form, the space form, Z, compact offsets, and fractional seconds to the same instant", () => {
		const forms = [
			"2026-09-20T15:33:32+00:00",
			"2026-09-20 08:33:32 -07:00",
			"2026-09-20T15:33:32Z",
			"2026-09-20t15:33:32.250z",
			"2026-09-20T21:03:32+0530",
			"  2026-09-20 08:33:32 -0700  "
		];
		for (const form of forms) {
			expect(parseHeaderDate(form)?.timestamp, form).toBe(COMMIT_TIMESTAMP);
		}
		expect(parseHeaderDate("2026-09-20 08:33:32 -07:00")).toEqual({
			year: 2026,
			month: 9,
			day: 20,
			hour: 8,
			minute: 33,
			second: 32,
			offsetMinutes: -420,
			timestamp: COMMIT_TIMESTAMP
		});
	});

	it("rejects datetimes without an offset, calendar-invalid values, and other text", () => {
		for (const text of [
			"2026-09-20 08:33:32",
			"2026-13-01T00:00:00Z",
			"2026-02-30T00:00:00Z",
			"2026-09-20T24:00:00Z",
			"2026-09-20T23:60:00Z",
			"2026-09-20T23:00:00+05:60",
			"September 20, 2026",
			""
		]) {
			expect(parseHeaderDate(text), text).toBeNull();
		}
	});

	it("renders the git %aI form, keeping the offset", () => {
		expect(formatIsoDate(parseHeaderDate("2026-09-20 08:33:32 -07:00"))).toBe("2026-09-20T08:33:32-07:00");
		expect(formatIsoDate(parseHeaderDate("2026-09-20T15:33:32Z"))).toBe(COMMIT_DATE);
		expect(formatIsoDate(parseHeaderDate("2026-01-02 03:04:05 +0545"))).toBe("2026-01-02T03:04:05+05:45");
	});
});

describe("checkHeaderDates", () => {
	const header = (created, modified) => fileWithHeader("src/x.mjs", created, modified);
	const consistent = "2026-09-20 08:33:32 -07:00 (1789918412)";

	it("reports nothing for consistent dates, a header without date fields, and no header", () => {
		expect(checkHeaderDates(header(consistent, consistent))).toEqual([]);
		expect(checkHeaderDates("/**\n *\t@Project: x\n */")).toEqual([]);
		expect(checkHeaderDates("")).toEqual([]);
	});

	it("flags an epoch that does not decode to its datetime text, per field", () => {
		const issues = checkHeaderDates(header("2026-09-20T15:33:32+00:00 (1758382412)", "2026-09-20T15:33:32+00:00 (1758382413)"));
		expect(issues).toEqual([
			{
				check: "created-epoch",
				field: "@Date",
				advisory: false,
				value: "2026-09-20T15:33:32+00:00 (1758382412)",
				expected: "2026-09-20T15:33:32+00:00 (1789918412)",
				message: "@Date epoch 1758382412 does not match 2026-09-20T15:33:32+00:00 (expected 1789918412)"
			},
			{
				check: "modified-epoch",
				field: "@Last modified time",
				advisory: false,
				value: "2026-09-20T15:33:32+00:00 (1758382413)",
				expected: "2026-09-20T15:33:32+00:00 (1789918412)",
				message: "@Last modified time epoch 1758382413 does not match 2026-09-20T15:33:32+00:00 (expected 1789918412)"
			}
		]);
	});

	it("flags values without an epoch or with an unrecognised datetime", () => {
		const issues = checkHeaderDates(header("2026-09-17 00:00:00 -07:00", "last tuesday (1789918412)"));
		expect(issues.map((issue) => [issue.check, issue.advisory])).toEqual([
			["created-format", false],
			["modified-format", false]
		]);
		expect(issues[0].message).toBe(
			'@Date value "2026-09-17 00:00:00 -07:00" is not a "<datetime> (<epoch>)" pair with a recognised datetime'
		);
	});

	it("compares against git by instant: @Date drift fails, @Last modified time drift is advisory", () => {
		const git = {
			gitCreated: { date: COMMIT_DATE, timestamp: COMMIT_TIMESTAMP },
			gitLastModified: { date: COMMIT_DATE, timestamp: COMMIT_TIMESTAMP }
		};
		expect(checkHeaderDates(header(consistent, consistent), git)).toEqual([]);

		const issues = checkHeaderDates(header("2026-09-20 00:00:00 -07:00 (1789887600)", "2026-09-21 09:00:00 -07:00 (1790006400)"), git);
		expect(issues).toEqual([
			{
				check: "created-git",
				field: "@Date",
				advisory: false,
				value: "2026-09-20 00:00:00 -07:00 (1789887600)",
				expected: `${COMMIT_DATE} (${COMMIT_TIMESTAMP})`,
				message: `@Date 2026-09-20 00:00:00 -07:00 does not match the git first commit ${COMMIT_DATE} (${COMMIT_TIMESTAMP})`
			},
			{
				check: "modified-git",
				field: "@Last modified time",
				advisory: true,
				value: "2026-09-21 09:00:00 -07:00 (1790006400)",
				expected: `${COMMIT_DATE} (${COMMIT_TIMESTAMP})`,
				message: `@Last modified time 2026-09-21 09:00:00 -07:00 does not match the git last commit ${COMMIT_DATE} (${COMMIT_TIMESTAMP})`
			}
		]);
		expect(
			checkHeaderDates(header("2026-09-20 00:00:00 -07:00 (1789887600)", consistent), { gitCreated: null, gitLastModified: null })
		).toEqual([]);
	});
});

describe("repairDateEpoch / normalizeDatePayload", () => {
	it("recomputes a mismatched epoch from the datetime text and leaves everything else alone", () => {
		const consistent = { date: "2026-09-20 08:33:32 -07:00", timestamp: COMMIT_TIMESTAMP };
		const unparseable = { date: "last tuesday", timestamp: 5 };
		expect(repairDateEpoch(null)).toBeNull();
		expect(repairDateEpoch(consistent)).toBe(consistent);
		expect(repairDateEpoch(unparseable)).toBe(unparseable);
		expect(repairDateEpoch({ date: "2026-09-20 08:33:32 -07:00", timestamp: 1758382412 })).toEqual(consistent);
	});

	it("rewrites datetime text in the T-form and leaves unrecognised text alone", () => {
		const unparseable = { date: "last tuesday", timestamp: 5 };
		expect(normalizeDatePayload({ date: "2026-09-20 08:33:32 -07:00", timestamp: COMMIT_TIMESTAMP })).toEqual({
			date: "2026-09-20T08:33:32-07:00",
			timestamp: COMMIT_TIMESTAMP
		});
		expect(normalizeDatePayload(unparseable)).toBe(unparseable);
	});
});

describe("fixHeaders check mode", GIT_FIXTURE_TIMEOUT, () => {
	it("reports date drift per file, independent of identity/content diffs, and writes nothing", async () => {
		const workspace = await createDateFixture("date-check-core");

		try {
			const before = await readFile(join(workspace, "src", "good.mjs"), "utf8");
			const result = await fixHeaders({ cwd: workspace, includeFolders: ["src"], check: true });

			expect(result.check).toBe(true);
			expect(result.dryRun).toBe(true);
			// good.mjs would be rewritten by a normal run (copyright/author content differs) but has no date drift.
			expect(result.changes.find((change) => change.file === join("src", "good.mjs")).changed).toBe(true);
			expect(issueIdsByFile(result)).toEqual({
				[join("src", "epoch.mjs")]: ["created-epoch"],
				[join("src", "invented.mjs")]: ["created-git", "modified-git"]
			});
			expect(result.filesWithDateDrift).toBe(2);
			expect(result.dateAdvisories).toBe(1);
			expect(await readFile(join(workspace, "src", "good.mjs"), "utf8")).toBe(before);
			expect(await readFile(join(workspace, "src", "bare.mjs"), "utf8")).toBe("export const bare = true;\n");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("omits check fields outside check mode", async () => {
		const workspace = await createDateFixture("date-check-off");

		try {
			const result = await fixHeaders({ cwd: workspace, includeFolders: ["src"], dryRun: true });
			expect(result.check).toBe(false);
			expect(result).not.toHaveProperty("filesWithDateDrift");
			expect(result).not.toHaveProperty("dateAdvisories");
			expect(result.changes.every((change) => !("dateIssues" in change))).toBe(true);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});

describe("fixHeaders date correction", GIT_FIXTURE_TIMEOUT, () => {
	it("repairs a mismatched epoch by default and keeps an existing @Date", async () => {
		const workspace = await createDateFixture("date-fix-default");

		try {
			await fixHeaders({ cwd: workspace, includeFolders: ["src"] });

			expect((await readDates(workspace, "src/epoch.mjs")).created).toBe("2026-09-20T15:33:32+00:00 (1789918412)");
			expect((await readDates(workspace, "src/invented.mjs")).created).toBe("2026-09-20 00:00:00 -07:00 (1789887600)");
			expect((await readDates(workspace, "src/good.mjs")).created).toBe("2026-09-20 08:33:32 -07:00 (1789918412)");

			// Only the invented @Date is left; untracked.mjs has no git history, so its @Date is not compared.
			const recheck = await fixHeaders({ cwd: workspace, includeFolders: ["src"], check: true });
			const failing = recheck.changes.flatMap((change) =>
				change.dateIssues.filter((issue) => !issue.advisory).map((issue) => `${change.file}:${issue.check}`)
			);
			expect(failing).toEqual([`${join("src", "invented.mjs")}:created-git`]);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("repairs a mismatched @Last modified time epoch when nothing else changes", async () => {
		const workspace = await createWorkspace("date-fix-modified-epoch");

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "date-check" }, null, 2));
			const current = new Date().getFullYear();
			await writeWorkspaceFile(
				join(workspace, "src", "one.mjs"),
				fileWithHeader("src/one.mjs", "2026-09-20 08:33:32 -07:00 (1789918412)", "2026-09-20 08:33:32 -07:00 (1758382412)").replace(
					"2020-2026",
					`${current}-${current}`
				)
			);
			const result = await fixHeaders({
				cwd: workspace,
				input: "src/one.mjs",
				authorName: "Someone Else",
				authorEmail: "else@example.com"
			});

			expect(result.filesUpdated).toBe(1);
			const dates = await readDates(workspace, "src/one.mjs");
			expect(dates.created).toBe("2026-09-20 08:33:32 -07:00 (1789918412)");
			expect(dates.modified).not.toContain("(1758382412)");
			expect(checkHeaderDates(await readFile(join(workspace, "src", "one.mjs"), "utf8"))).toEqual([]);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("fixCreatedDate replaces a drifted @Date with the git first commit, keeping same-instant and untracked dates", async () => {
		const workspace = await createDateFixture("date-fix-created");

		try {
			const result = await fixHeaders({ cwd: workspace, includeFolders: ["src"], fixCreatedDate: true, sampleOutput: true });

			expect((await readDates(workspace, "src/invented.mjs")).created).toBe(`${COMMIT_DATE} (${COMMIT_TIMESTAMP})`);
			expect((await readDates(workspace, "src/epoch.mjs")).created).toBe(`${COMMIT_DATE} (${COMMIT_TIMESTAMP})`);
			expect((await readDates(workspace, "src/good.mjs")).created).toBe("2026-09-20 08:33:32 -07:00 (1789918412)");
			expect((await readDates(workspace, "src/untracked.mjs")).created).toBe("2026-09-20 00:00:00 -07:00 (1789887600)");
			const sources = Object.fromEntries(result.changes.map((change) => [change.file, change.sample.detectedValues.createdAtSource]));
			expect(sources[join("src", "invented.mjs")]).toBe("git-created");
			expect(sources[join("src", "good.mjs")]).toBe("existing-header");
			expect(sources[join("src", "untracked.mjs")]).toBe("existing-header");

			const recheck = await fixHeaders({ cwd: workspace, includeFolders: ["src"], check: true });
			expect(recheck.filesWithDateDrift).toBe(0);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("normalizeDateFormat writes every date in the git T-form without moving the instant", async () => {
		const workspace = await createDateFixture("date-fix-normalize");

		try {
			await fixHeaders({ cwd: workspace, includeFolders: ["src"], normalizeDateFormat: true });

			const good = await readDates(workspace, "src/good.mjs");
			expect(good.created).toBe("2026-09-20T08:33:32-07:00 (1789918412)");
			expect(good.modified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2} \(\d+\)$/);
			const bare = await readDates(workspace, "src/bare.mjs");
			expect(bare.created).toBe(`${COMMIT_DATE} (${COMMIT_TIMESTAMP})`);
			expect(bare.modified).toMatch(/T/);
			const recheck = await fixHeaders({ cwd: workspace, includeFolders: ["src"], check: true });
			expect(
				recheck.changes.flatMap((change) => change.dateIssues.map((issue) => issue.check)).filter((id) => id.endsWith("-epoch"))
			).toEqual([]);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("without normalizeDateFormat keeps the space form for filesystem/current-time dates", async () => {
		const workspace = await createWorkspace("date-fix-space-form");

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "date-check" }, null, 2));
			await writeWorkspaceFile(join(workspace, "src", "one.mjs"), "export const one = 1;\n");
			await fixHeaders({ cwd: workspace, input: "src/one.mjs" });

			const dates = await readDates(workspace, "src/one.mjs");
			expect(dates.created).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{2}:\d{2} \(\d+\)$/);
			expect(dates.modified).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{2}:\d{2} \(\d+\)$/);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});

describe("CLI date options", GIT_FIXTURE_TIMEOUT, () => {
	it("parses --check, --fix-created-date, and --normalize-date-format", () => {
		expect(parseCliArgs(["--check", "--fix-created-date", "--normalize-date-format"]).options).toEqual({
			check: true,
			fixCreatedDate: true,
			normalizeDateFormat: true
		});
	});

	it("--check exits 1 on drift, lists failing checks, and shows advisories only with --verbose", async () => {
		const workspace = await createDateFixture("date-cli-check");

		try {
			const lines = [];
			const code = await runCli(["--check", "--cwd", workspace, "--include-folder", "src"], { stdout: (line) => lines.push(line) });
			expect(code).toBe(1);
			expect(lines).toEqual([
				"fix-headers check: scanned=5, drift=2, advisories=1",
				`drift: ${join("src", "epoch.mjs")}: @Date epoch 1758382412 does not match 2026-09-20T15:33:32+00:00 (expected 1789918412)`,
				`drift: ${join("src", "invented.mjs")}: @Date 2026-09-20 00:00:00 -07:00 does not match the git first commit ${COMMIT_DATE} (${COMMIT_TIMESTAMP})`
			]);

			const verboseLines = [];
			await runCli(["--check", "--verbose", "--cwd", workspace, "--include-folder", "src"], { stdout: (line) => verboseLines.push(line) });
			expect(verboseLines.at(-1)).toBe(
				`advisory: ${join("src", "invented.mjs")}: @Last modified time 2026-09-21 09:00:00 -07:00 does not match the git last commit ${COMMIT_DATE} (${COMMIT_TIMESTAMP})`
			);

			const jsonLines = [];
			const jsonCode = await runCli(["--check", "--json", "--cwd", workspace, "--include-folder", "src"], {
				stdout: (line) => jsonLines.push(line)
			});
			expect(jsonCode).toBe(1);
			expect(JSON.parse(jsonLines[0]).filesWithDateDrift).toBe(2);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("--check exits 0 when only advisories remain, and --dry-run still exits 0 with drift", async () => {
		const workspace = await createDateFixture("date-cli-clean");

		try {
			const dryRunCode = await runCli(["--dry-run", "--cwd", workspace, "--include-folder", "src"], { stdout: () => {} });
			expect(dryRunCode).toBe(0);

			await runCli(["--fix-created-date", "--cwd", workspace, "--include-folder", "src"], { stdout: () => {} });
			const lines = [];
			const code = await runCli(["--check", "--cwd", workspace, "--include-folder", "src"], { stdout: (line) => lines.push(line) });
			expect(code).toBe(0);
			expect(lines).toHaveLength(1);
			expect(lines[0]).toMatch(/^fix-headers check: scanned=5, drift=0, advisories=\d+$/);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("tolerates sparse check results from a custom runner", async () => {
		const lines = [];
		const code = await runCli(["--check"], { runner: async () => ({ check: true }), stdout: (line) => lines.push(line) });
		expect(code).toBe(0);
		expect(lines).toEqual(["fix-headers check: scanned=0, drift=0, advisories=0"]);

		const sparseLines = [];
		const sparseCode = await runCli(["--check", "--verbose"], {
			runner: async () => ({
				check: true,
				filesScanned: 3,
				filesWithDateDrift: 1,
				dateAdvisories: 1,
				changes: [
					null,
					{ file: "a.mjs" },
					{
						dateIssues: [
							{ advisory: false, message: "bad" },
							{ advisory: true, message: "old" }
						]
					}
				]
			}),
			stdout: (line) => sparseLines.push(line)
		});
		expect(sparseCode).toBe(1);
		expect(sparseLines).toEqual([
			"fix-headers check: scanned=3, drift=1, advisories=1",
			"drift: <unknown-file>: bad",
			"advisory: <unknown-file>: old"
		]);
	});
});
