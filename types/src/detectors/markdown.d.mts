export namespace detector {
    export let id: string;
    export { extensions };
    export let enabledByDefault: boolean;
    export let requiresForce: boolean;
    export function resolvePreservedPrefix(filePath: any, content: any): string;
    export function resolveCommentSyntax(filePath: any): {
        kind: "html";
        blockStart: string;
        blockLinePrefix: string;
        blockEnd: string;
    };
}
/**
 * @fileoverview Markdown detector implementation. Force-only: Markdown files get a header
 * only when this detector is named in `forcedDetectors` (CLI `--force-detector markdown`),
 * and then as an HTML comment, which Markdown renderers do not display.
 * @module fix-headers/detectors/markdown
 */
declare const extensions: string[];
export {};
