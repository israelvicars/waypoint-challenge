import { describe, it, expect } from 'vitest';
import { generateModifications } from '../src/tools/generate_modifications.js';

// Requires ANTHROPIC_API_KEY. Runs with Haiku by default (set ANTHROPIC_MODEL=claude-haiku-4-5-20251001).
const SKIP = !process.env.ANTHROPIC_API_KEY;

describe.skipIf(SKIP)('generate_modifications smoke test', () => {
  it('scenario 1: single student — output references lesson question IDs', async () => {
    const guide = await generateModifications('what-is-community', ['jasmine-bailey']);
    expect(guide.length).toBeGreaterThan(500);
    expect(guide).toMatch(/DRQ-|MC-|SR-|DISC-/i);
  }, 120_000);

  it('scenario 2: multi-student — output is activity-organized with both students and a synthesis section', async () => {
    const guide = await generateModifications('what-is-community', ['jasmine-bailey', 'marcus-chen']);
    expect(guide.length).toBeGreaterThan(500);
    expect(guide).toMatch(/DRQ-|MC-|SR-|DISC-/i);
    // Both student names appear (activity-organized)
    expect(guide).toMatch(/Jasmine/i);
    expect(guide).toMatch(/Marcus/i);
    // Synthesis or equivalent closing section is required
    expect(guide).toMatch(/synthesis|overlapping|divergent|interaction effect/i);
  }, 180_000);
});
