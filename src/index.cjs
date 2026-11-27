/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: src/index.cjs
 *	@Date: 2026-09-28T06:56:09-07:00 (1790603769)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-27T12:16:43-08:00 (1795810603)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview CommonJS entry point: the generic CLDMV drop-in shim
 * (CLDMV/.github docs/conventions/package-layout.md).
 *
 * It returns what `import` gives: the single distinct exported value when there is one
 * (here `fixHeaders`, which is also the default export), so `require("@cldmv/fix-headers")`
 * is the function itself; otherwise the module object. scripts/build.mjs copies it
 * verbatim into dist/, where `./index.mjs` resolves to the built entry.
 * @module fix-headers/cjs-entry
 */
"use strict";

if (!process.features?.require_module) {
	const error = new Error(
		`@cldmv/fix-headers: require() needs Node.js ^20.19.0 or >=22.13.0 (this is ${process.version}). On older Node.js, load the package with import() instead.`
	);
	error.code = "ERR_REQUIRE_ESM";
	throw error;
}

// Same exports as `import`. One distinct exported value (aliases of it count once) comes back as that value,
// so require(x)(...) works; anything else comes back as the module object ({ default, ...named }).
const esm = require("./index.mjs");
const values = new Set(
	Object.keys(esm)
		.filter((key) => key !== "__esModule")
		.map((key) => esm[key])
);
module.exports = values.size === 1 ? values.values().next().value : esm;
