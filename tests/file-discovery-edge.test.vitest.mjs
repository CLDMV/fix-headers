/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/file-discovery-edge.test.vitest.mjs
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
