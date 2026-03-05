/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/file-discovery-edge.test.vitest.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-04 21:00:19 -08:00 (1772686819)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, expect, it, vi } from "vitest";

/**
 * Loads discoverFiles with mocked filesystem primitives for edge-path testing.
 * @param {{
 *  mockedFiles?: string[],
 *  statResult?: { isDirectory: () => boolean },
 *  statError?: Error
 * }} [options={}] - Mock behavior options.
 * @returns {Promise<{
 *  discoverFiles: (options: { projectRoot: string, excludeFolders?: string[], includeFolders?: string[] }) => Promise<string[]>,
 *  walkFilesMock: import("vitest").Mock
 * }>} Discovery module and walkFiles spy.
 */
async function loadDiscoveryWithMockedFiles(options = {}) {
	const mockedFiles = Array.isArray(options.mockedFiles) ? options.mockedFiles : [];
	vi.resetModules();
	vi.doMock("node:fs/promises", async (importOriginal) => {
		const originalModule = await importOriginal();
		return {
			...originalModule,
			async stat() {
				if (options.statError instanceof Error) {
					throw options.statError;
				}

				return (
					options.statResult || {
						isDirectory() {
							return true;
						}
					}
				);
			}
		};
	});
	const walkFilesMock = vi.fn(async () => mockedFiles);
	vi.doMock("../src/utils/fs.mjs", () => ({
		walkFiles: walkFilesMock
	}));
	const discoveryModule = await import("../src/core/file-discovery.mjs");

	return {
		discoverFiles: discoveryModule.discoverFiles,
		walkFilesMock
	};
}

describe("file discovery edge branches", () => {
	it("handles discovered paths that end with a slash", async () => {
		const discovery = await loadDiscoveryWithMockedFiles({ mockedFiles: ["/virtual/project/src/"] });
		const files = await discovery.discoverFiles({
			projectRoot: "/virtual/project",
			excludeFolders: []
		});

		expect(files).toEqual(["/virtual/project/src/"]);
	});

	it("rethrows non-ENOENT include folder stat errors", async () => {
		const statError = Object.assign(new Error("permission denied"), { code: "EACCES" });
		const discovery = await loadDiscoveryWithMockedFiles({ statError });

		await expect(
			discovery.discoverFiles({
				projectRoot: "/virtual/project",
				includeFolders: ["src"]
			})
		).rejects.toBe(statError);
	});

	it("warns and skips include folders that are not directories", async () => {
		const warningSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const discovery = await loadDiscoveryWithMockedFiles({
				mockedFiles: ["/virtual/project/src/file.mjs"],
				statResult: {
					isDirectory() {
						return false;
					}
				}
			});

			const files = await discovery.discoverFiles({
				projectRoot: "/virtual/project",
				includeFolders: ["src"]
			});

			expect(files).toEqual([]);
			expect(discovery.walkFilesMock).not.toHaveBeenCalled();
			expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining("path is not a directory"));
		} finally {
			warningSpy.mockRestore();
		}
	});
});
