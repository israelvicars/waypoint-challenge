/**
 * Extracts named sections from IEP/lesson markdown by header matching.
 * No external markdown library — plain string walking.
 */
export declare function extractKeyProfileSummary(markdown: string): string;
export declare function extractGoal(markdown: string, goalNumber: number): string;
export declare function extractAccommodations(markdown: string): string;
export declare function getFullDocument(markdown: string): string;
//# sourceMappingURL=markdown_parser.d.ts.map