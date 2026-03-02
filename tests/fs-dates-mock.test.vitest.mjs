/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/fs-dates-mock.test.vitest.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async () => {
	const actual = await vi.importActual("node:fs/promises");
	return {
		...actual,
		stat: vi.fn(async () => ({
			birthtimeMs: 0,
			birthtime: new Date("2020-01-01T00:00:00Z"),
			mtime: new Date("2021-01-01T00:00:00Z")
		}))
	};
});

describe("fs readFileDates fallback branch", () => {
	it("uses mtime when birthtime is unavailable", async () => {
		const { readFileDates } = await import("../src/utils/fs.mjs?fs-date-fallback");
		const result = await readFileDates("/tmp/does-not-matter");
		expect(result.createdAt.toISOString()).toBe("2021-01-01T00:00:00.000Z");
		expect(result.updatedAt.toISOString()).toBe("2021-01-01T00:00:00.000Z");
	});
});
