# Waypoint Learning — Technical Architecture & Implementation

**Version:** 1.0
**Status:** MVP complete
**Last updated:** 2026-05-07

---

## Overview

This document describes the architecture, implementation decisions, and data pipeline for the Waypoint Learning MCP server. It is intended as a technical reference alongside the submission README.

The server gives Claude the context it needs to generate lesson-specific modification guides for teachers with IEP students. It exposes student IEP data and lesson content as structured resources and tools. The core output is a modification guide: a structured, ready-to-use document organized by lesson activity that tells the teacher exactly what to do differently for each IEP student in the period.

The MVP demonstrates two scenarios:
1. **Single-student:** Modification guide for Jasmine Bailey on the "What is Community?" lesson
2. **Multi-student:** Modification guide for both Jasmine Bailey and Marcus Chen on the same lesson

---

## Tech Stack

| Concern | Choice |
|---|---|
| Language | TypeScript |
| Runtime | Node.js 18+ |
| MCP SDK | `@modelcontextprotocol/sdk` |
| Anthropic SDK | `@anthropic-ai/sdk` |
| Validation | `zod` |
| Data storage | Local filesystem (markdown files) |
| External services | Anthropic API only |

No database. No external services beyond the Anthropic API. The server runs from a fresh clone with only `npm install` and a valid `ANTHROPIC_API_KEY` environment variable.

---

## Ingestion Pipeline

The ingestion pipeline converts source PDFs into the structured markdown files the MCP server reads at generation time. It runs once per document — not on every generation call. Pre-processed files for both IEPs and the lesson are committed to the repository and ready to use without re-ingestion.

### Pipeline stages

```
PDF → [LLM extraction pass] → structured markdown
```

The MVP uses native Anthropic PDF support — the model receives the PDF directly (text and visual layout) and extracts structured markdown in a single API call. No intermediate text extraction step is required.

Two ingestion tools are exposed via MCP:

| Tool | Input | Output |
|---|---|---|
| `ingest_iep` | `pdf_path: string, student_id: string` | Writes `data/ieps/{student_id}_iep.md` |
| `ingest_lesson` | `pdf_path: string, lesson_id: string` | Writes `data/lessons/{lesson_id}_lesson.md` |

The generation model is configurable via the `ANTHROPIC_MODEL` environment variable (default: `claude-opus-4-7`). Using a faster model during development and Opus for production-quality output is supported.

### IEP extraction schema

The extraction prompt targets these sections in order, using exact header names for consistent downstream parsing:

```
## Student Profile
## Present Levels — Academics
## Present Levels — Behavioral / Social / Emotional
## Accommodations and Modifications
### Goal 1 — [Area]
### Goal 2 — [Area]
### Goal N — [Area]
## Service Delivery
## Assessment Accommodations
## Key Profile Summary   ← generated synthesis, not extracted
```

The prompt instructs the model to preserve all clinical data points exactly as written — reading levels, goal baselines and targets, accommodation language — without summarizing or paraphrasing.

### Lesson extraction schema

```
## Metadata
## Skill Focus
## Knowledge Focus
## Teacher Notes
## Lesson Structure
## Vocabulary
## Activity N — [Name]
   ### Section [Letter] — [Modality]: Paragraphs X–Y
   [VERBATIM TEXT]
   DRQ-[N][Letter] [question type] [SUPPORT if optional]
## Attribution
```

**Critical constraint:** all question text, prompt text, and vocabulary definitions are copied verbatim from the source. The extraction prompt states this explicitly and treats it as a hard requirement. The downstream generation step depends on exact question text — a scaffolded version of DRQ-1A is only meaningful if DRQ-1A is present as written. The lesson file includes an ingestion manifest (HTML comment block) recording the source filename, processing date, model used, normalization decisions, and verbatim preservation scope.

### IEP extraction prompt (v1 automation reference)

The following prompt schema documents the intended extraction behavior for a v1 automated pipeline. For MVP, the two IEP files are pre-processed and committed to the repository.

