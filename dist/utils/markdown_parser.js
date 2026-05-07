/**
 * Extracts named sections from IEP/lesson markdown by header matching.
 * No external markdown library — plain string walking.
 */
function extractSection(markdown, headerMatcher, level) {
    const lines = markdown.split('\n');
    const startPrefix = level === 2 ? '## ' : '### ';
    const stopPattern = level === 2 ? /^#{1,2}\s/ : /^#{1,3}\s/;
    let capturing = false;
    const collected = [];
    for (const line of lines) {
        if (!capturing) {
            if (line.startsWith(startPrefix) && headerMatcher(line)) {
                capturing = true;
                collected.push(line);
            }
        }
        else {
            if (stopPattern.test(line) && line !== collected[0]) {
                break;
            }
            collected.push(line);
        }
    }
    return collected.join('\n').trim();
}
// Tier 1 — Key Profile Summary (header may have a suffix like "(MCP Reference)")
export function extractKeyProfileSummary(markdown) {
    return extractSection(markdown, (line) => line.startsWith('## Key Profile Summary'), 2);
}
// Tier 2 — Individual goal record
// Real files use em-dash (U+2014): "### Goal N — [Area]"
export function extractGoal(markdown, goalNumber) {
    return extractSection(markdown, (line) => /^### Goal \d+\s*[—-]/.test(line) && line.includes(`Goal ${goalNumber}`), 3);
}
// Tier 3 — Flat accommodation list
export function extractAccommodations(markdown) {
    return extractSection(markdown, (line) => line.startsWith('## Accommodations and Modifications'), 2);
}
// Tier 4 — Full document fallback
export function getFullDocument(markdown) {
    return markdown;
}
//# sourceMappingURL=markdown_parser.js.map