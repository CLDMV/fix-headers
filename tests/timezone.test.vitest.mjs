/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/timezone.test.vitest.mjs
 *	@Date: 2026-09-28T12:00:00-07:00 (1790622000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:19-07:00 (1790969299)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { join } from "node:path";
import { execFile } from "node:child_process";
import { readFile, utimes } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { parseCliArgs, runCli } from "../src/cli.mjs";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import * as dates from "../src/header/dates.mjs";
import * as time from "../src/utils/time.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview The opt-in `timezone` option (every date fix-headers writes is expressed in one IANA
 * zone) and the `convertTimezone` sweep (existing header dates are rewritten into that zone). Every
 * expectation is independent of the process `TZ`, so the file passes under any local zone.
 * @module fix-headers/tests/timezone
 */

const execFileAsync = promisify(execFile);

/** Timeout for tests that build a git fixture and run the full pipeline (several times in some tests). */
const GIT_FIXTURE_TIMEOUT = { timeout: 30_000 };

/** Author/committer date of the fixture commit, and its unix timestamp. */
const COMMIT_DATE = "2026-09-20T15:33:32+00:00";
const COMMIT_TIMESTAMP = 1789918412;
/** Backdated modification time (2026-09-01T00:00:00Z) that makes the filesystem the oldest source. */
const FS_OLD_TIMESTAMP = 1788220800;
/** 2026-01-19T04:39:48Z: a winter instant (Pacific Standard Time). */
const WINTER = 1768797588;
/** 2026-07-19T04:39:48Z: a summer instant (Pacific Daylight Time). */
const SUMMER = 1784435988;
/** 2026-03-08T10:00:00Z: the first second of Pacific Daylight Time in 2026 (02:00 PST becomes 03:00 PDT). */
const DST_START = 1772964000;

/**
 * Formats the UTC offset of a zone at an instant, read from Intl's own `longOffset` name, so it is
 * computed independently of the implementation under test.
 * @param {string} timeZone - IANA zone name.
 * @param {Date} instant - Instant.
 * @returns {string} `±HH:MM` offset.
 */
function offsetText(timeZone, instant) {
	const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
		.formatToParts(instant)
		.find((part) => part.type === "timeZoneName").value;
	return name === "GMT" ? "+00:00" : name.slice(3);
}

/**
 * Asserts that a header date value is written in `timeZone`: its wall-clock time and offset are
 * what Intl shows for its own epoch in that zone, in the given output shape.
 * @param {string} value - Raw header value (`<datetime> (<epoch>)`).
 * @param {string} timeZone - IANA zone name.
 * @param {"space" | "iso"} form - Expected output shape.
 * @returns {number} The value's epoch.
 */
function expectZonedValue(value, timeZone, form) {
	const match = /^(\d{4}-\d{2}-\d{2})([T ])(\d{2}:\d{2}:\d{2}) ?([+-]\d{2}:\d{2}) \((\d+)\)$/.exec(value);
	expect(match, value).not.toBeNull();
	const instant = new Date(Number(match[5]) * 1000);
	expect(`${match[1]} ${match[3]}`, value).toBe(instant.toLocaleString("sv-SE", { timeZone }));
	expect(match[4], value).toBe(offsetText(timeZone, instant));
	expect(match[2], value).toBe(form === "iso" ? "T" : " ");
	return Number(match[5]);
}

/**
 * Renders a JS header block with the given date values. With the `Someone Else` author override and
 * a `2026-<current year>` copyright (every fixture `@Date` is in 2026, the start year fix-headers
 * derives from it), the rendered header matches it exactly, so only date changes rewrite it.
 * @param {string} fileName - Project-relative file path (without leading slash).
 * @param {string} createdValue - Raw `@Date` value.
 * @param {string} modifiedValue - Raw `@Last modified time` value.
 * @returns {string} File content with header.
 */
