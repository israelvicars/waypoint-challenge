/**
 * Extracts named sections from IEP/lesson markdown by header matching.
 * No external markdown library — plain string walking.
 */

function extractSection(
  markdown: string,
  headerMatcher: (line: string) => boolean,
  level: 2 | 3
): string {
  const lines = markdown.split('\n');
  const startPrefix = level === 2 ? '## ' : '### ';
  const stopPattern = level === 2 ? /^#{1,2}\s/ : /^#{1,3}\s/;

  let capturing = false;
  const collected: string[] = [];

  for (const line of lines) {
    if (!capturing) {
      if (line.startsWith(startPrefix) && headerMatcher(line)) {
        capturing = true;
        collected.push(line);
      }
    } else {
      if (stopPattern.test(line) && line !== collected[0]) {
        break;
      }
      collected.push(line);
    }
  }

  return collected.join('\n').trim();
}

// Tier 1 — Key Profile Summary (header may have a suffix like "(MCP Reference)")
export function extractKeyProfileSummary(markdown: string): string {
  return extractSection(
    markdown,
    (line) => line.startsWith('## Key Profile Summary'),
    2
  );
}

// Tier 2 — Individual goal record
// Hand-curated files use ### (level 3); ingested files may produce ## (level 2). Try both.
export function extractGoal(markdown: string, goalNumber: number): string {
  const matcher = (line: string) =>
    /^#{2,3}\s+Goal \d+\s*[—-]/.test(line) && line.includes(`Goal ${goalNumber}`);
  return extractSection(markdown, matcher, 3) || extractSection(markdown, matcher, 2);
}

// Tier 3 — Flat accommodation list
export function extractAccommodations(markdown: string): string {
  return extractSection(
    markdown,
    (line) => line.startsWith('## Accommodations and Modifications'),
    2
  );
}

// Tier 4 — Full document fallback
export function getFullDocument(markdown: string): string {
  return markdown;
}
