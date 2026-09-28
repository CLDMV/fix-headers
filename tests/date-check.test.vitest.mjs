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
import { readFile, utimes } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { parseCliArgs, runCli } from "../src/cli.mjs";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import { checkHeaderDates, normalizeDatePayload, pickOldestDate, repairDateEpoch, resolveCreatedDate } from "../src/header/dates.mjs";
import { formatIsoDate, parseHeaderDate } from "../src/utils/time.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview Header date validation (`check`), "oldest wins" creation dates, epoch repair,
 * `fixCreatedDate`, `strictCreatedDate`, and `normalizeDateFormat`.
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
/** A consistent `@Date` five minutes before the commit, as stamped from a file's birth time before its first commit. */
const EARLY_DATE = "2026-09-20 08:28:32 -07:00 (1789918112)";
/** A consistent `@Date` a day after the commit. */
const LATER_DATE = "2026-09-21 09:00:00 -07:00 (1790006400)";
/** Backdated modification time (2026-09-01T00:00:00Z) that makes the filesystem the oldest source. */
const FS_OLD_TIMESTAMP = 1788220800;

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
 * Creates a committed workspace holding the standard date-check fixtures. The files are written
 * now, so their filesystem creation time is later than the commit unless backdated.
 * - `src/good.mjs`: `@Date` is the commit instant in another offset/format; foreign author identity.
 * - `src/epoch.mjs`: `@Date` epoch is a year off its datetime text.
 * - `src/early.mjs`: `@Date` five minutes before the commit (stamped before the first commit).
 * - `src/later.mjs`: `@Date` and `@Last modified time` a day after the commit.
 * - `src/fsolder.mjs`: `@Date` is the commit instant, but the file's mtime is backdated before it.
 * - `src/bare.mjs`: no header.
 * - `src/bareold.mjs`: no header, mtime backdated before the commit.
 * - `src/untracked.mjs` (written after the commit): midnight `@Date`, no git history.
 * @param {string} name - Workspace name.
 * @returns {Promise<string>} Workspace path.
 */
