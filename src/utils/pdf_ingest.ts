import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL } from '../config.js';

const anthropic = new Anthropic();

function dataDir(): string {
  if (process.env.WAYPOINT_DATA_DIR) return process.env.WAYPOINT_DATA_DIR;
  const thisFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(thisFile), '../../data');
}

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

function idToFilename(id: string, suffix: string): string {
  return id.replace(/-/g, '_') + suffix;
}

const IEP_SYSTEM = `You are processing an IEP document into structured markdown for a special education platform.

Extract the following sections in order. Use the exact header names shown.
Preserve all specific data points — reading levels, percentages, goal baselines and targets — exactly as written.
Do not summarize or paraphrase clinical language.

Required sections:
## Student Profile
## Present Levels — Academics
## Present Levels — Behavioral / Social / Emotional
## Accommodations and Modifications
### Goal 1 — [Area]
### Goal 2 — [Area]
### Goal N — [Area]  (one section per goal)
## Service Delivery
## Assessment Accommodations

After extracting all sections, generate a ## Key Profile Summary (MCP Reference) section containing:
- Disability classification and primary impact statement
- Present levels by domain with grade-level comparisons (e.g. "Reading: Grade 3, 4 years below grade level")
- All active IEP goals with baseline and annual target
- All accommodations in effect as a flat bulleted list
- Behavioral patterns: documented avoidance signals and reliable engagement strategies

The Key Profile Summary is the primary context unit for AI generation. Write it to be consumed directly by an LLM — concise, structured, no administrative language.

Return only the structured markdown. No preamble, no commentary.`;

const LESSON_SYSTEM = `You are processing a curriculum lesson document into structured markdown for a special education platform.

CRITICAL REQUIREMENT: All question text, prompt text, and vocabulary definitions must be copied
VERBATIM from the source. Do not paraphrase, summarize, or rephrase any question, prompt, or
task description. The downstream system depends on exact question text to generate
lesson-specific modifications.

Extract the following sections. Use the exact header names shown.

## Metadata
(title, author, grade, unit, lesson number, curriculum publisher if identifiable, skill standards)

## Skill Focus
(verbatim from source)

## Knowledge Focus
(verbatim from source)

## Teacher Notes
(any teacher-facing notes or facilitation guidance)

## Lesson Structure
(activity sequence as a table: activity name, modality, duration)

## Vocabulary
(all terms: pronunciation, part of speech, definition — verbatim)

Then for each activity in sequence:

## Activity N — [Name]
**Duration:** X minutes
**Modality:** [whole class / partner / independent / teacher-led]
**Description:** [brief description]

For activities with reading sections and questions:
### Section [Letter] — [Modality]: Paragraphs X–Y
**[VERBATIM TEXT]** (full passage text with paragraph numbers)
**DRQ-[N][Letter]** [question type] \`[SUPPORT]\` if optional
> [verbatim question text — exact copy from source]

For independent practice:
**MC-[N]** [standard tag]
> [verbatim question stem]
> A. [choice] B. [choice] C. [choice] D. [choice]

**SR-[N]** [standard tag]
> [verbatim prompt]

For discussion:
**DISC-[N]**
> [verbatim question text]

## Attribution
(source credit verbatim from source)

IMPORTANT: The very first characters of your response must be <!-- (a raw HTML comment opening tag). Do NOT use backticks, code fences, or any other wrapper. The file starts with <!-- and ends with --> before the first ## header.

Example of correct format (follow this exactly):
<!--
source_filename: example.pdf
processing_date: 2025-01-01
extraction_model: claude-opus-4-7
-->

## Metadata

Return only the structured markdown starting with <!--. No preamble, no commentary, no code fences.`;

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as Anthropic.TextBlock).text)
    .join('\n');
}

export async function ingestIepPdf(pdfPath: string, studentId: string): Promise<{ markdown: string; written_to: string }> {
  if (!ID_RE.test(studentId)) {
    throw new Error(`Invalid student ID: "${studentId}". Must match [a-z0-9][a-z0-9-]*`);
  }

  const b64 = readFileSync(pdfPath).toString('base64');

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: IEP_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: b64 },
          } as Anthropic.DocumentBlockParam,
          { type: 'text', text: 'Extract this IEP document into structured markdown per the schema.' },
        ],
      },
    ],
  });

  const markdown = extractText(response);
  const dir = path.join(dataDir(), 'ieps');
  mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, idToFilename(studentId, '_iep.md'));
  writeFileSync(outPath, markdown, 'utf-8');

  return { markdown, written_to: outPath };
}

export async function ingestLessonPdf(pdfPath: string, lessonId: string): Promise<{ markdown: string; written_to: string }> {
  if (!ID_RE.test(lessonId)) {
    throw new Error(`Invalid lesson ID: "${lessonId}". Must match [a-z0-9][a-z0-9-]*`);
  }

  const b64 = readFileSync(pdfPath).toString('base64');

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: LESSON_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: b64 },
          } as Anthropic.DocumentBlockParam,
          { type: 'text', text: 'Extract this lesson document into structured markdown per the schema.' },
        ],
      },
    ],
  });

  const markdown = extractText(response);
  const dir = path.join(dataDir(), 'lessons');
  mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, idToFilename(lessonId, '_lesson.md'));
  writeFileSync(outPath, markdown, 'utf-8');

  return { markdown, written_to: outPath };
}
