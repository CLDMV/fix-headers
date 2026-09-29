/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detect/project.mjs
 *	@Date: 2026-03-01 13:32:57 -08:00 (1772400777)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */
export type ProjectNameSource = {
    from: "manifest";
    driver: string;
    manifest: string;
    dir: string;
} | {
    from: "folder";
    dir: string;
} | {
    from: "option";
};
export type CompanyNameSource = {
    from: "manifest";
    driver: string;
    manifest: string;
    dir: string;
} | {
    from: "option";
} | {
    from: "none";
};
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
 * @param {{ detectors?: { id: string, extensions: string[] }[], enabledDetectors?: string[], disabledDetectors?: string[], preferredExtension?: string, drivers?: import("../drivers/index.mjs").ManifestDriver[], scanRoot?: string }} [options={}] - Detection options. `scanRoot` bounds how far values missing from the nearest manifests are looked up in ancestor folders; without it they aren't.
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
export declare function detectProjectFromMarkers(cwd: string, options?: {
    detectors?: {
        id: string;
        extensions: string[];
    }[];
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    preferredExtension?: string;
    drivers?: import("../drivers/index.mjs").ManifestDriver[];
    scanRoot?: string;
}): Promise<{
    language: string;
    rootDir: string;
    marker: string | null;
    projectName: string;
    projectNameSource: ProjectNameSource;
    companyName: string | null;
    companyNameSource: CompanyNameSource;
    drivers: string[];
}>;
/**
 * Resolves project metadata with override support for every auto-detected field.
 * @param {{
 *  cwd?: string,
 *  targetFilePath?: string,
 *  enabledDetectors?: string[],
 *  disabledDetectors?: string[],
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
 *  copyrightStartYear: number
 * }>} Final metadata. `companyName` is the `companyName` option when it is set, else the
 * holder the project's manifests provide, else null (no holder on the `@Copyright` line).
 */
export declare function resolveProjectMetadata(options?: {
    cwd?: string;
    targetFilePath?: string;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    projectName?: string;
    language?: string;
    projectRoot?: string;
    marker?: string | null;
    useGpgSignerAuthor?: boolean;
    authorName?: string;
    authorEmail?: string;
    company?: string;
    companyName?: string;
    copyrightStartYear?: number;
}): Promise<{
    projectName: string;
    projectNameSource: ProjectNameSource;
    language: string;
    projectRoot: string;
    marker: string | null;
    authorName: string;
    authorEmail: string;
    companyName: string | null;
    companyNameSource: CompanyNameSource;
    copyrightStartYear: number;
}>;
