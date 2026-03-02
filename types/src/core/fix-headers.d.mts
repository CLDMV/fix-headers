/**
 * @fileoverview Main header-fixing engine with auto-detection and override support.
 * @module fix-headers/core/fix-headers
 */
/**
 * Fixes headers in a project using auto-detected metadata unless overridden.
 * @param {FixHeadersOptions} [options={}] - Runtime options.
 * @returns {Promise<FixHeadersResult>} Process report.
 */
export function fixHeaders(options?: FixHeadersOptions): Promise<FixHeadersResult>;
export type FixHeadersOptions = {
    cwd?: string;
    input?: string;
    dryRun?: boolean;
    configFile?: string;
    sampleOutput?: boolean;
    forceAuthorUpdate?: boolean;
    useGpgSignerAuthor?: boolean;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    detectorSyntaxOverrides?: Record<string, {
        linePrefix?: string;
        lineSeparator?: string;
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
};
export type FixHeadersResult = {
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
    detectedProjects: string[];
    filesScanned: number;
    filesUpdated: number;
    dryRun: boolean;
    changes: Array<{
        file: string;
        changed: boolean;
        sample?: {
            previousValue: string | null;
            newValue: string;
            detectedValues?: {
                projectName: string;
                language: string;
                projectRoot: string;
                marker: string | null;
                authorName: string;
                authorEmail: string;
                companyName: string;
                copyrightStartYear: number;
                createdAtSource: string;
                lastModifiedAtSource: string;
                createdAt: {
                    date: string;
                    timestamp: number;
                };
                lastModifiedAt: {
                    date: string;
                    timestamp: number;
                };
            };
        };
    }>;
};
