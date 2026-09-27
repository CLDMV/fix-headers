/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/core/fix-headers.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */
export type FixHeadersOptions = {
    cwd?: string;
    input?: string;
    dryRun?: boolean;
    configFile?: string;
    sampleOutput?: boolean;
    forceAuthorUpdate?: boolean;
    forceLastModifiedAuthorUpdate?: boolean;
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
    gitignore?: boolean | string | string[];
    projectName?: string;
    language?: string;
    projectRoot?: string;
    marker?: string | null;
    authorName?: string;
    authorEmail?: string;
    company?: string;
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
/**
 * @fileoverview Main header-fixing engine with auto-detection and override support.
 * @module fix-headers/core/fix-headers
 */
/**
 * Fixes headers in a project using auto-detected metadata unless overridden.
 * @param {FixHeadersOptions} [options={}] - Runtime options.
 * @returns {Promise<FixHeadersResult>} Process report.
 */
export declare function fixHeaders(options?: FixHeadersOptions): Promise<FixHeadersResult>;
