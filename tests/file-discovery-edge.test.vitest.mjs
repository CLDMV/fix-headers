import { describe, expect, it, vi } from "vitest";

/**
 * Loads discoverFiles with a mocked walkFiles result.
 * @param {string[]} mockedFiles - Files to return from walkFiles.
 * @returns {Promise<{ discoverFiles: (options: { projectRoot: string, excludeFolders?: string[] }) => Promise<string[]> }>} Discovery module.
 */
async function loadDiscoveryWithMockedFiles(mockedFiles) {
	vi.resetModules();
	vi.doMock("../src/utils/fs.mjs", () => ({
		async walkFiles() {
			return mockedFiles;
		}
	}));

	return import("../src/core/file-discovery.mjs");
}

describe("file discovery edge branches", () => {
	it("handles discovered paths that end with a slash", async () => {
		const discovery = await loadDiscoveryWithMockedFiles(["/virtual/project/src/"]);
		const files = await discovery.discoverFiles({
			projectRoot: "/virtual/project",
			excludeFolders: []
		});

		expect(files).toEqual(["/virtual/project/src/"]);
	});
});
