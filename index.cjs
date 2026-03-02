/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /index.cjs
 *	@Date: 2026-03-01 13:29:45 -08:00 (1772400585)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 16:29:36 -08:00 (1772411376)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview CJS shim for consuming the ESM-based fix-headers module.
 * @module fix-headers/cjs-shim
 */

"use strict";

/**
 * Loads the ESM module implementation.
 * @returns {Promise<import("./index.mjs")>} Loaded ESM module.
 */
function loadEsmModule() {
	return import("./index.mjs");
}

/**
 * Runs header normalization with auto-detection and override options.
 * @param {Record<string, unknown>} [options] - Runtime options.
 * @returns {Promise<unknown>} Header update report.
 */
async function fixHeaders(options) {
	const mod = await loadEsmModule();
	return mod.default(options);
}

module.exports = fixHeaders;
