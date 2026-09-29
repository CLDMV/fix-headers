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

import { devNull } from "node:os";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * @fileoverview Vitest configuration for full module coverage.
 * @module fix-headers/vitest-config
 */

export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/**/*.test.vitest.mjs"],
		// Isolate every git call the tests make (directly and through the code under test)
		// from the developer's global and system git config, so settings such as
		// user.signingkey, commit.gpgsign or user.name on the machine running the suite
		// can't change results. Tests set the identity they need in each workspace's own
		// repository config.
		env: { GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: "1" },
		// Reap only STALE fixture directories (age-guarded) before/after the run so
		// orphaned fixtures from a crashed/interrupted run self-heal, without touching
		// a concurrent run's fresh fixtures (see tests/helpers/workspace.mjs).
		// Absolute path so it resolves regardless of vitest's root.
		globalSetup: [fileURLToPath(new URL("./vitest.globalSetup.mjs", import.meta.url))],
		// "dot" keeps CI logs to one character per test file instead of a full
		// "RUN vX.Y.Z" + per-file pass/fail block for every file — vitest's
		// non-interactive fallback (no TTY to redraw) otherwise reprints that
		// whole block per file on top of the final aggregate summary. The
		// final "Test Files X passed" / "Tests Y passed" summary is
		// unaffected — every built-in reporter prints it regardless of
		// per-test verbosity.
		reporters: ["dot"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "json-summary", "html"],
			include: ["src/**/*.mjs"],
			exclude: ["reference/**"],
			all: true
		}
	}
});
