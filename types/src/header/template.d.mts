/**
 * @fileoverview Header template builder used to generate normalized file headers.
 * @module fix-headers/header/template
 */
/**
 * Builds a normalized header block for a source file.
 * @param {{
 *  absoluteFilePath: string,
 *  language?: string,
 *  syntaxOptions?: { language?: string, enabledDetectors?: string[], disabledDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }> },
 *  projectRoot: string,
 *  createdByName?: string,
 *  createdByEmail?: string,
 *  lastModifiedByName?: string,
 *  lastModifiedByEmail?: string,
 *  projectName: string,
 *  authorName: string,
 *  authorEmail: string,
 *  createdAt: {date: string, timestamp: number},
 *  lastModifiedAt: {date: string, timestamp: number},
 *  copyrightStartYear: number,
 *  companyName: string,
 *  currentYear: number
 * }} data - Header data.
 * @returns {string} Header block text.
 */
export function buildHeader(data: {
    absoluteFilePath: string;
    language?: string;
    syntaxOptions?: {
        language?: string;
        enabledDetectors?: string[];
        disabledDetectors?: string[];
        detectorSyntaxOverrides?: Record<string, {
            linePrefix?: string;
            lineSeparator?: string;
            blockStart?: string;
            blockLinePrefix?: string;
            blockEnd?: string;
        }>;
    };
    projectRoot: string;
    createdByName?: string;
    createdByEmail?: string;
    lastModifiedByName?: string;
    lastModifiedByEmail?: string;
    projectName: string;
    authorName: string;
    authorEmail: string;
    createdAt: {
        date: string;
        timestamp: number;
    };
    lastModifiedAt: {
        date: string;
        timestamp: number;
    };
    copyrightStartYear: number;
    companyName: string;
    currentYear: number;
}): string;
