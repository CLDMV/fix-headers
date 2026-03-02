/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /.configs/vitest.config.mjs
 *	@Date: 2026-03-01 14:46:14 -08:00 (1772405174)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 17:33:59 -08:00 (1772415239)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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
