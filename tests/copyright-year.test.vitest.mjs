/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/copyright-year.test.vitest.mjs
 *	@Date: 2026-09-28T21:30:00-07:00 (1790656200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28T21:30:00-07:00 (1790656200)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { join } from "node:path";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import { dateYear } from "../src/header/dates.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview The `@Copyright` start year: the `copyrightStartYear` option when set, otherwise the
 * year of the file's resolved `@Date` in the zone that date is written in.
 * @module fix-headers/tests/copyright-year
 */

const execFileAsync = promisify(execFile);

/**
 * Timeout for tests that run the full pipeline, which spawns git processes for every file (and some
 * build a git fixture or run several times): beyond vitest's 5s default on a loaded machine.
 */
const GIT_FIXTURE_TIMEOUT = { timeout: 30_000 };

/** The year of the run, which is always the `@Copyright` end year. */
const CURRENT_YEAR = new Date().getFullYear();

/**
 * Renders a JS header block with the given `@Date` value and copyright years.
 * @param {string} fileName - Project-relative file path (without leading slash).
 * @param {string} createdValue - Raw `@Date` value.
 * @param {string} copyrightYears - Year range of the `@Copyright` line, such as `2019-2026`.
 * @returns {string} File content with header.
 */
function fileWithHeader(fileName, createdValue, copyrightYears) {
	return `/**\n *\n *\t@Project: copyright-year\n *\t@Filename: /${fileName}\n *\t@Date: ${createdValue}\n *\t@Author: Someone Else\n *\t@Email: <else@example.com>\n *\t-----\n *\t@Last modified by: Someone Else (else@example.com)\n *\t@Last modified time: ${createdValue}\n *\t-----\n *\t@Copyright: Copyright (c) ${copyrightYears} Catalyzed Motivation Inc. All rights reserved.\n *\n */\n\n\nexport const value = 1;\n`;
}

/**
 * Reads the `@Date` value and the `@Copyright` year range of a workspace file.
 * @param {string} workspace - Workspace path.
 * @param {string} fileName - Project-relative file path.
 * @returns {Promise<{created: string, years: string}>} Raw header values.
 */
async function readHeader(workspace, fileName) {
	const content = await readFile(join(workspace, fileName), "utf8");
	return {
		created: content.match(/@Date: (.*)$/m)[1],
		years: content.match(/@Copyright: Copyright \(c\) (\d{4}-\d{4}) /m)[1]
	};
}

/**
 * Creates a workspace holding a `package.json` and the given project-relative files. The
 * manifest's author company is the holder the fixture headers carry, so only the years differ.
 * @param {string} name - Workspace name.
 * @param {Record<string, string>} files - File contents by project-relative path.
 * @returns {Promise<string>} Workspace path.
 */
async function createFixture(name, files) {
	const workspace = await createWorkspace(name);
	await writeWorkspaceFile(
		join(workspace, "package.json"),
		JSON.stringify({ name: "copyright-year", author: { company: "Catalyzed Motivation Inc." } }, null, 2)
	);
	for (const [file, content] of Object.entries(files)) {
		await writeWorkspaceFile(join(workspace, file), content);
	}
	return workspace;
}

/**
 * Initializes a git repository and commits everything with a fixed author/committer date.
 * @param {string} workspace - Workspace path.
 * @param {string} commitDate - Author/committer date of the commit.
 * @returns {Promise<void>} Completion promise.
 */
async function commitWorkspace(workspace, commitDate) {
	const env = { ...process.env, GIT_AUTHOR_DATE: commitDate, GIT_COMMITTER_DATE: commitDate };
	await execFileAsync("git", ["init"], { cwd: workspace });
	await execFileAsync("git", ["config", "user.name", "Copyright Tester"], { cwd: workspace });
	await execFileAsync("git", ["config", "user.email", "copyright@example.com"], { cwd: workspace });
	await execFileAsync("git", ["add", "."], { cwd: workspace });
	await execFileAsync("git", ["commit", "--no-gpg-sign", "-m", "initial"], { cwd: workspace, env });
}

/** Options that keep the fixture headers' author identity. */
const IDENTITY = { authorName: "Someone Else", authorEmail: "else@example.com" };

describe("dateYear", () => {
	const newYearsEve = { date: "2019-12-31T23:30:00-08:00", timestamp: 1577863800 };

	it("reads the year in the date's own offset without a time zone", () => {
		expect(dateYear(newYearsEve)).toBe(2019);
		expect(dateYear({ date: "2020-01-01 07:30:00 +00:00", timestamp: 1577863800 })).toBe(2020);
		expect(dateYear({ date: "2020-01-01T13:00:00+05:30", timestamp: 1577863800 }, null)).toBe(2020);
	});

	it("reads the year in the time zone when one is given", () => {
		expect(dateYear(newYearsEve, "UTC")).toBe(2020);
		expect(dateYear(newYearsEve, "Asia/Kolkata")).toBe(2020);
		expect(dateYear({ date: "2020-01-01T07:30:00Z", timestamp: 1577863800 }, "America/Los_Angeles")).toBe(2019);
	});

	it("falls back to the epoch's local year for unrecognised text", () => {
		expect(dateYear({ date: "mid June 2019", timestamp: 1560618000 })).toBe(2019);
		expect(dateYear({ date: "mid June 2019", timestamp: 1560618000 }, "UTC")).toBe(2019);
	});
});

describe("copyright start year", () => {
	it("takes the start year from an existing header's @Date", GIT_FIXTURE_TIMEOUT, async () => {
		const workspace = await createFixture("copyright-existing", {
			"src/a.mjs": fileWithHeader("src/a.mjs", "2019-06-15T10:00:00-07:00 (1560618000)", `${CURRENT_YEAR}-${CURRENT_YEAR}`)
		});
		try {
			const result = await fixHeaders({ cwd: workspace, ...IDENTITY, sampleOutput: true });
			const header = await readHeader(workspace, "src/a.mjs");
			expect(header).toEqual({ created: "2019-06-15T10:00:00-07:00 (1560618000)", years: `2019-${CURRENT_YEAR}` });

			const { sample } = result.changes.find((change) => change.file === join("src", "a.mjs"));
			expect(sample.detectedValues.copyrightStartYear).toBe(2019);
			expect(sample.detectedValues.copyrightStartYearSource).toBe("created-date");
			expect(sample.issues.find((issue) => issue.field === "copyrightStartYear")).toEqual({
				field: "copyrightStartYear",
				previous: String(CURRENT_YEAR),
				detected: "2019"
			});
			expect(result.metadata.copyrightStartYear).toBeNull();

			// The rewritten header already carries the right year, so a second run leaves it alone.
			const second = await fixHeaders({ cwd: workspace, ...IDENTITY });
			expect(second.changes.find((change) => change.file === join("src", "a.mjs")).changed).toBe(false);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("takes the start year of a new header from the file's first git commit", GIT_FIXTURE_TIMEOUT, async () => {
		const workspace = await createFixture("copyright-git", { "src/bare.mjs": "export const bare = true;\n" });
		try {
			await commitWorkspace(workspace, "2018-03-04T05:06:07+00:00");
			const result = await fixHeaders({ cwd: workspace, ...IDENTITY, sampleOutput: true });
			expect(await readHeader(workspace, "src/bare.mjs")).toEqual({
				created: "2018-03-04T05:06:07+00:00 (1520139967)",
				years: `2018-${CURRENT_YEAR}`
			});
			const { sample } = result.changes.find((change) => change.file === join("src", "bare.mjs"));
			expect(sample.detectedValues).toMatchObject({ createdAtSource: "git-created", copyrightStartYear: 2018 });
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("takes the start year of a new header without git history from the filesystem creation time", GIT_FIXTURE_TIMEOUT, async () => {
		const workspace = await createFixture("copyright-fs", { "src/bare.mjs": "export const bare = true;\n" });
		try {
			const result = await fixHeaders({ cwd: workspace, ...IDENTITY, input: "src/bare.mjs", sampleOutput: true });
			const { sample } = result.changes[0];
			expect(sample.detectedValues.createdAtSource).toBe("filesystem-created");
			const createdYear = Number(sample.detectedValues.createdAt.date.slice(0, 4));
			expect(sample.detectedValues.copyrightStartYear).toBe(createdYear);
			expect((await readHeader(workspace, "src/bare.mjs")).years).toBe(`${createdYear}-${CURRENT_YEAR}`);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("keeps an explicit copyrightStartYear over the @Date year", GIT_FIXTURE_TIMEOUT, async () => {
		const workspace = await createFixture("copyright-option", {
			"src/a.mjs": fileWithHeader("src/a.mjs", "2019-06-15T10:00:00-07:00 (1560618000)", `${CURRENT_YEAR}-${CURRENT_YEAR}`)
		});
		try {
			const result = await fixHeaders({ cwd: workspace, ...IDENTITY, copyrightStartYear: 2013, sampleOutput: true });
			expect((await readHeader(workspace, "src/a.mjs")).years).toBe(`2013-${CURRENT_YEAR}`);
			expect(result.metadata.copyrightStartYear).toBe(2013);
			expect(result.changes[0].sample.detectedValues).toMatchObject({ copyrightStartYear: 2013, copyrightStartYearSource: "option" });
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("reads the year near New Year in the date's own offset, or in the timezone option when set", GIT_FIXTURE_TIMEOUT, async () => {
		const files = {
			"src/pacific.mjs": fileWithHeader("src/pacific.mjs", "2019-12-31T23:30:00-08:00 (1577863800)", "2000-2000"),
			"src/utc.mjs": fileWithHeader("src/utc.mjs", "2020-01-01 07:30:00 +00:00 (1577863800)", "2000-2000")
		};
		const own = await createFixture("copyright-offset-own", files);
		const utc = await createFixture("copyright-offset-utc", files);
		const pacific = await createFixture("copyright-offset-pacific", files);
		const swept = await createFixture("copyright-offset-swept", files);
		try {
			await fixHeaders({ cwd: own, ...IDENTITY });
			expect((await readHeader(own, "src/pacific.mjs")).years).toBe(`2019-${CURRENT_YEAR}`);
			expect((await readHeader(own, "src/utc.mjs")).years).toBe(`2020-${CURRENT_YEAR}`);

			// Without convertTimezone the @Date text is kept, but the year is read in the zone.
			await fixHeaders({ cwd: utc, ...IDENTITY, timezone: "UTC" });
			expect(await readHeader(utc, "src/pacific.mjs")).toEqual({
				created: "2019-12-31T23:30:00-08:00 (1577863800)",
				years: `2020-${CURRENT_YEAR}`
			});
			expect((await readHeader(utc, "src/utc.mjs")).years).toBe(`2020-${CURRENT_YEAR}`);

			await fixHeaders({ cwd: pacific, ...IDENTITY, timezone: "America/Los_Angeles" });
			expect((await readHeader(pacific, "src/pacific.mjs")).years).toBe(`2019-${CURRENT_YEAR}`);
			expect((await readHeader(pacific, "src/utc.mjs")).years).toBe(`2019-${CURRENT_YEAR}`);

			await fixHeaders({ cwd: swept, ...IDENTITY, timezone: "UTC", convertTimezone: true });
			expect(await readHeader(swept, "src/pacific.mjs")).toEqual({
				created: "2020-01-01T07:30:00+00:00 (1577863800)",
				years: `2020-${CURRENT_YEAR}`
			});
		} finally {
			await Promise.all([own, utc, pacific, swept].map((workspace) => cleanupWorkspace(workspace)));
		}
	});

	it("reads the year of an unrecognised @Date from its epoch", GIT_FIXTURE_TIMEOUT, async () => {
		const workspace = await createFixture("copyright-unrecognised", {
			"src/a.mjs": fileWithHeader("src/a.mjs", "mid June 2019 (1560618000)", `${CURRENT_YEAR}-${CURRENT_YEAR}`)
		});
		try {
			await fixHeaders({ cwd: workspace, ...IDENTITY });
			expect(await readHeader(workspace, "src/a.mjs")).toEqual({ created: "mid June 2019 (1560618000)", years: `2019-${CURRENT_YEAR}` });
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("moves the start year with @Date when fixCreatedDate moves it into an earlier year", GIT_FIXTURE_TIMEOUT, async () => {
		const files = { "src/a.mjs": fileWithHeader("src/a.mjs", "2024-05-01T12:00:00+00:00 (1714564800)", `2024-${CURRENT_YEAR}`) };
		const kept = await createFixture("copyright-fix-kept", files);
		const fixed = await createFixture("copyright-fix-moved", files);
		try {
			await commitWorkspace(kept, "2017-08-09T10:11:12+00:00");
			await commitWorkspace(fixed, "2017-08-09T10:11:12+00:00");

			const keptResult = await fixHeaders({ cwd: kept, ...IDENTITY });
			expect(keptResult.changes.find((change) => change.file === join("src", "a.mjs")).changed).toBe(false);
			expect((await readHeader(kept, "src/a.mjs")).years).toBe(`2024-${CURRENT_YEAR}`);

			await fixHeaders({ cwd: fixed, ...IDENTITY, fixCreatedDate: true });
			expect(await readHeader(fixed, "src/a.mjs")).toEqual({
				created: "2017-08-09T10:11:12+00:00 (1502273472)",
				years: `2017-${CURRENT_YEAR}`
			});
		} finally {
			await Promise.all([kept, fixed].map((workspace) => cleanupWorkspace(workspace)));
		}
	});
});
