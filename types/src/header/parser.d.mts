/**
 * Finds the first top-level project header block in a file.
 * @param {string} content - File content.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }> }} [syntaxOptions={}] - Syntax resolution options.
 * @returns {{start: number, end: number} | null} Header location.
 */
export function findProjectHeader(content: string, filePath?: string, syntaxOptions?: {
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
}): {
    start: number;
    end: number;
} | null;
/**
 * Replaces or inserts a project header block.
 * @param {string} content - Original file content.
 * @param {string} newHeader - Generated header text.
 * @param {string} [filePath=""] - File path used for syntax selection.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }> }} [syntaxOptions={}] - Syntax resolution options.
 * @returns {{nextContent: string, changed: boolean}} Updated content result.
 */
export function replaceOrInsertHeader(content: string, newHeader: string, filePath?: string, syntaxOptions?: {
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
}): {
    nextContent: string;
    changed: boolean;
};
