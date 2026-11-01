/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/index.mjs
 *	@Date: 2026-03-01T13:34:00-08:00 (1772400840)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-31T15:56:35-07:00 (1793487395)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Development environment check. devcheck.mjs exists only in a source checkout and exits the
// process when the checkout runs without --conditions=fix-headers-dev. It is loaded
// synchronously, through require(esm), so it finishes before this module's exports can be
// called from ESM or CJS, sync or async: nothing runs against the wrong tree first. There is
// no top-level await, which index.cjs's require(esm) would reject (ERR_REQUIRE_ASYNC_MODULE).
//
// node:module is looked up at runtime with process.getBuiltinModule (Node >=20.16 / 22.3)
// instead of a static import, so bundlers never see a Node built-in or the devcheck path: a
// browser build of a package using this block keeps working, and without process (a browser)
// the check is skipped. devcheck.mjs is never published, so MODULE_NOT_FOUND is expected
// outside a checkout; any other error is a real failure. The build keeps the specifier
// external, so dist/index.mjs and bin/fix-headers.mjs load the same root file.
/* v8 ignore start -- the false branch is a non-Node runtime and the catch runs in the published
   package (no devcheck.mjs) or when devcheck.mjs fails to load; the suite always runs on Node
   from a checkout where devcheck.mjs exists and loads */
const nodeModule = typeof process === "undefined" ? undefined : process.getBuiltinModule?.("node:module");
if (nodeModule) {
	try {
		nodeModule.createRequire(import.meta.url)("../devcheck.mjs");
	} catch (error) {
		if (error?.code !== "MODULE_NOT_FOUND") throw error;
	}
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
