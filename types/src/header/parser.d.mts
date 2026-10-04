/**
 * Finds the first top-level project header block in a file.
 * @param {string} content - File content.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number, margin?: number }} [syntaxOptions={}] - Syntax resolution options.
 * @returns {{start: number, end: number} | null} Header location.
 */
export function findProjectHeader(content: string, filePath?: string, syntaxOptions?: {
    language?: string;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    forcedDetectors?: string[];
    detectorSyntaxOverrides?: Record<string, {
        linePrefix?: string;
        lineSeparator?: string;
        blockStart?: string;
        blockLinePrefix?: string;
        blockEnd?: string;
    }>;
    spacing?: number;
    margin?: number;
}): {
    start: number;
    end: number;
} | null;
/**
 * Replaces or inserts a project header block.
 * @param {string} content - Original file content.
 * @param {string} newHeader - Generated header text.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number, margin?: number }} [syntaxOptions={}] - Syntax resolution options.
 * @returns {{nextContent: string, changed: boolean}} Updated content result.
 */
export function replaceOrInsertHeader(content: string, newHeader: string, filePath?: string, syntaxOptions?: {
    language?: string;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    forcedDetectors?: string[];
    detectorSyntaxOverrides?: Record<string, {
        linePrefix?: string;
        lineSeparator?: string;
        blockStart?: string;
        blockLinePrefix?: string;
        blockEnd?: string;
    }>;
    spacing?: number;
    margin?: number;
}): {
    nextContent: string;
    changed: boolean;
};
/**
 * Returns a file's content with its project header taken out: the file as it would read
 * with no header at all. Blank lines between the header and the next content, and a body
 * that is only whitespace, are dropped, so two versions of a file that differ only in their
 * header (its fields, framing, spacing or margin, or whether it has one) give the same body.
 * @param {string} content - File content.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number, margin?: number }} [syntaxOptions={}] - Syntax resolution options.
 * @returns {string} The content outside the header.
 */
export function extractHeaderlessBody(content: string, filePath?: string, syntaxOptions?: {
    language?: string;
    enabledDetectors?: string[];
    disabledDetectors?: string[];
    forcedDetectors?: string[];
    detectorSyntaxOverrides?: Record<string, {
        linePrefix?: string;
        lineSeparator?: string;
        blockStart?: string;
        blockLinePrefix?: string;
        blockEnd?: string;
    }>;
    spacing?: number;
    margin?: number;
}): string;
