/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/cjs/index.cjs
 *	@Date: 2026-09-28T06:56:09-07:00 (1790603769)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:11-07:00 (1790969291)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview CommonJS entry point — a thin, synchronous wrapper around the ESM build.
 *
 * Node's `require()` loads an ES module synchronously and returns its namespace, as
 * long as that module has no top-level await (dist/index.mjs has none). The wrapper
 * returns the default export, keeping the historical `module.exports = fixHeaders`
 * shape, instead of tsup bundling a second full copy of the library for CJS.
 *
 * tsup copies this folder verbatim into dist/ (`publicDir` in tsup.config.mjs); it
 * never passes through esbuild, so it stays this small however much the library grows.
 * @module fix-headers/cjs-entry
 */
"use strict";

module.exports = require("./index.mjs").default;
