/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detect/project.mjs
 *	@Date: 2026-03-01T13:32:57-08:00 (1772400777)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:13-07:00 (1790969293)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { basename, dirname, extname, resolve } from "node:path";
import { getEnabledDetectors } from "../detectors/index.mjs";
import { resolveManifestProject } from "../drivers/index.mjs";
import { detectGitAuthor } from "../utils/git.mjs";

/**
 * @fileoverview Auto-detects project metadata from the project's manifests and git config.
 * @module fix-headers/detect/project
 */

/**
 * @typedef {{ from: "manifest", driver: string, manifest: string, dir: string } | { from: "folder", dir: string } | { from: "option" }} ProjectNameSource
 * Where `projectName` came from: a manifest (the driver, its manifest and the folder it sits
 * in), the project root's folder name, or the `projectName` option.
 */

/**
 * @typedef {{ from: "manifest", driver: string, manifest: string, dir: string } | { from: "option" } | { from: "none" }} CompanyNameSource
 * Where `companyName` (the `@Copyright` holder) came from: a manifest's author (the driver, its
 * manifest and the folder it sits in), the `companyName` option, or nothing (`companyName` is
 * null and the `@Copyright` line carries no holder).
 */

/**
 * Gets a folder's name, or `project` for the filesystem root.
 * @param {string} dirPath - Folder.
 * @returns {string} Folder name.
 */
function folderName(dirPath) {
	return basename(dirPath) || "project";
}

/**
 * Appends company suffix to author display name when requested.
 * @param {string} authorName - Base author name.
 * @param {string | undefined} company - Optional company suffix value.
 * @returns {string} Formatted author name.
 */
function formatAuthorNameWithCompany(authorName, company) {
	if (typeof company !== "string") {
		return authorName;
	}

	const trimmedCompany = company.trim();
	if (trimmedCompany.length === 0) {
		return authorName;
	}

	if (/<[^>]+>/.test(authorName)) {
		return authorName;
	}

	return `${authorName} <${trimmedCompany}>`;
}

/**
 * Detects the project a path belongs to from the manifests of the project it sits in (see
 * {@link resolveManifestProject}), independent of the file's type.
 *
 * `language` is the id of the file-type detector for `preferredExtension` when one handles
 * it; otherwise the first driver claiming the project root, or `unknown` without one. With
 * no manifest up to the repository root (a folder holding `.git`), that repository root is
 * the project root; with neither, the start folder is. The project name is then that
 * folder's name. The copyright holder (`companyName`) comes from the manifests' authors the same
 * way, and is null when none of them provides one.
 * @param {string} cwd - Starting directory (a file's folder, or the scan root).
 * @param {{ detectors?: { id: string, extensions: string[] }[], enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], preferredExtension?: string, drivers?: import("../drivers/index.mjs").ManifestDriver[], scanRoot?: string }} [options={}] - Detection options. `scanRoot` bounds how far values missing from the nearest manifests are looked up in ancestor folders; without it they aren't.
 * @returns {Promise<{
 *  language: string,
 *  rootDir: string,
 *  marker: string | null,
 *  projectName: string,
 *  projectNameSource: ProjectNameSource,
 *  companyName: string | null,
 *  companyNameSource: CompanyNameSource,
 *  drivers: string[]
 * }>} Detection result.
 */
export async function detectProjectFromMarkers(cwd, options = {}) {
	const detectors = Array.isArray(options.detectors) ? options.detectors : getEnabledDetectors(options);
	const extension = typeof options.preferredExtension === "string" ? options.preferredExtension.trim().toLowerCase() : "";
	const fileDetector = extension.length > 0 ? detectors.find((detector) => detector.extensions.includes(extension)) : undefined;
	const located = await resolveManifestProject(cwd, {
		drivers: options.drivers,
		language: fileDetector?.id,
		scanRoot: options.scanRoot
	});
	const rootDir = located ? located.root : resolve(cwd);
	const nameSource = located?.sources.name;
	const companySource = located?.sources.company;

	return {
		language: fileDetector?.id ?? located?.drivers[0] ?? "unknown",
		rootDir,
		marker: located ? located.marker : null,
		projectName: located?.fields.name ?? folderName(rootDir),
		projectNameSource: nameSource ? { from: "manifest", ...nameSource } : { from: "folder", dir: rootDir },
		companyName: located?.fields.company ?? null,
		companyNameSource: companySource ? { from: "manifest", ...companySource } : { from: "none" },
		drivers: located ? located.drivers : []
	};
}

/**
 * Resolves project metadata with override support for every auto-detected field.
 * @param {{
 *  cwd?: string,
 *  targetFilePath?: string,
 *  enabledDetectors?: string[],
 *  disabledDetectors?: string[],
 *  forcedDetectors?: string[],
 *  projectName?: string,
 *  language?: string,
 *  projectRoot?: string,
 *  marker?: string | null,
 *  useGpgSignerAuthor?: boolean,
 *  authorName?: string,
 *  authorEmail?: string,
 *  company?: string,
 *  companyName?: string,
 *  copyrightStartYear?: number
 * }} [options={}] - Detection options and overrides.
 * @returns {Promise<{
 *  projectName: string,
 *  projectNameSource: ProjectNameSource,
 *  language: string,
 *  projectRoot: string,
 *  marker: string | null,
 *  authorName: string,
 *  authorEmail: string,
 *  companyName: string | null,
 *  companyNameSource: CompanyNameSource,
 *  copyrightStartYear: number | null
 * }>} Final metadata. `companyName` is the `companyName` option when it is set, else the
 * holder the project's manifests provide, else null (no holder on the `@Copyright` line).
 * `copyrightStartYear` is null when the option is not set: each file's start year then comes
 * from its own `@Date`.
 */
export async function resolveProjectMetadata(options = {}) {
	const basePath = options.targetFilePath || options.cwd || process.cwd();
	const cwd = resolve(basePath);
	const detectors = getEnabledDetectors(options);
	const detectFrom = options.targetFilePath ? dirname(cwd) : cwd;
	const preferredExtension = options.targetFilePath ? extname(cwd).toLowerCase() : "";
	const scanRoot = resolve(options.projectRoot || options.cwd || process.cwd());
	const detected = await detectProjectFromMarkers(detectFrom, { detectors, preferredExtension, scanRoot });
	const gitAuthor = await detectGitAuthor(detected.rootDir, {
		useGpgSignerAuthor: options.useGpgSignerAuthor === true
	});
	const baseAuthorName = options.authorName || gitAuthor.authorName || "Unknown Author";
	const companyOption = typeof options.companyName === "string" ? options.companyName.trim() : "";

	return {
		projectName: options.projectName || detected.projectName,
		projectNameSource: options.projectName ? { from: "option" } : detected.projectNameSource,
		language: options.language || detected.language,
		projectRoot: options.projectRoot || detected.rootDir,
		marker: options.marker === undefined ? detected.marker : options.marker,
		authorName: formatAuthorNameWithCompany(baseAuthorName, options.company),
		authorEmail: options.authorEmail || gitAuthor.authorEmail || "unknown@example.com",
		companyName: companyOption || detected.companyName,
		companyNameSource: companyOption ? { from: "option" } : detected.companyNameSource,
		copyrightStartYear: Number.isInteger(options.copyrightStartYear) ? Number(options.copyrightStartYear) : null
	};
}