function fileWithHeader(fileName, createdValue, modifiedValue) {
	const year = new Date().getFullYear();
	return `/**\n *\n *\t@Project: tz-check\n *\t@Filename: /${fileName}\n *\t@Date: ${createdValue}\n *\t@Author: Someone Else\n *\t@Email: <else@example.com>\n *\t-----\n *\t@Last modified by: Someone Else (else@example.com)\n *\t@Last modified time: ${modifiedValue}\n *\t-----\n *\t@Copyright: Copyright (c) 2026-${year} Catalyzed Motivation Inc. All rights reserved.\n *\n */\n\n\nexport const value = 1;\n`;
}

/** The fixtures' `package.json`: its author supplies the `@Copyright` holder {@link fileWithHeader} writes. */
const TZ_MANIFEST = { name: "tz-check", author: { name: "Someone Else", company: "Catalyzed Motivation Inc." } };

/** Options that make {@link fileWithHeader} headers render unchanged. */
const MATCHING_IDENTITY = { authorName: "Someone Else", authorEmail: "else@example.com" };

/**
 * Reads the `@Date` and `@Last modified time` values of a workspace file.
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
 * Creates a committed workspace with two header-less files: `src/bare.mjs` (git first commit is
 * the oldest source) and `src/bareold.mjs` (mtime backdated before the commit).
 * @param {string} name - Workspace name.
 * @returns {Promise<string>} Workspace path.
 */
async function createNewHeaderFixture(name) {
	const workspace = await createWorkspace(name);
	await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify(TZ_MANIFEST, null, 2));
	await writeWorkspaceFile(join(workspace, "src", "bare.mjs"), "export const bare = true;\n");
	await writeWorkspaceFile(join(workspace, "src", "bareold.mjs"), "export const bareOld = true;\n");
	await writeWorkspaceFile(
		join(workspace, "src", "kept.mjs"),
		fileWithHeader("src/kept.mjs", `${COMMIT_DATE} (${COMMIT_TIMESTAMP})`, `${COMMIT_DATE} (${COMMIT_TIMESTAMP})`)
	);
	const env = { ...process.env, GIT_AUTHOR_DATE: COMMIT_DATE, GIT_COMMITTER_DATE: COMMIT_DATE };
	await execFileAsync("git", ["init"], { cwd: workspace });
	await execFileAsync("git", ["config", "user.name", "Tz Tester"], { cwd: workspace });
	await execFileAsync("git", ["config", "user.email", "tz@example.com"], { cwd: workspace });
	await execFileAsync("git", ["add", "."], { cwd: workspace });
	await execFileAsync("git", ["commit", "--no-gpg-sign", "-m", "initial"], { cwd: workspace, env });
	await utimes(join(workspace, "src", "bareold.mjs"), FS_OLD_TIMESTAMP, FS_OLD_TIMESTAMP);
	return workspace;
}

/**
 * Creates an uncommitted workspace of existing headers for the sweep:
 * - `src/space.mjs`: winter `@Date` in the space form at `+00:00`.
 * - `src/iso.mjs`: summer `@Date` in the T-form at `+00:00`.
 * - `src/bad.mjs`: unparseable `@Date` and `@Last modified time`.
 * - `src/already.mjs`: both dates already in `America/Los_Angeles` at their instants.
 * @param {string} name - Workspace name.
 * @returns {Promise<string>} Workspace path.
 */
async function createSweepFixture(name) {
	const workspace = await createWorkspace(name);
	const write = (file, created, modified) =>
		writeWorkspaceFile(join(workspace, "src", file), fileWithHeader(`src/${file}`, created, modified));
	await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify(TZ_MANIFEST, null, 2));
	await write("space.mjs", `2026-01-19 04:39:48 +00:00 (${WINTER})`, `2026-01-19 04:39:48 +00:00 (${WINTER})`);
	await write("iso.mjs", `2026-07-19T04:39:48+00:00 (${SUMMER})`, `2026-07-19T04:39:48+00:00 (${SUMMER})`);
	await write("bad.mjs", `last tuesday (${WINTER})`, "sometime (123)");
	await write("already.mjs", `2026-01-18 20:39:48 -08:00 (${WINTER})`, `2026-07-18T21:39:48-07:00 (${SUMMER})`);
	return workspace;
}

