/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /.configs/vitest.config.mjs
 *	@Date: 2026-03-01 14:46:14 -08:00 (1772405174)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { defineConfig } from "vitest/config";

/**
 * @fileoverview Vitest configuration for full module coverage.
 * @module fix-headers/vitest-config
 */

export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/**/*.test.vitest.mjs"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "json-summary", "html"],
			include: ["src/**/*.mjs", "index.mjs", "index.cjs"],
			exclude: ["reference/**"],
			all: true
		}
	}
});