async function createDateFixture(name) {
	const workspace = await createWorkspace(name);
	const commitValue = `${COMMIT_DATE} (${COMMIT_TIMESTAMP})`;
	const write = (file, content) => writeWorkspaceFile(join(workspace, "src", file), content);
	await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "date-check" }, null, 2));
	await write("good.mjs", fileWithHeader("src/good.mjs", "2026-09-20 08:33:32 -07:00 (1789918412)", commitValue));
	await write("epoch.mjs", fileWithHeader("src/epoch.mjs", "2026-09-20T15:33:32+00:00 (1758382412)", commitValue));
	await write("early.mjs", fileWithHeader("src/early.mjs", EARLY_DATE, commitValue));
	await write("later.mjs", fileWithHeader("src/later.mjs", LATER_DATE, LATER_DATE));
	await write("fsolder.mjs", fileWithHeader("src/fsolder.mjs", commitValue, commitValue));
	await write("bare.mjs", "export const bare = true;\n");
	await write("bareold.mjs", "export const bareOld = true;\n");
	await commitWorkspace(workspace);
	await utimes(join(workspace, "src", "fsolder.mjs"), FS_OLD_TIMESTAMP, FS_OLD_TIMESTAMP);
	await utimes(join(workspace, "src", "bareold.mjs"), FS_OLD_TIMESTAMP, FS_OLD_TIMESTAMP);
	await write(
		"untracked.mjs",
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
 * Maps a check-mode result to `{ file: "check[:advisory]"[] }`, omitting files without issues.
 * @param {{changes: Array<{file: string, dateIssues?: Array<{check: string, advisory: boolean}>}>}} result - Check-mode result.
 * @returns {Record<string, string[]>} Issue ids per file, advisory ones suffixed `:advisory`.
 */
function issueIdsByFile(result) {
	return Object.fromEntries(
		result.changes
			.filter((change) => change.dateIssues.length > 0)
			.map((change) => [change.file, change.dateIssues.map((issue) => `${issue.check}${issue.advisory ? ":advisory" : ""}`)])
	);
}

/**
 * Maps a result's per-file created-date sources (from `sampleOutput`).
 * @param {{changes: Array<{file: string, sample?: {detectedValues?: {createdAtSource: string}}}>}} result - Run result.
 * @returns {Record<string, string>} `createdAtSource` per file.
 */
function createdSources(result) {
	return Object.fromEntries(result.changes.map((change) => [change.file, change.sample.detectedValues.createdAtSource]));
}

const src = (file) => join("src", file);

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
	const git = { date: COMMIT_DATE, timestamp: COMMIT_TIMESTAMP };
	const filesystem = { date: "2026-09-01 00:00:00 +00:00", timestamp: FS_OLD_TIMESTAMP };
	const now = { date: "2026-09-28 00:00:00 +00:00", timestamp: 1790553600 };

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

	it("flags values without an epoch or with an unrecognised datetime, and skips source comparison for them", () => {
		const issues = checkHeaderDates(header("2026-09-17 00:00:00 -07:00", "last tuesday (1789918412)"), {
			gitCreated: git,
			gitLastModified: git,
			filesystemCreated: filesystem
		});
		expect(issues.map((issue) => [issue.check, issue.advisory])).toEqual([
			["created-format", false],
			["modified-format", false]
		]);
		expect(issues[0].message).toBe(
			'@Date value "2026-09-17 00:00:00 -07:00" is not a "<datetime> (<epoch>)" pair with a recognised datetime'
		);
	});

	it("flags @Date only when it is later than the older of git and the filesystem, advisory unless strict", () => {
		// Same instant as git in another offset, and five minutes before git: both fine.
		expect(checkHeaderDates(header(consistent, consistent), { gitCreated: git, filesystemCreated: now })).toEqual([]);
		expect(
			checkHeaderDates(header(EARLY_DATE, consistent), { gitCreated: git, filesystemCreated: now }, { strictCreatedDate: true })
		).toEqual([]);

		const gitOlder = {
			check: "created-newer-than-source",
			field: "@Date",
			advisory: true,
			value: LATER_DATE,
			expected: `${COMMIT_DATE} (${COMMIT_TIMESTAMP})`,
			source: "git-created",
			message: `@Date 2026-09-21 09:00:00 -07:00 is later than the git first commit ${COMMIT_DATE} (${COMMIT_TIMESTAMP})`
		};
		expect(checkHeaderDates(header(LATER_DATE, consistent), { gitCreated: git, filesystemCreated: now })).toEqual([gitOlder]);
		expect(
			checkHeaderDates(header(LATER_DATE, consistent), { gitCreated: git, filesystemCreated: now }, { strictCreatedDate: true })
		).toEqual([{ ...gitOlder, advisory: false }]);

		expect(checkHeaderDates(header(consistent, consistent), { gitCreated: git, filesystemCreated: filesystem })).toEqual([
			{
				check: "created-newer-than-source",
				field: "@Date",
				advisory: true,
				value: consistent,
				expected: `2026-09-01 00:00:00 +00:00 (${FS_OLD_TIMESTAMP})`,
				source: "filesystem-created",
				message: `@Date 2026-09-20 08:33:32 -07:00 is later than the filesystem creation time 2026-09-01 00:00:00 +00:00 (${FS_OLD_TIMESTAMP})`
			}
		]);
		// Without git history the filesystem alone is the source.
		expect(checkHeaderDates(header(LATER_DATE, consistent), { gitCreated: null, filesystemCreated: filesystem })[0].source).toBe(
			"filesystem-created"
		);
	});

	it("compares @Last modified time against the git last commit as an advisory", () => {
		expect(checkHeaderDates(header(consistent, consistent), { gitLastModified: git })).toEqual([]);
		expect(checkHeaderDates(header(consistent, LATER_DATE), { gitLastModified: git }, { strictCreatedDate: true })).toEqual([
			{
				check: "modified-git",
				field: "@Last modified time",
				advisory: true,
				value: LATER_DATE,
				expected: `${COMMIT_DATE} (${COMMIT_TIMESTAMP})`,
				message: `@Last modified time 2026-09-21 09:00:00 -07:00 does not match the git last commit ${COMMIT_DATE} (${COMMIT_TIMESTAMP})`
			}
		]);
		expect(checkHeaderDates(header(consistent, LATER_DATE), { gitLastModified: null })).toEqual([]);
	});
});

