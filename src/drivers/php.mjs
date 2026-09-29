/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/drivers/php.mjs
 *	@Date: 2026-09-28T19:20:00-07:00 (1790648400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28T19:20:00-07:00 (1790648400)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { detectManifests, readJsonName } from "./shared.mjs";

/**
 * @fileoverview PHP manifest driver: `composer.json`.
 * @module fix-headers/drivers/php
 */

const manifests = ["composer.json"];

/** @type {import("./index.mjs").ManifestDriver} */
export const driver = {
	id: "php",
	languages: ["php"],
	manifests,
	detect(dirPath) {
		return detectManifests(dirPath, manifests);
	},
	read(detection) {
		return { name: readJsonName(detection.files[0].content) };
	}
};