```
You are processing an IEP document into structured markdown for a special education platform.

Extract the following sections in order. Use the exact header names shown.
Preserve all specific data points — reading levels, percentages, goal baselines and
targets — exactly as written. Do not summarize or paraphrase clinical language.

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

After extracting all sections, generate a ## Key Profile Summary containing:
- Disability classification and primary impact statement
- Present levels by domain with grade-level comparisons
  (e.g. "Reading: Grade 3, 4 years below grade level")
- All active IEP goals with baseline and annual target
- All accommodations in effect as a flat bulleted list
- Behavioral patterns: documented avoidance signals and reliable engagement strategies

The Key Profile Summary is the primary context unit for AI generation. Write it to be
consumed directly by an LLM — concise, structured, no administrative language.

IEP text follows:
{raw_text}
```

### Lesson extraction prompt (v1 automation reference)

```
You are processing a curriculum lesson document into structured markdown for a
special education platform.

CRITICAL REQUIREMENT: All question text, prompt text, and vocabulary definitions
must be copied VERBATIM from the source. Do not paraphrase, summarize, or rephrase
any question, prompt, or task description. The downstream system depends on exact
question text to generate lesson-specific modifications.

Extract the following sections. Use the exact header names shown.

## Metadata
## Skill Focus
## Knowledge Focus
## Teacher Notes
## Lesson Structure
## Vocabulary

Then for each activity in sequence:

## Activity N — [Name]
**Duration:** X minutes
**Modality:** [whole class / partner / independent / teacher-led]

For activities with reading sections and questions:
### Section [Letter] — [Modality]: Paragraphs X–Y
**[VERBATIM TEXT]** (full passage text with paragraph numbers)
**DRQ-[N][Letter]** [question type] `[SUPPORT]` if optional
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

Add an ingestion manifest as an HTML comment block at the top of the file recording:
source filename, processing date, extraction model, curriculum schema detected,
normalization decisions, verbatim preservation scope, and any flags.

Lesson text follows:
{raw_text}
```

### Pre-processed files

All three files are committed to the repository and ready to use:

| File | Status |
|---|---|
| `data/ieps/jasmine_bailey_iep.md` | ✓ Ready |
| `data/ieps/marcus_chen_iep.md` | ✓ Ready |
| `data/lessons/what_is_community_lesson.md` | ✓ Ready |

Hand-curated originals are archived in `examples/originals/` as a quality baseline for comparing against re-ingested versions.

---

## Repository Structure

```
waypoint-challenge/
├── data/
│   ├── ieps/
│   │   ├── jasmine_bailey_iep.md
│   │   └── marcus_chen_iep.md
│   └── lessons/
│       └── what_is_community_lesson.md
├── src/
│   ├── index.ts                    # MCP server entry, StdioServerTransport
│   ├── config.ts                   # MODEL from ANTHROPIC_MODEL env var
│   ├── tools/
│   │   ├── get_student_profile.ts  # Tier 1 Key Profile Summary retrieval
│   │   ├── get_iep_goal.ts         # Tier 2 goal record retrieval
│   │   ├── get_accommodations.ts   # Tier 3 accommodation list retrieval
│   │   ├── get_lesson.ts           # Lesson document retrieval
│   │   ├── generate_modifications.ts  # Core generation (Anthropic API call)
│   │   ├── ingest_iep.ts           # PDF → IEP markdown
│   │   └── ingest_lesson.ts        # PDF → lesson markdown
│   ├── resources/
│   │   ├── iep_resource.ts         # iep://{student_id}/{summary|goals/N|accommodations|full}
│   │   └── lesson_resource.ts      # lesson://{lesson_id}
│   └── utils/
│       ├── file_reader.ts          # readIEP(), readLesson() — path resolved via import.meta.url
│       └── markdown_parser.ts      # Section extraction by ## / ### header
├── examples/
│   ├── scenario_1_jasmine.md
│   ├── scenario_2_jasmine_marcus.md
│   └── originals/                  # Hand-curated baseline for quality comparison
├── scripts/
│   └── run_scenario.ts             # CLI harness for dev iteration and example generation
├── tests/
│   ├── file_reader.test.ts
│   ├── markdown_parser.test.ts
│   └── generate_modifications.smoke.test.ts
├── assets/
│   ├── iep.pdf                     # Source IEP document
│   └── lesson.pdf                  # Source lesson document
├── package.json
├── tsconfig.json
└── README.md
```

