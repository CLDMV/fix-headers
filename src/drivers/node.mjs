/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/drivers/node.mjs
 *	@Date: 2026-09-28T19:20:00-07:00 (1790648400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:15-07:00 (1790969295)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { cleanName, detectManifests, parseJsonManifest, personName } from "./shared.mjs";

/**
 * @fileoverview Node.js manifest driver: `package.json`. The name is the name the package is
 * published under (see readPublishedName); the copyright holder is `author.company`, else
 * `author.name`, else the name part of a string `author` (`"Name <email> (url)"`).
 * @module fix-headers/drivers/node
 */

const manifests = ["package.json"];

/**
 * Reads the name a package is published under: the npm package name, or, for a VS Code
 * extension (`engines.vscode` plus a `publisher`), its Marketplace identifier
 * `<publisher>.<name>` — extensions can't use an npm scope, so the publisher is what
 * identifies whose they are (`cldmv.jsonv-vscode`).
 * @param {any} manifest - Parsed `package.json`.
 * @returns {string | undefined} Published name, or undefined when there is no non-empty
 * string `name`.
 */
function readPublishedName(manifest) {
	const name = cleanName(manifest?.name);
	const publisher = cleanName(manifest?.publisher);
	const isVscodeExtension = typeof manifest?.engines?.vscode === "string";
	return name && publisher && isVscodeExtension ? `${publisher}.${name}` : name;
}

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
		return { name: readPublishedName(manifest), company: readAuthorCompany(manifest?.author) };
	}
};