describe("pickOldestDate / resolveCreatedDate", () => {
	const git = { date: COMMIT_DATE, timestamp: COMMIT_TIMESTAMP };
	const filesystemOld = { date: "2026-09-01 00:00:00 +00:00", timestamp: FS_OLD_TIMESTAMP };
	const filesystemNow = { date: "2026-09-28 00:00:00 +00:00", timestamp: 1790553600 };
	const early = { date: "2026-09-20 08:28:32 -07:00", timestamp: 1789918112 };
	const later = { date: "2026-09-21 09:00:00 -07:00", timestamp: 1790006400 };
	const sameAsGit = { date: "2026-09-20 08:33:32 -07:00", timestamp: COMMIT_TIMESTAMP };

	it("picks the earliest payload, skipping missing ones and keeping the first on a tie", () => {
		expect(pickOldestDate([])).toBeNull();
		expect(pickOldestDate([{ source: "a", payload: null }])).toBeNull();
		expect(
			pickOldestDate([
				{ source: "a", payload: later },
				{ source: "b", payload: undefined },
				{ source: "c", payload: early }
			])
		).toEqual({
			source: "c",
			payload: early
		});
		expect(
			pickOldestDate([
				{ source: "a", payload: sameAsGit },
				{ source: "b", payload: git }
			]).source
		).toBe("a");
	});

	it("gives a new header the older of git and the filesystem (git on a tie)", () => {
		expect(resolveCreatedDate({ existing: null, gitCreated: git, filesystemCreated: filesystemNow })).toEqual({
			source: "git-created",
			payload: git
		});
		expect(resolveCreatedDate({ existing: null, gitCreated: git, filesystemCreated: filesystemOld })).toEqual({
			source: "filesystem-created",
			payload: filesystemOld
		});
		expect(resolveCreatedDate({ existing: null, gitCreated: git, filesystemCreated: { ...git } }).source).toBe("git-created");
		expect(resolveCreatedDate({ existing: null, gitCreated: null, filesystemCreated: filesystemNow })).toEqual({
			source: "filesystem-created",
			payload: filesystemNow
		});
	});

	it("keeps an existing @Date by default, even when a source is older", () => {
		expect(resolveCreatedDate({ existing: later, gitCreated: git, filesystemCreated: filesystemOld })).toEqual({
			source: "existing-header",
			payload: later
		});
	});

	it("with fixCreatedDate takes the oldest of header, git, and filesystem, never moving @Date later", () => {
		const resolve = (existing, filesystemCreated = filesystemNow) =>
			resolveCreatedDate({ existing, gitCreated: git, filesystemCreated, fixCreatedDate: true });
		expect(resolve(later)).toEqual({ source: "git-created", payload: git });
		expect(resolve(later, filesystemOld)).toEqual({ source: "filesystem-created", payload: filesystemOld });
		expect(resolve(early)).toEqual({ source: "existing-header", payload: early });
		expect(resolve(sameAsGit)).toEqual({ source: "existing-header", payload: sameAsGit });
		// An unrecognised datetime is not a candidate, so the oldest source replaces it.
		expect(resolve({ date: "last tuesday", timestamp: 5 })).toEqual({ source: "git-created", payload: git });
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
			expect(result.changes.find((change) => change.file === src("good.mjs")).changed).toBe(true);
			// early.mjs (@Date minutes before the first commit) and untracked.mjs (no git history, older than
			// the file) are not drift.
			expect(issueIdsByFile(result)).toEqual({
				[src("epoch.mjs")]: ["created-epoch"],
				[src("fsolder.mjs")]: ["created-newer-than-source:advisory"],
				[src("later.mjs")]: ["created-newer-than-source:advisory", "modified-git:advisory"]
			});
			expect(result.filesWithDateDrift).toBe(1);
			expect(result.dateAdvisories).toBe(3);
			expect(await readFile(join(workspace, "src", "good.mjs"), "utf8")).toBe(before);
			expect(await readFile(join(workspace, "src", "bare.mjs"), "utf8")).toBe("export const bare = true;\n");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("strictCreatedDate turns a @Date later than its sources into drift", async () => {
		const workspace = await createDateFixture("date-check-strict");

		try {
			const result = await fixHeaders({ cwd: workspace, includeFolders: ["src"], check: true, strictCreatedDate: true });

			expect(issueIdsByFile(result)).toEqual({
				[src("epoch.mjs")]: ["created-epoch"],
				[src("fsolder.mjs")]: ["created-newer-than-source"],
				[src("later.mjs")]: ["created-newer-than-source", "modified-git:advisory"]
			});
			expect(result.filesWithDateDrift).toBe(3);
			expect(result.dateAdvisories).toBe(1);
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
	it("repairs a mismatched epoch by default, keeps existing @Date values, and gives new headers the oldest source", async () => {
		const workspace = await createDateFixture("date-fix-default");

		try {
			const result = await fixHeaders({ cwd: workspace, includeFolders: ["src"], sampleOutput: true });

			expect((await readDates(workspace, "src/epoch.mjs")).created).toBe(`${COMMIT_DATE} (${COMMIT_TIMESTAMP})`);
			expect((await readDates(workspace, "src/later.mjs")).created).toBe(LATER_DATE);
			expect((await readDates(workspace, "src/early.mjs")).created).toBe(EARLY_DATE);
			expect((await readDates(workspace, "src/fsolder.mjs")).created).toBe(`${COMMIT_DATE} (${COMMIT_TIMESTAMP})`);
			expect((await readDates(workspace, "src/good.mjs")).created).toBe("2026-09-20 08:33:32 -07:00 (1789918412)");
			expect((await readDates(workspace, "src/bare.mjs")).created).toBe(`${COMMIT_DATE} (${COMMIT_TIMESTAMP})`);
			expect((await readDates(workspace, "src/bareold.mjs")).created).toMatch(new RegExp(`\\(${FS_OLD_TIMESTAMP}\\)$`));
			expect(createdSources(result)).toMatchObject({
				[src("later.mjs")]: "existing-header",
				[src("bare.mjs")]: "git-created",
				[src("bareold.mjs")]: "filesystem-created"
			});

			// Only later.mjs's @Date is still later than a source (the rewrite refreshed fsolder.mjs's mtime).
			const recheck = await fixHeaders({ cwd: workspace, includeFolders: ["src"], check: true, strictCreatedDate: true });
			const failing = recheck.changes.flatMap((change) =>
				change.dateIssues.filter((issue) => !issue.advisory).map((issue) => `${change.file}:${issue.check}`)
			);
			expect(failing).toEqual([`${src("later.mjs")}:created-newer-than-source`]);
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

	it("fixCreatedDate moves @Date back to the oldest source and never moves it later", async () => {
		const workspace = await createDateFixture("date-fix-created");

		try {
			const result = await fixHeaders({ cwd: workspace, includeFolders: ["src"], fixCreatedDate: true, sampleOutput: true });

			expect((await readDates(workspace, "src/later.mjs")).created).toBe(`${COMMIT_DATE} (${COMMIT_TIMESTAMP})`);
			expect((await readDates(workspace, "src/fsolder.mjs")).created).toMatch(new RegExp(`\\(${FS_OLD_TIMESTAMP}\\)$`));
			expect((await readDates(workspace, "src/early.mjs")).created).toBe(EARLY_DATE);
			expect((await readDates(workspace, "src/good.mjs")).created).toBe("2026-09-20 08:33:32 -07:00 (1789918412)");
			expect((await readDates(workspace, "src/epoch.mjs")).created).toBe(`${COMMIT_DATE} (${COMMIT_TIMESTAMP})`);
			expect((await readDates(workspace, "src/untracked.mjs")).created).toBe("2026-09-20 00:00:00 -07:00 (1789887600)");
			expect(createdSources(result)).toEqual({
				[src("bare.mjs")]: "git-created",
				[src("bareold.mjs")]: "filesystem-created",
				[src("early.mjs")]: "existing-header",
				[src("epoch.mjs")]: "existing-header",
				[src("fsolder.mjs")]: "filesystem-created",
				[src("good.mjs")]: "existing-header",
				[src("later.mjs")]: "git-created",
				[src("untracked.mjs")]: "existing-header"
			});

			const recheck = await fixHeaders({ cwd: workspace, includeFolders: ["src"], check: true, strictCreatedDate: true });
			expect(recheck.filesWithDateDrift).toBe(0);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("normalizeDateFormat writes every date in the git T-form without moving the instant", async () => {
		const workspace = await createDateFixture("date-fix-normalize");

		try {
			await fixHeaders({ cwd: workspace, includeFolders: ["src"], normalizeDateFormat: true });

			const isoValue = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2} \(\d+\)$/;
			const good = await readDates(workspace, "src/good.mjs");
			expect(good.created).toBe("2026-09-20T08:33:32-07:00 (1789918412)");
			expect(good.modified).toMatch(isoValue);
			expect((await readDates(workspace, "src/bare.mjs")).created).toBe(`${COMMIT_DATE} (${COMMIT_TIMESTAMP})`);
			const bareOld = await readDates(workspace, "src/bareold.mjs");
			expect(bareOld.created).toMatch(isoValue);
			expect(bareOld.created).toMatch(new RegExp(`\\(${FS_OLD_TIMESTAMP}\\)$`));
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
	it("parses --check, --fix-created-date, --strict-created-date, and --normalize-date-format", () => {
		expect(parseCliArgs(["--check", "--fix-created-date", "--strict-created-date", "--normalize-date-format"]).options).toEqual({
			check: true,
			fixCreatedDate: true,
			strictCreatedDate: true,
			normalizeDateFormat: true
		});
	});

	it("--check exits 1 on epoch drift, lists failing checks, and shows advisories only with --verbose", async () => {
		const workspace = await createDateFixture("date-cli-check");
		const run = async (...args) => {
			const lines = [];
			const code = await runCli([...args, "--cwd", workspace, "--include-folder", "src"], { stdout: (line) => lines.push(line) });
			return { code, lines };
		};

		try {
			expect(await run("--check")).toEqual({
				code: 1,
				lines: [
					"fix-headers check: scanned=8, drift=1, advisories=3",
					`drift: ${src("epoch.mjs")}: @Date epoch 1758382412 does not match 2026-09-20T15:33:32+00:00 (expected 1789918412)`
				]
			});

			const verbose = await run("--check", "--verbose");
			expect(verbose.lines).toContain(
				`advisory: ${src("later.mjs")}: @Date 2026-09-21 09:00:00 -07:00 is later than the git first commit ${COMMIT_DATE} (${COMMIT_TIMESTAMP})`
			);
			expect(
				verbose.lines.some(
					(line) => line.startsWith(`advisory: ${src("fsolder.mjs")}: @Date `) && line.includes("filesystem creation time")
				)
			).toBe(true);

			const strict = await run("--check", "--strict-created-date");
			expect(strict.code).toBe(1);
			expect(strict.lines[0]).toBe("fix-headers check: scanned=8, drift=3, advisories=1");

			const json = await run("--check", "--json");
			expect(json.code).toBe(1);
			expect(JSON.parse(json.lines[0]).filesWithDateDrift).toBe(1);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("a @Date later than git is advisory by default (exit 0) and fails with --strict-created-date (exit 1)", async () => {
		const workspace = await createDateFixture("date-cli-strict");
		const run = (...args) => runCli([...args, "--cwd", workspace, "--input", "src/later.mjs"], { stdout: () => {} });

		try {
			expect(await run("--check")).toBe(0);
			expect(await run("--check", "--strict-created-date")).toBe(1);
			expect(await run("--check", "--strict-created-date", "--json")).toBe(1);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("--check exits 0 once --fix-created-date has run, and --dry-run still exits 0 with drift", async () => {
		const workspace = await createDateFixture("date-cli-clean");

		try {
			const dryRunCode = await runCli(["--dry-run", "--cwd", workspace, "--include-folder", "src"], { stdout: () => {} });
			expect(dryRunCode).toBe(0);

			await runCli(["--fix-created-date", "--cwd", workspace, "--include-folder", "src"], { stdout: () => {} });
			const lines = [];
			const code = await runCli(["--check", "--strict-created-date", "--cwd", workspace, "--include-folder", "src"], {
				stdout: (line) => lines.push(line)
			});
			expect(code).toBe(0);
			expect(lines).toHaveLength(1);
			expect(lines[0]).toMatch(/^fix-headers check: scanned=8, drift=0, advisories=\d+$/);
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
