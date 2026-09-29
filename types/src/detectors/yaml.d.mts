export namespace detector {
    export let id: string;
    export { extensions };
    export let enabledByDefault: boolean;
    export function resolveCommentSyntax(filePath: any): {
        kind: "line";
        linePrefix: string;
    };
}
/**
 * @fileoverview YAML detector implementation.
 * @module fix-headers/detectors/yaml
 */
declare const extensions: string[];
export {};
