/**
 * End-to-end demo script — exercises all 7 tools in pipeline order.
 *
 * Usage:
 *   npm run run:all
 *   ANTHROPIC_MODEL=claude-haiku-4-5-20251001 npm run run:all   # fast/cheap dev run
 *
 * Always writes a combined report to examples/run_all_report.md.
 * Status messages go to stderr; section output goes to stdout (pipeable).
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { ingestIepPdf, ingestLessonPdf } from '../src/utils/pdf_ingest.js';
import { getStudentProfile } from '../src/tools/get_student_profile.js';
import { getIepGoal } from '../src/tools/get_iep_goal.js';
import { getAccommodations } from '../src/tools/get_accommodations.js';
import { getLesson } from '../src/tools/get_lesson.js';
import { generateModifications } from '../src/tools/generate_modifications.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, '../assets');
const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7';

const reportLines: string[] = [];

function emit(text: string) {
  console.log(text);
  reportLines.push(text);
}

function status(text: string) {
  console.error(text);
}

function section(n: number, title: string) {
  const header = `\n## Step ${n} — ${title}\n`;
  emit(header);
}

function divider() {
  emit('\n---\n');
}

// Report header
emit(`# Waypoint Learning — End-to-End Demo Report`);
emit(`\n**Model:** ${model}  `);
emit(`**Date:** ${new Date().toISOString().split('T')[0]}  `);
emit(`**Scenarios:** Jasmine Bailey (single student) + Jasmine Bailey & Marcus Chen (multi-student)\n`);
divider();

// Step 1 — Ingest IEP
section(1, 'Ingest IEP PDF → data/ieps/jasmine_bailey_iep.md');
status(`[run:all] Step 1 — ingest IEP | model=${model}`);
const iepPdfPath = resolve(assetsDir, 'iep.pdf');
const { written_to: iepOut } = await ingestIepPdf(iepPdfPath, 'jasmine-bailey');
emit(`**Written to:** \`${iepOut}\``);
status(`[run:all] Step 1 complete`);
divider();

// Step 2 — Ingest lesson
section(2, 'Ingest Lesson PDF → data/lessons/what_is_community_lesson.md');
status(`[run:all] Step 2 — ingest lesson | model=${model}`);
const lessonPdfPath = resolve(assetsDir, 'lesson.pdf');
const { written_to: lessonOut } = await ingestLessonPdf(lessonPdfPath, 'what-is-community');
emit(`**Written to:** \`${lessonOut}\``);
status(`[run:all] Step 2 complete`);
divider();

// Step 3 — Tier 1: Jasmine profile
section(3, 'Tier 1 — Key Profile Summary: Jasmine Bailey');
status(`[run:all] Step 3 — get_student_profile jasmine-bailey`);
emit(getStudentProfile('jasmine-bailey'));
divider();

// Step 4 — Tier 1: Marcus profile
section(4, 'Tier 1 — Key Profile Summary: Marcus Chen (synthetic, no PDF)');
status(`[run:all] Step 4 — get_student_profile marcus-chen`);
emit(getStudentProfile('marcus-chen'));
divider();

// Step 5 — Tier 2: Jasmine goal 2
section(5, 'Tier 2 — IEP Goal Record: Jasmine Bailey, Goal 2');
status(`[run:all] Step 5 — get_iep_goal jasmine-bailey #2`);
emit(getIepGoal('jasmine-bailey', 2));
divider();

// Step 6 — Tier 3: Marcus accommodations
section(6, 'Tier 3 — Accommodation List: Marcus Chen');
status(`[run:all] Step 6 — get_accommodations marcus-chen`);
emit(getAccommodations('marcus-chen'));
divider();

// Step 7 — Lesson document
section(7, 'Lesson Document: What is Community');
status(`[run:all] Step 7 — get_lesson what-is-community`);
emit(getLesson('what-is-community'));
divider();

// Step 8 — Scenario 1: single student
section(8, 'generate_modifications — Scenario 1: Jasmine Bailey only');
status(`[run:all] Step 8 — generate_modifications scenario 1 | model=${model}`);
emit(await generateModifications('what-is-community', ['jasmine-bailey']));
divider();

// Step 9 — Scenario 2: multi-student
section(9, 'generate_modifications — Scenario 2: Jasmine Bailey + Marcus Chen');
status(`[run:all] Step 9 — generate_modifications scenario 2 | model=${model}`);
emit(await generateModifications('what-is-community', ['jasmine-bailey', 'marcus-chen']));
divider();

// Write report
const examplesDir = resolve(__dirname, '../examples');
mkdirSync(examplesDir, { recursive: true });
const reportPath = resolve(examplesDir, 'run_all_report.md');
writeFileSync(reportPath, reportLines.join('\n'), 'utf-8');
status(`[run:all] Report written to ${reportPath}`);
status(`[run:all] All steps complete.`);
