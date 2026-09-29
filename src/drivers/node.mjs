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

import { cleanName, detectManifests, parseJsonManifest, personName } from "./shared.mjs";

/**
 * @fileoverview Node.js manifest driver: `package.json`. The name is `name`; the copyright
 * holder is `author.company`, else `author.name`, else the name part of a string `author`
 * (`"Name <email> (url)"`).
 * @module fix-headers/drivers/node
 */

const manifests = ["package.json"];

/**
 * Reads the copyright holder from a parsed `package.json` `author`.
 * @param {unknown} author - The `author` value.
 * @returns {string | undefined} Holder.
 */
function readAuthorCompany(author) {
	if (author !== null && typeof author === "object") {
		const person = /** @type {{ company?: unknown, name?: unknown }} */ (author);
		return cleanName(person.company) ?? cleanName(person.name);
	}
	return personName(author);
}

/** @type {import("./index.mjs").ManifestDriver} */
export const driver = {
	id: "node",
	languages: ["node"],
	manifests,
	detect(dirPath) {
		return detectManifests(dirPath, manifests);
	},
	read(detection) {
		const manifest = parseJsonManifest(detection.files[0].content);
		return { name: cleanName(manifest?.name), company: readAuthorCompany(manifest?.author) };
	}
};
