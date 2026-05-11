/**
 * CLI harness for running PDF ingestion without Claude Desktop.
 * Usage:
 *   npm run ingest:iep      # ingest assets/iep.pdf → data/ieps/jasmine_bailey_iep.md
 *   npm run ingest:lesson   # ingest assets/lesson.pdf → data/lessons/what_is_community_lesson.md
 *
 * Set ANTHROPIC_MODEL env var to override the model (default: claude-opus-4-7).
 * Use ANTHROPIC_MODEL=claude-haiku-4-5-20251001 for fast/cheap dev iteration.
 */
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ingestIepPdf, ingestLessonPdf } from '../src/utils/pdf_ingest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, '../assets');

const target = process.argv[2];

if (target === 'iep') {
  const pdfPath = resolve(assetsDir, 'iep.pdf');
  console.error(`[waypoint] Ingesting IEP: ${pdfPath} | model=${process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7'}`);
  const { written_to } = await ingestIepPdf(pdfPath, 'jasmine-bailey');
  console.error(`[waypoint] Written to: ${written_to}`);
} else if (target === 'lesson') {
  const pdfPath = resolve(assetsDir, 'lesson.pdf');
  console.error(`[waypoint] Ingesting lesson: ${pdfPath} | model=${process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7'}`);
  const { written_to } = await ingestLessonPdf(pdfPath, 'what-is-community');
  console.error(`[waypoint] Written to: ${written_to}`);
} else {
  console.error('Usage: npm run ingest:iep  |  npm run ingest:lesson');
  process.exit(1);
}