---

## Data Files

### IEP files

Each processed IEP markdown file contains the following sections, extractable by header:

- `## Key Profile Summary` — Tier 1; the default input for generation
- `### Goal N — [Area]` — Tier 2; individual goal records (e.g. `### Goal 3 — ELA`)
- `## Accommodations and Modifications` — Tier 3; flat accommodation list
- Full file — Tier 4 fallback

The `## Key Profile Summary` section is the pre-generated synthesis block. It is the terminal output of the ingestion pipeline and the primary runtime context for generation — see IEP Chunking Strategy below.

### Lesson file

`what_is_community_lesson.md` includes:

- Ingestion manifest comment block at the top
- Metadata table, skill focus, knowledge focus, teacher notes
- Lesson structure table (4 activities with timing and modalities)
- Vocabulary table with pronunciation and inline glossary for all footnoted terms
- Full verbatim text passage (paragraphs 1–11 with paragraph numbers preserved)
- During reading questions labeled `DRQ-[section][letter]` with activity type and `[SUPPORT]` flags for optional questions
- Independent practice: 4 MC questions with verbatim stems and all answer choices; 1 short response prompt verbatim with self-checklist
- Student-led discussion: 3 questions verbatim

---

## MCP Server Entry Point

The server is initialized with name `waypoint-learning` and version `1.0.0` using `StdioServerTransport`. All tools and resources are registered at startup.

---

## Utilities

### `src/utils/file_reader.ts`

Typed filesystem access. All paths resolve relative to `import.meta.url` for reliability regardless of working directory (important for Claude Desktop, which launches with an arbitrary working directory).

```typescript
export function readIEP(studentId: string): string
export function readLesson(lessonId: string): string
```

> **V1:** `readRoster()` and the `RosterConfig` type are deferred to v1 alongside the `get_period_roster` tool and `roster.json` config.

### `src/utils/markdown_parser.ts`

Extracts named sections from IEP markdown files by header. All extraction uses string matching on `##` and `###` headers — no external markdown library required. Finds the target header line, then collects content until the next header of equal or higher level.

```typescript
export function extractKeyProfileSummary(markdown: string): string
export function extractGoal(markdown: string, goalNumber: number): string
export function extractAccommodations(markdown: string): string
export function getFullDocument(markdown: string): string
```

---

## Tools

### `get_student_profile`

Returns the Tier 1 Key Profile Summary for a student.

**Input:** `{ student_id: string }`
**Output:** Markdown string — the `## Key Profile Summary` section from the student's IEP file.

---

### `get_iep_goal`

Returns a specific IEP goal record (Tier 2).

**Input:** `{ student_id: string; goal_number: number }`
**Output:** Markdown string — the matching `### Goal N` section including baseline, annual goal, criteria, method, schedule, responsible party, and short-term objectives.

---

### `get_accommodations`

Returns the flat accommodation list (Tier 3).

**Input:** `{ student_id: string }`
**Output:** Markdown string — the `## Accommodations and Modifications` section.

---

### `get_lesson`

Returns the full processed lesson document.

**Input:** `{ lesson_id: string }`
**Output:** Markdown string — the full lesson file.

---

### `ingest_iep`

Ingests a PDF IEP and writes the processed markdown file.

**Input:** `{ pdf_path: string; student_id: string }`
**Output:** Confirmation string; writes `data/ieps/{student_id}_iep.md`.
**Note:** `pdf_path` must be an absolute path. Claude Desktop launches with an arbitrary working directory, so relative paths silently fail.

---

### `ingest_lesson`

Ingests a PDF lesson document and writes the processed markdown file.

