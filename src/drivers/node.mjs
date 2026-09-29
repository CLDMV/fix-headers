/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/drivers/node.mjs
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
 * @fileoverview Node.js manifest driver: `package.json`.
 * @module fix-headers/drivers/node
 */

const manifests = ["package.json"];

/** @type {import("./index.mjs").ManifestDriver} */
export const driver = {
	id: "node",
	languages: ["node"],
	manifests,
	detect(dirPath) {
		return detectManifests(dirPath, manifests);
	},
	read(detection) {
		return { name: readJsonName(detection.files[0].content) };
	}
};