/**
 * Maps a sampled result to `{ file: detectedValues }` for its changed files.
 * @param {{changes: Array<{file: string, sample?: {detectedValues: Record<string, unknown>}}>}} result - Run result.
 * @returns {Record<string, Record<string, any>>} Detected values per changed file (forward slashes).
 */
function detectedByFile(result) {
	return Object.fromEntries(
		result.changes.filter((change) => change.sample).map((change) => [change.file.replace(/\\/g, "/"), change.sample.detectedValues])
	);
}

describe("time zone helpers", () => {
	it("computes the zone's offset and wall-clock time for an instant, across a DST switch", () => {
		expect(time.toZonedDateParts(DST_START - 1, "America/Los_Angeles")).toEqual({
			year: 2026,
			month: 3,
			day: 8,
			hour: 1,
			minute: 59,
			second: 59,
			offsetMinutes: -480
		});
		expect(time.toZonedDateParts(DST_START, "America/Los_Angeles")).toEqual({
			year: 2026,
			month: 3,
			day: 8,
			hour: 3,
			minute: 0,
			second: 0,
			offsetMinutes: -420
		});
		expect(time.toZonedDateParts(WINTER, "America/Los_Angeles").offsetMinutes).toBe(-480);
		expect(time.toZonedDateParts(SUMMER, "America/Los_Angeles").offsetMinutes).toBe(-420);
	});

	it("handles UTC, a half-hour zone, and a +14:00 zone (across the date line)", () => {
		expect(time.toZonedDateParts(WINTER, "UTC")).toMatchObject({ day: 19, hour: 4, minute: 39, offsetMinutes: 0 });
		expect(time.toZonedDateParts(WINTER, "Asia/Kolkata")).toMatchObject({ day: 19, hour: 10, minute: 9, offsetMinutes: 330 });
		// 2026-01-18T20:00:00Z is already the next day in Kiritimati.
		expect(time.toZonedDateParts(1768766400, "Pacific/Kiritimati")).toEqual({
			year: 2026,
			month: 1,
			day: 19,
			hour: 10,
			minute: 0,
			second: 0,
			offsetMinutes: 840
		});
	});

	it("validates zone names with Intl", () => {
		expect(time.assertTimeZone("America/Los_Angeles")).toBe("America/Los_Angeles");
		expect(time.assertTimeZone("UTC")).toBe("UTC");
		expect(() => time.assertTimeZone("Mars/Olympus")).toThrow(/^Unknown time zone "Mars\/Olympus"/);
		expect(() => time.assertTimeZone("")).toThrow(/^Unknown time zone ""/);
		expect(() => time.assertTimeZone(42)).toThrow(/^timezone must be an IANA time zone name string/);
	});

	it("formats zoned parts in the space form", () => {
		expect(time.formatSpaceDate(time.toZonedDateParts(WINTER, "America/Los_Angeles"))).toBe("2026-01-18 20:39:48 -08:00");
		expect(time.formatSpaceDate(time.toZonedDateParts(WINTER, "Asia/Kolkata"))).toBe("2026-01-19 10:09:48 +05:30");
	});

	it("converts a payload into the zone, keeping its instant and its space/T shape", () => {
		expect(dates.convertDatePayload({ date: "2026-01-19 04:39:48 +00:00", timestamp: WINTER }, "America/Los_Angeles")).toEqual({
			date: "2026-01-18 20:39:48 -08:00",
			timestamp: WINTER
		});
		expect(dates.convertDatePayload({ date: "2026-07-19T04:39:48Z", timestamp: SUMMER }, "America/Los_Angeles")).toEqual({
			date: "2026-07-18T21:39:48-07:00",
			timestamp: SUMMER
		});
		expect(dates.convertDatePayload({ date: "2026-01-18 20:39:48 -08:00", timestamp: WINTER }, "Pacific/Kiritimati")).toEqual({
			date: "2026-01-19 18:39:48 +14:00",
			timestamp: WINTER
		});
		expect(dates.convertDatePayload({ date: "2026-01-18T20:39:48-08:00", timestamp: WINTER }, "UTC")).toEqual({
			date: "2026-01-19T04:39:48+00:00",
			timestamp: WINTER
		});
	});

	it("leaves unparseable dates, dates already in the zone, and unrepresentable offsets alone", () => {
		const unparseable = { date: "last tuesday", timestamp: WINTER };
		expect(dates.convertDatePayload(unparseable, "UTC")).toBe(unparseable);
		// Same instant and offset, written in another notation: already in the zone.
		const alreadyZoned = { date: "2026-01-19 10:09:48 +0530", timestamp: WINTER };
		expect(dates.convertDatePayload(alreadyZoned, "Asia/Kolkata")).toBe(alreadyZoned);
		const alreadyUtc = { date: "2026-01-19T04:39:48Z", timestamp: WINTER };
		expect(dates.convertDatePayload(alreadyUtc, "UTC")).toBe(alreadyUtc);
		// In 1880 Los Angeles kept local mean time (-07:52:58), which a ±HH:MM offset cannot express.
		const lmt = { date: "1880-01-01 12:00:00 +00:00", timestamp: -2840097600 };
		expect(dates.convertDatePayload(lmt, "America/Los_Angeles")).toBe(lmt);
	});
});

