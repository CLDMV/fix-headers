/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/drivers/python.mjs
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

import { detectManifests, manifestContent, readIniValue, readTomlAuthor, readTomlString } from "./shared.mjs";

/**
 * @fileoverview Python manifest driver: `pyproject.toml`, `setup.cfg` and `setup.py`.
 *
 * Any of the three claims a folder. The name is read from, in order: `pyproject.toml`
 * `[project].name`, then `[tool.poetry].name`; `setup.cfg` `[metadata] name`; the `name=`
 * argument of the `setup(...)` call in `setup.py`. The copyright holder is read the same way from
 * the first author: `[project].authors[0].name`, then the name part of `[tool.poetry].authors[0]`
 * (`"Name <email>"`); `setup.cfg` `[metadata] author`; the `author=` argument of `setup(...)`.
 *
 * `requirements.txt` does not claim a folder: it lists dependencies, carries no name, and
 * often sits in folders that are not a project of their own (`docs/requirements.txt` for a
 * documentation build, for example).
 * @module fix-headers/drivers/python
 */

const manifests = ["pyproject.toml", "setup.cfg", "setup.py"];

/**
 * Reads a string keyword argument of the `setup(...)` call in a `setup.py`.
 * @param {string} content - `setup.py` content.
 * @param {string} keyword - Keyword (`name`, `author`).
 * @returns {string | undefined} Value.
 */
function readSetupPyArgument(content, keyword) {
	const setupCall = content.indexOf("setup(");
	if (setupCall === -1) {
		return undefined;
	}
	const match = content.slice(setupCall).match(new RegExp(`\\b${keyword}\\s*=\\s*(["'])([^"'\\n]+)\\1`));
	return match ? match[2].trim() || undefined : undefined;
}

/**
 * Reads the project name from whichever Python manifests the detection found.
 * @param {import("./shared.mjs").DriverDetection} detection - Driver detection.
 * @returns {string | undefined} Name.
 */
function readPythonName(detection) {
	const pyproject = manifestContent(detection, "pyproject.toml");
	const setupCfg = manifestContent(detection, "setup.cfg");
	const setupPy = manifestContent(detection, "setup.py");
	return (
		(pyproject === null ? undefined : (readTomlString(pyproject, "project", "name") ?? readTomlString(pyproject, "tool.poetry", "name"))) ??
		(setupCfg === null ? undefined : readIniValue(setupCfg, "metadata", "name")) ??
		(setupPy === null ? undefined : readSetupPyArgument(setupPy, "name"))
	);
}

/**
 * Reads the copyright holder (the first author) from whichever Python manifests the detection
 * found.
 * @param {import("./shared.mjs").DriverDetection} detection - Driver detection.
 * @returns {string | undefined} Holder.
 */
function readPythonCompany(detection) {
	const pyproject = manifestContent(detection, "pyproject.toml");
	const setupCfg = manifestContent(detection, "setup.cfg");
	const setupPy = manifestContent(detection, "setup.py");
	return (
		(pyproject === null ? undefined : (readTomlAuthor(pyproject, "project") ?? readTomlAuthor(pyproject, "tool.poetry"))) ??
		(setupCfg === null ? undefined : readIniValue(setupCfg, "metadata", "author")) ??
		(setupPy === null ? undefined : readSetupPyArgument(setupPy, "author"))
	);
}

/** @type {import("./index.mjs").ManifestDriver} */
export const driver = {
	id: "python",
	languages: ["python"],
	manifests,
	detect(dirPath) {
		return detectManifests(dirPath, manifests);
	},
	read(detection) {
		return { name: readPythonName(detection), company: readPythonCompany(detection) };
	}
};
