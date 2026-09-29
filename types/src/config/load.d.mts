/**
 * Merges `override` onto `base`: plain objects merge key by key, arrays and scalars replace.
 * Neither input is modified. `__proto__` keys are skipped so a config can't change prototypes.
 * @param {Record<string, unknown>} base - Lower-precedence settings.
 * @param {Record<string, unknown>} override - Higher-precedence settings.
 * @returns {Record<string, unknown>} Merged settings.
 */
export function mergeConfig(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown>;
/**
 * Loads a JSON config file and resolves its `extends` chain.
 * @param {string} configPath - Config file path, absolute or relative to `cwd`.
 * @param {string} [cwd=process.cwd()] - Folder a relative `configPath` resolves from.
 * @returns {Promise<Record<string, unknown>>} Fully merged settings from the file and everything it extends.
 */
export function loadConfigFile(configPath: string, cwd?: string): Promise<Record<string, unknown>>;
/**
 * Applies the config file named by `options[key]` underneath `options`: settings from the file
 * (and everything it extends) fill in, and every option passed directly wins over them. The
 * config-file key itself is removed from the result. Returns `options` unchanged when no config
 * file is named.
 * @template {Record<string, unknown>} T
 * @param {T} options - Direct options (CLI flags or API call options).
 * @param {string} key - Option naming the config file (`config` for the CLI, `configFile` for the API).
 * @returns {Promise<T>} Effective options.
 */
export function applyConfigOption<T extends Record<string, unknown>>(options: T, key: string): Promise<T>;
/**
 * Where a config was read from: a local file or a fetched URL.
 */
export type ConfigSource = {
    kind: "file";
    path: string;
} | {
    kind: "url";
    href: string;
};
