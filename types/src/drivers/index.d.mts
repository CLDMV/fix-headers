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
export type DriverDetection = import("./shared.mjs").DriverDetection;
export type ManifestData = {
    name?: string;
};
export type ManifestDriver = {
    id: string;
    languages: string[];
    manifests: string[];
    detect: (dirPath: string) => Promise<DriverDetection | null>;
    read: (detection: DriverDetection) => ManifestData;
};
export type FieldSource = {
    driver: string;
    manifest: string;
    dir: string;
};
export type ManifestProject = {
    root: string;
    marker: string;
    drivers: string[];
    fields: ManifestData;
    sources: Partial<Record<keyof ManifestData, FieldSource>>;
};
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
 * @typedef {{ name?: string }} ManifestData
 * Values a manifest provides. A field is left undefined when the manifest doesn't carry it.
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
export declare const MANIFEST_DRIVERS: ManifestDriver[];
/**
 * Fields resolved from manifests. Resolution climbs until each of them is found.
 * @type {Array<keyof ManifestData>}
 */
export declare const MANIFEST_FIELDS: Array<keyof ManifestData>;
/**
 * Gets a driver by id.
 * @param {string} id - Driver id.
 * @returns {ManifestDriver | undefined} Driver.
 */
export declare function getDriverById(id: string): ManifestDriver | undefined;
/**
 * Runs every driver's `detect` on one folder and orders the drivers that claim it: the
 * file's native driver first, then the registry order.
 * @param {string} dirPath - Folder.
 * @param {ManifestDriver[]} drivers - Drivers, in registry order.
 * @param {string | undefined} language - The file's detector id (undefined for no file).
 * @returns {Promise<Array<{ driver: ManifestDriver, detection: DriverDetection }>>} Ordered claims.
 */
export declare function claimFolder(dirPath: string, drivers: ManifestDriver[], language: string | undefined): Promise<Array<{
    driver: ManifestDriver;
    detection: DriverDetection;
}>>;
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
export declare function resolveManifestProject(startPath: string, options?: {
    drivers?: ManifestDriver[];
    language?: string;
    scanRoot?: string;
}): Promise<ManifestProject | null>;
