export namespace detector {
    export let id: string;
    export let priority: number;
    export { markers };
    export { extensions };
    export let enabledByDefault: boolean;
    export function findNearestConfig(startPath: any): Promise<{
        root: string;
        marker: string;
    }>;
    export function parseProjectName(_marker: any, markerContent: any, rootDirName: any): string;
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
declare const markers: string[];
declare const extensions: string[];
export {};
