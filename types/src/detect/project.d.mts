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
export function detectProjectFromMarkers(cwd: string, options?: {
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
 *  copyrightStartYear: number | null
 * }>} Final metadata. `companyName` is the `companyName` option when it is set, else the
 * holder the project's manifests provide, else null (no holder on the `@Copyright` line).
 * `copyrightStartYear` is null when the option is not set: each file's start year then comes
 * from its own `@Date`.
 */
export function resolveProjectMetadata(options?: {
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
    copyrightStartYear: number | null;
}>;
/**
 * Where `projectName` came from: a manifest (the driver, its manifest and the folder it sits
 * in), the project root's folder name, or the `projectName` option.
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
/**
 * Where `companyName` (the `@Copyright` holder) came from: a manifest's author (the driver, its
 * manifest and the folder it sits in), the `companyName` option, or nothing (`companyName` is
 * null and the `@Copyright` line carries no holder).
 */
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
