export namespace detector {
    export let id: string;
    export { extensions };
    export let enabledByDefault: boolean;
    export function resolvePreservedPrefix(filePath: any, content: any): string;
    export function resolveCommentSyntax(filePath: any): {
        kind: string;
        linePrefix: string;
    };
}
/**
 * @fileoverview Python detector implementation.
 * @module fix-headers/detectors/python
 */
declare const extensions: string[];
export {};
