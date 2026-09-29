/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/drivers/index.mjs
 *	@Date: 2026-09-28T19:20:00-07:00 (1790648400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28T19:20:00-07:00 (1790648400)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathExists } from "../utils/fs.mjs";
import { driver as goDriver } from "./go.mjs";
import { driver as nodeDriver } from "./node.mjs";
import { driver as phpDriver } from "./php.mjs";
import { driver as pythonDriver } from "./python.mjs";
import { driver as rustDriver } from "./rust.mjs";

/**
 * @fileoverview Manifest driver registry and project resolution.
 *
 * A manifest driver knows one ecosystem's manifest files: whether a folder is a project of
 * its kind (`detect`) and what that project's manifest says (`read`). Which project a file
 * belongs to, and the values its header takes from that project, are resolved here from the
 * drivers alone, whatever the file's type; comment syntax stays with the file-type detectors
 * in `src/detectors/`.
 * @module fix-headers/drivers
 */

/**
 * @typedef {import("./shared.mjs").DriverDetection} DriverDetection
 */

/**
 * @typedef {{ name?: string, company?: string }} ManifestData
 * Values a manifest provides. A field is left undefined when the manifest doesn't carry it.
 * - `name` - the project name (`@Project`).
 * - `company` - the copyright holder (`@Copyright`), taken from the manifest's author.
 */

/**
 * @typedef {{
 *  id: string,
 *  languages: string[],
 *  manifests: string[],
 *  detect: (dirPath: string) => Promise<DriverDetection | null>,
 *  read: (detection: DriverDetection) => ManifestData
 * }} ManifestDriver
 * - `id` - driver id, reported as the source of a value.
 * - `languages` - file-type detector ids whose files are native to this driver (`node` for
 *   `.js`/`.mjs`/`.ts`…); in a folder claimed by several drivers, a file's native driver is
 *   read first.
 * - `manifests` - manifest filenames that claim a folder, in the order they are read.
 * - `detect` - the manifests present and readable in a folder, or null when there are none.
 * - `read` - the values those manifests provide.
 */

/**
 * @typedef {{ driver: string, manifest: string, dir: string }} FieldSource
 * Where a value came from: the driver, its manifest (the first one found in the folder) and
 * the folder.
 */

/**
 * @typedef {{
 *  root: string,
 *  marker: string,
 *  drivers: string[],
 *  fields: ManifestData,
 *  sources: Partial<Record<keyof ManifestData, FieldSource>>
 * }} ManifestProject
 * - `root` - the project root: the nearest folder a driver claims, or the repository root
 *   (`marker: ".git"`, no drivers) when no manifest exists below it.
 * - `marker` - the first manifest of the first driver claiming the root, or `.git`.
 * - `drivers` - the drivers claiming the root, in the order they are read.
 * - `fields` / `sources` - the resolved values and where each came from.
 */

/**
 * Registered drivers, in the fixed order used when a folder is claimed by several drivers
 * and none of them is native to the file. Add a new driver module here.
 * @type {ManifestDriver[]}
 */
export const MANIFEST_DRIVERS = [nodeDriver, pythonDriver, phpDriver, rustDriver, goDriver];

/**
 * Fields resolved from manifests. Resolution climbs until each of them is found.
 * @type {Array<keyof ManifestData>}
 */
export const MANIFEST_FIELDS = ["name", "company"];

/**
 * Gets a driver by id.
 * @param {string} id - Driver id.
 * @returns {ManifestDriver | undefined} Driver.
 */
export function getDriverById(id) {
	return MANIFEST_DRIVERS.find((driver) => driver.id === id);
}

/**
 * Runs every driver's `detect` on one folder and orders the drivers that claim it: the
 * file's native driver first, then the registry order.
 * @param {string} dirPath - Folder.
 * @param {ManifestDriver[]} drivers - Drivers, in registry order.
 * @param {string | undefined} language - The file's detector id (undefined for no file).
 * @returns {Promise<Array<{ driver: ManifestDriver, detection: DriverDetection }>>} Ordered claims.
 */
export async function claimFolder(dirPath, drivers, language) {
	const detections = await Promise.all(drivers.map(async (driver) => ({ driver, detection: await driver.detect(dirPath) })));
	const claims = detections.filter((claim) => claim.detection !== null);
	const native = claims.filter((claim) => typeof language === "string" && claim.driver.languages.includes(language));
	return [...native, ...claims.filter((claim) => !native.includes(claim))];
}

/**
 * Whether `dirPath` lies strictly inside `rootPath`.
 * @param {string} dirPath - Folder.
 * @param {string} rootPath - Enclosing folder.
 * @returns {boolean} True when `dirPath` is a descendant of `rootPath`.
 */
function isStrictlyInside(dirPath, rootPath) {
	const relativePath = relative(rootPath, dirPath);
	return relativePath !== "" && relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath);
}

/**
 * Resolves the project a path belongs to from the manifest drivers.
 *
 * 1. Walk up from `startPath`. The nearest folder that at least one driver claims is the
 *    project root. A folder holding `.git` ends the walk: with no claimed folder up to and
 *    including it, that repository root is the project root and no driver provides values.
 * 2. Each field comes from the first driver in the root's claim order (native driver first,
 *    then node, python, php, rust, go) whose manifest provides it.
 * 3. A field no driver at the root provides is looked up the same way in each ancestor folder
 *    a driver claims, climbing no higher than `scanRoot` and stopping at a folder that holds
 *    `.git`. Without a `scanRoot`, or when the root is not inside it, nothing climbs.
 *
 * Only values climb; the project root stays the nearest claimed folder.
 * @param {string} startPath - Folder to start from (a file's folder, or the scan root).
 * @param {{ drivers?: ManifestDriver[], language?: string, scanRoot?: string }} [options={}] - Resolution options.
 * @returns {Promise<ManifestProject | null>} Resolved project, or null when neither a manifest nor a `.git` exists up to the filesystem root.
 */
export async function resolveManifestProject(startPath, options = {}) {
	const drivers = Array.isArray(options.drivers) ? options.drivers : MANIFEST_DRIVERS;
	const scanRoot = typeof options.scanRoot === "string" ? resolve(options.scanRoot) : null;
	let root = resolve(startPath);
	let claims = await claimFolder(root, drivers, options.language);

	while (claims.length === 0) {
		if (await pathExists(join(root, ".git"))) {
			return { root, marker: ".git", drivers: [], fields: {}, sources: {} };
		}
		const parent = dirname(root);
		if (parent === root) {
			return null;
		}
		root = parent;
		claims = await claimFolder(root, drivers, options.language);
	}

	/** @type {ManifestData} */
	const fields = {};
	/** @type {ManifestProject["sources"]} */
	const sources = {};
	let current = root;
	let currentClaims = claims;

	while (true) {
		for (const { driver, detection } of currentClaims) {
			const data = driver.read(detection);
			for (const field of MANIFEST_FIELDS) {
				if (fields[field] === undefined && data[field] !== undefined) {
					fields[field] = data[field];
					sources[field] = { driver: driver.id, manifest: detection.manifest, dir: current };
				}
			}
		}

		const complete = MANIFEST_FIELDS.every((field) => fields[field] !== undefined);
		if (complete || scanRoot === null || !isStrictlyInside(current, scanRoot) || (await pathExists(join(current, ".git")))) {
			break;
		}
		current = dirname(current);
		currentClaims = await claimFolder(current, drivers, options.language);
	}

	return {
		root,
		marker: claims[0].detection.manifest,
		drivers: claims.map((claim) => claim.driver.id),
		fields,
		sources
	};
}
