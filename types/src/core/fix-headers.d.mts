/**
 * @fileoverview Main header-fixing engine with auto-detection and override support.
 * @module fix-headers/core/fix-headers
 */
/**
 * Fixes headers in a project using auto-detected metadata unless overridden.
 * @param {{
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
 * }} [options={}] - Runtime options.
 * @returns {Promise<{
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
 *  filesScanned: number,
 *  filesUpdated: number,
 *  dryRun: boolean,
 *  changes: Array<{file: string, changed: boolean}>
 * }>} Process report.
 */
export function fixHeaders(options?: {
    cwd?: string;
    input?: string;
    dryRun?: boolean;
    configFile?: string;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    detectorSyntaxOverrides?: Record<string, {
        linePrefix?: string;
        blockStart?: string;
        blockLinePrefix?: string;
        blockEnd?: string;
    }>;
    includeFolders?: string[];
    excludeFolders?: string[];
    includeExtensions?: string[];
    projectName?: string;
    language?: string;
    projectRoot?: string;
    marker?: string | null;
    authorName?: string;
    authorEmail?: string;
    companyName?: string;
    copyrightStartYear?: number;
}): Promise<{
    metadata: {
        projectName: string;
        language: string;
        projectRoot: string;
        marker: string | null;
        authorName: string;
        authorEmail: string;
        companyName: string;
        copyrightStartYear: number;
    };
    filesScanned: number;
    filesUpdated: number;
    dryRun: boolean;
    changes: Array<{
        file: string;
        changed: boolean;
    }>;
}>;