**Input:** `{ pdf_path: string; lesson_id: string }`
**Output:** Confirmation string; writes `data/lessons/{lesson_id}_lesson.md`.

---

### `generate_modifications` *(core tool)*

Generates a complete modification guide for a lesson and one or more students.

**Input:**
```typescript
{
  lesson_id: string;
  student_ids: string[];   // one or more student IDs
}
```

**Process:**
1. Load the full lesson document via `readLesson(lesson_id)`
2. For each student ID, extract the Key Profile Summary via `extractKeyProfileSummary(readIEP(id))`
3. Determine output organization: `isMultiStudent = student_ids.length > 1`
4. Build system prompt and user message (see Prompt Design below)
5. Call `anthropic.messages.create` with the configured model, `max_tokens: 4000`
6. Return the generated guide as a markdown string

**Output:** Markdown string — the complete modification guide.

> **V1 note:** `get_period_roster(period_id)` is deferred to v1. It will accept a period ID, resolve student and lesson IDs from `roster.json`, and return them for use in a subsequent `generate_modifications` call. For MVP, student IDs are passed directly by the caller.

---

## Resources

IEP tiers and lesson content are exposed as MCP resources, allowing Claude to read them directly in addition to using tools.

| Resource URI | Description |
|---|---|
| `iep://{student_id}/summary` | Tier 1 — Key Profile Summary |
| `iep://{student_id}/goals/{goal_number}` | Tier 2 — Individual goal record |
| `iep://{student_id}/accommodations` | Tier 3 — Accommodation list |
| `iep://{student_id}/full` | Tier 4 — Full IEP document |
| `lesson://{lesson_id}` | Full lesson document |

> **V1 note:** `roster://{period_id}` is deferred to v1 alongside `get_period_roster`.

---

## IEP Chunking Strategy

The IEP is not loaded wholesale into context. It is chunked into four functional retrieval tiers, each serving a distinct reasoning task:

| Tier | Content | Size | When loaded |
|---|---|---|---|
| 1 — Key Profile Summary | Pre-computed synthesis: disability, present levels, goals, accommodations, behavioral patterns | ~300 words | Default — always |
| 2 — Goal records | One section per goal: baseline, target, criteria, measurement | ~150 words each | On-demand when citing a specific goal |
| 3 — Accommodation list | Flat bulleted list of all active accommodations | ~100 words | On-demand for before-class checklist |
| 4 — Full document | Complete processed IEP markdown | ~2,500 words | Fallback only |

The Key Profile Summary (Tier 1) is generated at ingestion time, not at generation time. The synthesis work — "what does a teacher need to know about this student to modify a lesson?" — is done once at ingest and stored as a named section of the processed markdown. At runtime, `generate_modifications` loads the KPS for each student (a string slice), combines it with the full lesson, and passes both to the model.

For a two-student class, the generation context is: lesson (~2,600 words) + 2 × KPS (~600 words total) = ~3,200 words of signal. The full IEPs (2 × 2,500 words = 5,000 words) never enter the context window unless a specific section is needed. This keeps context lean as roster size grows toward the production case.

---

## Prompt Design for `generate_modifications`

### System prompt

```
You are an expert special education instructional coach helping a teacher prepare for class.

Your task is to generate a modification guide for the lesson provided, tailored
specifically to the IEP students listed. The guide must be grounded in both the lesson
content and each student's IEP — not generic accommodation strategies.

REQUIREMENTS:
- Every modification must be traceable to a specific IEP source (accommodation,
  present level, or goal). Tag each recommendation: [Goal N], [Accom: key phrase],
  or [Present Level: domain].
- Every modification must reference actual lesson content — use the specific activity
  names, question numbers (DRQ-1A, MC-3, SR-1, DISC-2, etc.), and verbatim prompt
  text from the lesson.
- Ready-to-use materials (scaffolded questions, sentence frames, prompts) must be
  derived from the real lesson questions, not invented generically.

OUTPUT STRUCTURE:
1. Before-class checklist — materials to prepare, seating, partner assignments
2. One section per lesson activity, in lesson order:
   - Activity name and duration
   - Modifications per student (specific, actionable)
   - Ready-to-use material (scaffolded version, sentence frame, or prompt —
     copy-paste ready)
   - Watch-for (behavioral signal from IEP + what to do when it appears)
3. [Multi-student only] Synthesis section:
   - Overlapping needs (one prep task covers multiple students)
   - Divergent needs (different scaffolds required at the same activity)
   - Interaction effects (instructional opportunities created by this student
     combination)

FORMAT: Clean markdown. Use headers for each activity. Use bold for student names in
multi-student sections. The guide should be printable and usable in class without
further editing.
```

