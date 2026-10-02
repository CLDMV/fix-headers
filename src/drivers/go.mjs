/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/drivers/go.mjs
 *	@Date: 2026-09-28T19:20:00-07:00 (1790648400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:14-07:00 (1790969294)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { cleanName, detectManifests } from "./shared.mjs";

/**
 * @fileoverview Go manifest driver: `go.mod` (the `module` path). `go.mod` has no author, so
 * the driver provides no copyright holder.
 * @module fix-headers/drivers/go
 */

const manifests = ["go.mod"];

/**
 * Reads the module path from `go.mod` content, without a trailing `//` comment or quotes.
 * @param {string} content - `go.mod` content.
 * @returns {string | undefined} Module path.
 */
function readModulePath(content) {
	const match = content.match(/^\s*module\s+(.+)$/m);
	if (!match) {
		return undefined;
	}
	return cleanName(
		match[1]
			.replace(/\/\/.*$/, "")
			.trim()
			.replace(/^["`](.*)["`]$/, "$1")
	);
}

/** @type {import("./index.mjs").ManifestDriver} */
export const driver = {
	id: "go",
	languages: ["go"],
	manifests,
	detect(dirPath) {
		return detectManifests(dirPath, manifests);
	},
	read(detection) {
		return { name: readModulePath(detection.files[0].content) };
	}
};
