/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/index.mjs
 *	@Date: 2026-03-01T13:34:00-08:00 (1772400840)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-31T15:14:45-07:00 (1793484885)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Development environment check. devcheck.mjs exists only in a source checkout; it is
// never published, so the import is allowed to fail. It runs inside an async function
// rather than as a top-level await: index.cjs loads this file through Node's synchronous
// require(esm), which rejects any module graph containing top-level await
// (ERR_REQUIRE_ASYNC_MODULE). The promise is kept so fixHeaders() can await it: devcheck
// exits the process when the checkout is misconfigured, and awaiting it first means no
// header is read or written before that happens (the CLI goes through fixHeaders() too).
// The build keeps the import external, so dist/index.mjs and bin/fix-headers.mjs import the
// same root file instead of bundling it.
const devcheckReady = (async () => {
	try {
		await import("../devcheck.mjs");
	} catch {
		// ignore - devcheck.mjs is not published
	}
})();

import { fixHeaders as fixHeadersCore } from "./core/fix-headers.mjs";

/**
 * @fileoverview Public module API exposing a single function for header updates.
 * @module fix-headers
 */

/**
 * Runs header fix-up using automatic metadata detection and optional overrides.
 * @param {Parameters<typeof fixHeadersCore>[0]} [options] - Runtime options.
 * @returns {Promise<Awaited<ReturnType<typeof fixHeadersCore>>>} Update report.
 */
export async function fixHeaders(options) {
	// Wait for the development check before touching any file.
	await devcheckReady;
	return fixHeadersCore(options);
}

export default fixHeaders;
