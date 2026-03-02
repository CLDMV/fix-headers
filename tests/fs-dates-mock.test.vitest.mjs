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
