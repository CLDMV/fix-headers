import { readFile, stat, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { discoverFiles } from "./file-discovery.mjs";
import { resolveProjectMetadata } from "../detect/project.mjs";
import { buildHeader } from "../header/template.mjs";
import { replaceOrInsertHeader } from "../header/parser.mjs";
import { readFileDates } from "../utils/fs.mjs";
import { getGitCreationDate, getGitLastModifiedDate } from "../utils/git.mjs";
import { toDatePayload } from "../utils/time.mjs";

/**
 * @typedef {{
 *  cwd?: string,
 *  input?: string,
 *  dryRun?: boolean,
 *  configFile?: string,
 *  enabledDetectors?: string[],
 *  disabledDetectors?: string[],
 *  detectorSyntaxOverrides?: Record<string, { linePrefix?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>,
 *  includeFolders?: string[],
 *  excludeFolders?: string[],
 *  includeExtensions?: string[],
 *  projectName?: string,
 *  language?: string,
 *  projectRoot?: string,
 *  marker?: string | null,
 *  authorName?: string,
 *  authorEmail?: string,
 *  companyName?: string,
 *  copyrightStartYear?: number
 * }} FixHeadersOptions
 */

/**
 * @typedef {{
 *  metadata: {
 *   projectName: string,
 *   language: string,
 *   projectRoot: string,
 *   marker: string | null,
 *   authorName: string,
 *   authorEmail: string,
 *   companyName: string,
 *   copyrightStartYear: number
 *  },
 *  detectedProjects: string[],
 *  filesScanned: number,
 *  filesUpdated: number,
 *  dryRun: boolean,
 *  changes: Array<{file: string, changed: boolean}>
 * }} FixHeadersResult
 */

/**
 * Resolves runtime options including optional JSON config file loading.
 * @param {FixHeadersOptions} options - Runtime options.
 * @returns {Promise<FixHeadersOptions>} Effective runtime options.
 */
async function resolveRuntimeOptions(options) {
	const configFile = typeof options.configFile === "string" && options.configFile.trim().length > 0 ? options.configFile.trim() : null;

	if (!configFile) {
		return options;
	}

	const baseCwd = typeof options.cwd === "string" && options.cwd.length > 0 ? options.cwd : process.cwd();
	const absoluteConfigPath = resolve(baseCwd, configFile);
	const raw = await readFile(absoluteConfigPath, "utf8");
	const parsed = JSON.parse(raw);

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error(`Config file must contain a JSON object: ${configFile}`);
	}

	const merged = {
		...parsed,
		...options
	};

	delete merged.configFile;
	/** @type {FixHeadersOptions} */
	const output = merged;
	return output;
}

/**
 * @fileoverview Main header-fixing engine with auto-detection and override support.
 * @module fix-headers/core/fix-headers
 */

/**
 * Fixes headers in a project using auto-detected metadata unless overridden.
 * @param {FixHeadersOptions} [options={}] - Runtime options.
 * @returns {Promise<FixHeadersResult>} Process report.
 */
export async function fixHeaders(options = {}) {
	const effectiveOptions = await resolveRuntimeOptions(options);
	const scanRoot = resolve(effectiveOptions.projectRoot || effectiveOptions.cwd || process.cwd());
	const metadata = await resolveProjectMetadata({
		...effectiveOptions,
		cwd: scanRoot
	});
	const dryRun = effectiveOptions.dryRun === true;

	let files = [];
	if (typeof effectiveOptions.input === "string" && effectiveOptions.input.trim().length > 0) {
		const inputPath = resolve(scanRoot, effectiveOptions.input);
		const targetStats = await stat(inputPath).catch(() => null);
		if (!targetStats) {
			throw new Error(`Input path does not exist: ${effectiveOptions.input}`);
		}

		if (targetStats.isFile()) {
			files = [inputPath];
		} else if (targetStats.isDirectory()) {
			files = await discoverFiles({
				projectRoot: inputPath,
				language: metadata.language,
				enabledDetectors: effectiveOptions.enabledDetectors,
				disabledDetectors: effectiveOptions.disabledDetectors,
				includeFolders: effectiveOptions.includeFolders,
				excludeFolders: effectiveOptions.excludeFolders,
				includeExtensions: effectiveOptions.includeExtensions
			});
		} else {
			throw new Error(`Input path must be a file or directory: ${effectiveOptions.input}`);
		}
	} else {
		files = await discoverFiles({
			projectRoot: scanRoot,
			language: metadata.language,
			enabledDetectors: effectiveOptions.enabledDetectors,
			disabledDetectors: effectiveOptions.disabledDetectors,
			includeFolders: effectiveOptions.includeFolders,
			excludeFolders: effectiveOptions.excludeFolders,
			includeExtensions: effectiveOptions.includeExtensions
		});
	}

	const currentYear = new Date().getFullYear();
	const changes = [];
	const detectedProjects = new Set();
	let filesUpdated = 0;

	for (const filePath of files) {
		const fileMetadata = await resolveProjectMetadata({
			...effectiveOptions,
			cwd: scanRoot,
			targetFilePath: filePath
		});

		detectedProjects.add(`${fileMetadata.language}:${fileMetadata.projectRoot}`);
		const relativePath = relative(scanRoot, filePath);
		const original = await readFile(filePath, "utf8");
		const filesystemDates = await readFileDates(filePath);

		const metadataRelativePath = relative(fileMetadata.projectRoot, filePath);
		const gitCreated = await getGitCreationDate(fileMetadata.projectRoot, metadataRelativePath);
		const gitLastUpdated = await getGitLastModifiedDate(fileMetadata.projectRoot, metadataRelativePath);

		const createdAt = gitCreated || toDatePayload(filesystemDates.createdAt);
		const lastModifiedAt = gitLastUpdated || toDatePayload(filesystemDates.updatedAt);

		const header = buildHeader({
			absoluteFilePath: filePath,
			language: fileMetadata.language,
			syntaxOptions: {
				language: fileMetadata.language,
				enabledDetectors: effectiveOptions.enabledDetectors,
				disabledDetectors: effectiveOptions.disabledDetectors,
				detectorSyntaxOverrides: effectiveOptions.detectorSyntaxOverrides
			},
			projectRoot: fileMetadata.projectRoot,
			projectName: fileMetadata.projectName,
			authorName: fileMetadata.authorName,
			authorEmail: fileMetadata.authorEmail,
			createdAt,
			lastModifiedAt,
			copyrightStartYear: fileMetadata.copyrightStartYear,
			companyName: fileMetadata.companyName,
			currentYear
		});

		const replacement = replaceOrInsertHeader(original, header, filePath, {
			language: fileMetadata.language,
			enabledDetectors: effectiveOptions.enabledDetectors,
			disabledDetectors: effectiveOptions.disabledDetectors,
			detectorSyntaxOverrides: effectiveOptions.detectorSyntaxOverrides
		});
		changes.push({ file: relativePath, changed: replacement.changed });

		if (!replacement.changed) {
			continue;
		}

		filesUpdated += 1;
		if (!dryRun) {
			await writeFile(filePath, replacement.nextContent, "utf8");
		}
	}

	return {
		metadata,
		detectedProjects: Array.from(detectedProjects),
		filesScanned: files.length,
		filesUpdated,
		dryRun,
		changes
	};
}
