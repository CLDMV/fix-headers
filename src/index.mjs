/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/index.mjs
 *	@Date: 2026-03-01T13:34:00-08:00 (1772400840)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-31T15:37:23-07:00 (1793486243)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { createRequire } from "node:module";

// Development environment check. devcheck.mjs exists only in a source checkout and exits the
// process when the checkout runs without --conditions=fix-headers-dev. It is loaded
// synchronously, through require(esm), so it finishes before this module's exports can be
// called from ESM or CJS, sync or async: nothing runs against the wrong tree first. There is
// no top-level await, which index.cjs's require(esm) would reject (ERR_REQUIRE_ASYNC_MODULE).
// The file is never published, so MODULE_NOT_FOUND is expected outside a checkout; any other
// error is a real failure. The build keeps the specifier external, so dist/index.mjs and
// bin/fix-headers.mjs load the same root file instead of bundling it.
try {
	createRequire(import.meta.url)("../devcheck.mjs");
	/* v8 ignore start -- runs in the published package (no devcheck.mjs) or when devcheck.mjs itself
	   fails to load; the suite always runs from a checkout where it exists and loads */
} catch (error) {
	if (error?.code !== "MODULE_NOT_FOUND") throw error;
}
/* v8 ignore stop */

import { fixHeaders as fixHeadersCore } from "./core/fix-headers.mjs";

/**
 * @fileoverview Public module API exposing a single function for header updates.
 * @module fix-headers
 */

/**
 * Runs header fix-up using automatic metadata detection and optional overrides.
 * @param {Parameters<typeof fixHeadersCore>[0]} [options] - Runtime options.
 * @returns {ReturnType<typeof fixHeadersCore>} Update report.
 */
export function fixHeaders(options) {
	return fixHeadersCore(options);
}

export default fixHeaders;