describe("fixHeaders timezone option", GIT_FIXTURE_TIMEOUT, () => {
	it("writes new-header dates from git and the filesystem in the zone, in both output shapes", async () => {
		const workspace = await createNewHeaderFixture("tz-new-headers");

		try {
			const run = (options) => fixHeaders({ cwd: workspace, includeFolders: ["src"], dryRun: true, sampleOutput: true, ...options });
			const expectations = {
				"America/Los_Angeles": ["2026-09-20T08:33:32-07:00", "2026-08-31 17:00:00 -07:00"],
				UTC: ["2026-09-20T15:33:32+00:00", "2026-09-01 00:00:00 +00:00"],
				"Asia/Kolkata": ["2026-09-20T21:03:32+05:30", "2026-09-01 05:30:00 +05:30"],
				"Pacific/Kiritimati": ["2026-09-21T05:33:32+14:00", "2026-09-01 14:00:00 +14:00"]
			};
			for (const [timezone, [gitDate, fsDate]] of Object.entries(expectations)) {
				const detected = detectedByFile(await run({ timezone }));
				expect(detected["src/bare.mjs"].createdAt, timezone).toEqual({ date: gitDate, timestamp: COMMIT_TIMESTAMP });
				expect(detected["src/bare.mjs"].createdAtSource).toBe("git-created");
				expect(detected["src/bareold.mjs"].createdAt, timezone).toEqual({ date: fsDate, timestamp: FS_OLD_TIMESTAMP });
				expect(detected["src/bareold.mjs"].createdAtSource).toBe("filesystem-created");
				const modified = detected["src/bare.mjs"].lastModifiedAt;
				expectZonedValue(`${modified.date} (${modified.timestamp})`, timezone, "space");
			}

			// normalizeDateFormat writes the same instants in the zone, in the T-form.
			const normalized = detectedByFile(await run({ timezone: "Pacific/Kiritimati", normalizeDateFormat: true }));
			expect(normalized["src/bareold.mjs"].createdAt).toEqual({ date: "2026-09-01T14:00:00+14:00", timestamp: FS_OLD_TIMESTAMP });
			const modified = normalized["src/bare.mjs"].lastModifiedAt;
			expectZonedValue(`${modified.date} (${modified.timestamp})`, "Pacific/Kiritimati", "iso");

			// A real run writes them, and an existing header is kept as written without the sweep.
			const keptBefore = await readFile(join(workspace, "src", "kept.mjs"), "utf8");
			const before = Math.floor(Date.now() / 1000);
			await fixHeaders({ cwd: workspace, includeFolders: ["src"], timezone: "America/Los_Angeles" });
			const after = Math.ceil(Date.now() / 1000);
			const bare = await readDates(workspace, "src/bare.mjs");
			expect(bare.created).toBe(`2026-09-20T08:33:32-07:00 (${COMMIT_TIMESTAMP})`);
			const stamped = expectZonedValue(bare.modified, "America/Los_Angeles", "space");
			expect(stamped).toBeGreaterThanOrEqual(before);
			expect(stamped).toBeLessThanOrEqual(after);
			expect((await readDates(workspace, "src/bareold.mjs")).created).toBe(`2026-08-31 17:00:00 -07:00 (${FS_OLD_TIMESTAMP})`);
			// kept.mjs already has a header that renders unchanged: without the sweep its +00:00 dates stay as written.
			expect(await readFile(join(workspace, "src", "kept.mjs"), "utf8")).toBe(keptBefore);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("unset timezone keeps today's output", async () => {
		const workspace = await createNewHeaderFixture("tz-unset");

		try {
			const withoutModified = (result) =>
				Object.fromEntries(
					result.changes
						.filter((change) => change.sample)
						.map((change) => [change.file, change.sample.newValue.replace(/@Last modified time: .*$/m, "")])
				);
			const run = (options) => fixHeaders({ cwd: workspace, includeFolders: ["src"], dryRun: true, sampleOutput: true, ...options });
			const baseline = await run({});
			expect(Object.keys(withoutModified(baseline))).toHaveLength(2);
			expect(withoutModified(await run({ timezone: undefined, convertTimezone: false }))).toEqual(withoutModified(baseline));
			expect(withoutModified(await run({ timezone: null }))).toEqual(withoutModified(baseline));
			const detected = detectedByFile(baseline);
			expect(detected["src/bare.mjs"].createdAt).toEqual({ date: COMMIT_DATE, timestamp: COMMIT_TIMESTAMP });
			// Filesystem and current-time dates stay in the process's local zone.
			const local = new Date(FS_OLD_TIMESTAMP * 1000);
			expect(detected["src/bareold.mjs"].createdAt.date).toBe(
				`${local.toLocaleString("sv-SE")} ${offsetText(Intl.DateTimeFormat().resolvedOptions().timeZone, local)}`
			);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("rejects an unknown zone and convertTimezone without timezone", async () => {
		const workspace = await createWorkspace("tz-errors");

		try {
			await expect(fixHeaders({ cwd: workspace, timezone: "Mars/Olympus" })).rejects.toThrow(/Unknown time zone "Mars\/Olympus"/);
			await expect(fixHeaders({ cwd: workspace, convertTimezone: true })).rejects.toThrow(/convertTimezone requires timezone/);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});

describe("fixHeaders convertTimezone sweep", GIT_FIXTURE_TIMEOUT, () => {
	it("without the sweep, existing header dates are left as written", async () => {
		const workspace = await createSweepFixture("tz-no-sweep");

		try {
			const result = await fixHeaders({ cwd: workspace, includeFolders: ["src"], timezone: "America/Los_Angeles", ...MATCHING_IDENTITY });
			expect(result.filesUpdated).toBe(0);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("rewrites existing dates into the zone (space and T forms), restamping @Last modified time, and leaves the rest alone", async () => {
		const workspace = await createSweepFixture("tz-sweep");

		try {
			const originals = {
				bad: await readFile(join(workspace, "src", "bad.mjs"), "utf8"),
				already: await readFile(join(workspace, "src", "already.mjs"), "utf8")
			};
			const before = Math.floor(Date.now() / 1000);
			const result = await fixHeaders({
				cwd: workspace,
				includeFolders: ["src"],
				timezone: "America/Los_Angeles",
				convertTimezone: true,
				sampleOutput: true,
				...MATCHING_IDENTITY
			});
			const after = Math.ceil(Date.now() / 1000);

			expect(result.filesUpdated).toBe(2);
			const space = await readDates(workspace, "src/space.mjs");
			expect(space.created).toBe(`2026-01-18 20:39:48 -08:00 (${WINTER})`);
			const iso = await readDates(workspace, "src/iso.mjs");
			expect(iso.created).toBe(`2026-07-18T21:39:48-07:00 (${SUMMER})`);
			// Like epoch repair and normalizeDateFormat, a rewritten date is a header change: @Last modified time is restamped.
			for (const modified of [space.modified, iso.modified]) {
				const stamped = expectZonedValue(modified, "America/Los_Angeles", "space");
				expect(stamped).toBeGreaterThanOrEqual(before);
				expect(stamped).toBeLessThanOrEqual(after);
			}
			expect(detectedByFile(result)["src/space.mjs"].lastModifiedAtSource).toBe("current-time-on-change");
			expect(await readFile(join(workspace, "src", "bad.mjs"), "utf8")).toBe(originals.bad);
			expect(await readFile(join(workspace, "src", "already.mjs"), "utf8")).toBe(originals.already);

			const recheck = await fixHeaders({ cwd: workspace, includeFolders: ["src"], check: true });
			expect(recheck.changes.filter((change) => !change.file.includes("bad")).flatMap((change) => change.dateIssues)).toEqual([]);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("with normalizeDateFormat, writes the converted dates in the T-form", async () => {
		const workspace = await createSweepFixture("tz-sweep-normalize");

		try {
			await fixHeaders({
				cwd: workspace,
				includeFolders: ["src"],
				timezone: "Asia/Kolkata",
				convertTimezone: true,
				normalizeDateFormat: true,
				...MATCHING_IDENTITY
			});
			const space = await readDates(workspace, "src/space.mjs");
			expect(space.created).toBe(`2026-01-19T10:09:48+05:30 (${WINTER})`);
			expectZonedValue(space.modified, "Asia/Kolkata", "iso");
			expect((await readDates(workspace, "src/already.mjs")).created).toBe(`2026-01-19T10:09:48+05:30 (${WINTER})`);
			expect((await readDates(workspace, "src/bad.mjs")).created).toBe(`last tuesday (${WINTER})`);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("check does not count a date shown in another zone than timezone as drift", async () => {
		const workspace = await createSweepFixture("tz-check");

		try {
			const result = await fixHeaders({ cwd: workspace, includeFolders: ["src"], check: true, timezone: "Asia/Kolkata" });
			const issues = Object.fromEntries(
				result.changes.map((change) => [change.file.replace(/\\/g, "/"), change.dateIssues.map((issue) => issue.check)])
			);
			expect(issues).toEqual({
				"src/already.mjs": [],
				"src/bad.mjs": ["created-format", "modified-format"],
				"src/iso.mjs": [],
				"src/space.mjs": []
			});
			expect(result.filesWithDateDrift).toBe(1);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});

describe("CLI timezone options", GIT_FIXTURE_TIMEOUT, () => {
	it("parses --timezone and --convert-timezone and documents them in --help", async () => {
		expect(parseCliArgs(["--timezone", "America/Los_Angeles", "--convert-timezone"]).options).toEqual({
			timezone: "America/Los_Angeles",
			convertTimezone: true
		});
		expect(() => parseCliArgs(["--timezone"])).toThrow("Missing value for --timezone");

		const lines = [];
		expect(await runCli(["--help"], { stdout: (line) => lines.push(line) })).toBe(0);
		expect(lines.join("\n")).toMatch(/--timezone <name>/);
		expect(lines.join("\n")).toMatch(/--convert-timezone/);
	});

	it("fails with a clear message for an unknown zone or --convert-timezone alone, and sweeps with both", async () => {
		const workspace = await createSweepFixture("tz-cli");

		try {
			const errors = [];
			const run = (...args) =>
				runCli(
					[...args, "--cwd", workspace, "--include-folder", "src", "--author-name", "Someone Else", "--author-email", "else@example.com"],
					{
						stdout: () => {},
						stderr: (line) => errors.push(line)
					}
				);
			expect(await run("--convert-timezone")).toBe(1);
			expect(await run("--timezone", "Mars/Olympus")).toBe(1);
			expect(errors[0]).toMatch(/^fix-headers failed: convertTimezone requires timezone/);
			expect(errors[1]).toMatch(/^fix-headers failed: Unknown time zone "Mars\/Olympus"/);

			expect(await run("--timezone", "UTC", "--convert-timezone")).toBe(0);
			expect((await readDates(workspace, "src/already.mjs")).created).toBe(`2026-01-19 04:39:48 +00:00 (${WINTER})`);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});