### User message

```
LESSON:
{full lesson markdown}

---

STUDENT IEP PROFILES:
{for each student: "## [Student Name]\n" + key profile summary}

---

Generate a {single-student / class period} modification guide.
{if single: "The guide should be organized by lesson activity."}
{if multi: "The guide should be organized by lesson activity, with each activity
listing modifications per student. Include a synthesis section at the end."}
```

---

## Demo Scenarios

### Scenario 1 — Single student

> "Generate a modification guide for Jasmine Bailey for the What is Community lesson."

Tool call: `generate_modifications({ lesson_id: "what-is-community", student_ids: ["jasmine-bailey"] })`

Output: Student-organized guide with before-class checklist and four activity sections, each with Jasmine-specific modifications, ready-to-use materials, and IEP goal tags.

### Scenario 2 — Multi-student

> "Generate a modification guide for both Jasmine Bailey and Marcus Chen for the What is Community lesson."

Tool call: `generate_modifications({ lesson_id: "what-is-community", student_ids: ["jasmine-bailey", "marcus-chen"] })`

Output: Activity-organized guide with per-student modifications at each activity, plus a synthesis section identifying overlapping needs, divergent needs, and interaction effects.

### Additional tool demonstrations

```
get_student_profile({ student_id: "marcus-chen" })
  → Tier 1 Key Profile Summary

get_iep_goal({ student_id: "jasmine-bailey", goal_number: 3 })
  → Tier 2 ELA goal record

get_accommodations({ student_id: "jasmine-bailey" })
  → Tier 3 accommodation list

ingest_iep({ pdf_path: "/abs/path/assets/iep.pdf", student_id: "jasmine-bailey" })
  → Re-ingests source PDF, overwrites data/ieps/jasmine_bailey_iep.md
```

---

## Environment

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key |
| `ANTHROPIC_MODEL` | No | `claude-opus-4-7` | Override model for dev/cost control |

---

## Tests

```bash
npm test                                              # unit tests — no API key needed
ANTHROPIC_MODEL=claude-haiku-4-5-20251001 npm test    # includes smoke tests
```

Unit tests cover `file_reader.ts` and `markdown_parser.ts` without requiring an API key. Smoke tests exercise `generate_modifications` against the live API using a faster model for cost efficiency.

---

## Out of Scope (v0.1)

| Capability | Status | V1 direction |
|---|---|---|
| `get_period_roster` tool and `roster.json` | Deferred | Resolves student/lesson IDs from a period ID; enables batch generation across all periods |
| REST layer and web UI | Deferred | REST wrapper exposes MCP tool functions as HTTP endpoints for a web client; see trywaypointlearning.com |
| Teacher authentication, multi-user access | Deferred | Single-user local service for MVP |
| Progress reporting, outcome logging | Deferred | IEP goal tags on every recommendation are the data foundation; reporting is a v1+ layer on top |
| Student-facing materials generation | Deferred | Teacher-facing only for MVP |

---

## Submission README

The submission README is committed as `README.md` in the repository root. It covers: what this is, how to run, demo scenarios, architecture decisions, example outputs, re-ingestion instructions, and out-of-scope items. The architecture decisions section is written for a technical reader evaluating the design — it explains the four-tier chunking strategy, the verbatim preservation contract, the single/multi output flip, and the MCP-first service layer design in terms of the tradeoffs made and the v1 path forward.
