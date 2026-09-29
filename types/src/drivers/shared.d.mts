/**
 * Detects a driver's manifests in one folder. The folder counts as a project of the driver's
 * kind when at least one of the manifests is present and readable; its content is not
 * validated here, so a malformed manifest still marks the project root.
 * @param {string} dirPath - Folder to check.
 * @param {string[]} manifests - Manifest filenames, in the order the driver reads them.
 * @returns {Promise<DriverDetection | null>} Detection, or null when the folder holds none of them.
 */
export function detectManifests(dirPath: string, manifests: string[]): Promise<DriverDetection | null>;
/**
 * Gets the content of one manifest from a detection.
 * @param {DriverDetection} detection - Driver detection.
 * @param {string} file - Manifest filename.
 * @returns {string | null} Content, or null when that manifest isn't present.
 */
export function manifestContent(detection: DriverDetection, file: string): string | null;
/**
 * Normalizes a candidate name: a trimmed non-empty string, else undefined.
 * @param {unknown} value - Candidate value.
 * @returns {string | undefined} Name.
 */
export function cleanName(value: unknown): string | undefined;
/**
 * Reads the name part of a person string in the `Name <email> (url)` form used by
 * `package.json` string authors, Poetry and Cargo authors: the text before the first `<` or `(`.
 * @param {unknown} value - Candidate value.
 * @returns {string | undefined} Name, or undefined when the value isn't a string or has no name
 * before its email or url.
 */
export function personName(value: unknown): string | undefined;
/**
 * Parses a JSON manifest (`package.json`, `composer.json`).
 * @param {string} content - Manifest content.
 * @returns {any} Parsed value, or undefined when the content isn't valid JSON.
 */
export function parseJsonManifest(content: string): any;
/**
 * Reads a string value from a TOML table: `key = "value"` or `key = 'value'` on its own line.
 * @param {string} content - TOML content.
 * @param {string} table - Table name, dotted for nested tables (`tool.poetry`).
 * @param {string} key - Bare key.
 * @returns {string | undefined} Value, or undefined when the table or key is missing.
 */
export function readTomlString(content: string, table: string, key: string): string | undefined;
/**
 * Reads a value from an INI section (`key = value` or `key: value`), as in `setup.cfg`.
 * @param {string} content - INI content.
 * @param {string} section - Section name.
 * @param {string} key - Key.
 * @returns {string | undefined} Value, or undefined when the section or key is missing.
 */
export function readIniValue(content: string, section: string, key: string): string | undefined;
/**
 * Reads the name of the first author in a TOML `authors` array: the name part of a string
 * entry (`authors = ["Name <email>"]`, as in Poetry and Cargo) or the `name` of an inline-table
 * entry (`authors = [{ name = "Name", email = "..." }]`, as in PEP 621).
 * @param {string} content - TOML content.
 * @param {string} table - Table name, dotted for nested tables (`tool.poetry`).
 * @returns {string | undefined} Name, or undefined when the table has no `authors` array or its
 * first entry carries no name.
 */
export function readTomlAuthor(content: string, table: string): string | undefined;
/**
 * A manifest file found in a folder, with its content.
 */
export type ManifestFile = {
    file: string;
    content: string;
};
/**
 * What a driver's `detect` found in a folder: the folder, the first manifest found (in the
 * driver's `manifests` order) and every manifest of the driver that is present and readable.
 */
export type DriverDetection = {
    dir: string;
    manifest: string;
    files: ManifestFile[];
};
