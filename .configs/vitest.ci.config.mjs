/**
 *	@Project: vitest-runner
 *	@Filename: /.configs/vitest.ci.config.mjs
 *	@Date: 2026-02-25 17:34:15 -08:00 (1772069655)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-25 17:56:23 -08:00 (1772070983)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import base from "./vitest.config.mjs";

export default {
	...base,

	// CI: pick a pool and force it to 1 worker.
	// Use forks for CI stability, but threads is fine too.
	// pool: "forks",
	maxForks: 1,
	minForks: 1,

	// Optional: if you choose pool: "threads" instead:
	// pool: "threads",
	maxThreads: 1,
	minThreads: 1,

	test: {
		...base.test,

		// CI: no file-level parallelism either (hard clamp)
		maxWorkers: 1,
		minWorkers: 1,
		fileParallelism: false
	}
};
