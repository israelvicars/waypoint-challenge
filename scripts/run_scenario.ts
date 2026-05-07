/**
 * CLI harness for running demo scenarios without Claude Desktop.
 * Usage:
 *   npm run scenario:1   # Jasmine Bailey only
 *   npm run scenario:2   # Jasmine Bailey + Marcus Chen
 *
 * Set ANTHROPIC_MODEL env var to override the model (default: claude-opus-4-7).
 * Set WRITE_EXAMPLES=1 to write output to examples/.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateModifications } from '../src/tools/generate_modifications.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCENARIOS: Record<string, { lessonId: string; studentIds: string[]; outFile: string }> = {
  '1': {
    lessonId: 'what-is-community',
    studentIds: ['jasmine-bailey'],
    outFile: 'scenario_1_jasmine.md',
  },
  '2': {
    lessonId: 'what-is-community',
    studentIds: ['jasmine-bailey', 'marcus-chen'],
    outFile: 'scenario_2_jasmine_marcus.md',
  },
};

const scenarioNum = process.argv[2] ?? '1';
const scenario = SCENARIOS[scenarioNum];
if (!scenario) {
  console.error(`Unknown scenario "${scenarioNum}". Use 1 or 2.`);
  process.exit(1);
}

console.error(`[waypoint] Running scenario ${scenarioNum}: ${scenario.studentIds.join(' + ')} | model=${process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7'}`);
console.error('[waypoint] Generating...');

const guide = await generateModifications(scenario.lessonId, scenario.studentIds);

console.log(guide);

if (process.env.WRITE_EXAMPLES === '1') {
  const examplesDir = resolve(__dirname, '../examples');
  mkdirSync(examplesDir, { recursive: true });
  const outPath = resolve(examplesDir, scenario.outFile);
  writeFileSync(outPath, guide, 'utf-8');
  console.error(`[waypoint] Written to ${outPath}`);
}
