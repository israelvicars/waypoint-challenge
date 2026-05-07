# Waypoint Learning — MVP Implementation Spec

**For:** Claude Code
**Version:** 0.1
**Primary reference:** This document
**Secondary references:** `waypoint_prd.md`, `waypoint_ux.md`, `jasmine_bailey_iep.md`, `marcus_chen_iep.md`

---

## Overview

Build a TypeScript MCP server that gives Claude the context it needs to generate lesson-specific modification guides for teachers with IEP students. The server exposes student IEP data and lesson content as structured resources and tools. The core output is a modification guide: a structured, ready-to-use document organized by lesson activity that tells the teacher exactly what to do differently for each IEP student in the period.

The MVP demonstrates two scenarios:
1. **Single-student:** Generate a modification guide for Jasmine Bailey on the "What is Community?" lesson
2. **Multi-student:** Generate a modification guide for both Jasmine Bailey and Marcus Chen on the same lesson

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

No database. No external services beyond the Anthropic API. The server must run from a fresh clone with only `npm install` and a valid `ANTHROPIC_API_KEY` environment variable.

---

## Ingestion Pipeline

The ingestion pipeline converts source PDFs into the structured markdown files the MCP server reads. It runs once per document — not at generation time. For MVP, all three documents have been pre-processed manually and are ready to use. The pipeline description here serves as the reference for a v1 automated implementation.

### Pipeline stages

```
PDF → [Stage 1: raw text extraction] → [Stage 2: LLM extraction pass] → structured markdown
```

**Stage 1 — Raw text extraction**
Use `pdf-parse` (Node) or `pdfplumber` (Python) to extract flat text from the PDF, preserving reading order and paragraph structure while stripping layout formatting.

**Stage 2 — LLM extraction pass**
Call `claude-opus-4-5` with a schema-specific prompt. The prompt differs for IEP vs lesson documents. Output is structured markdown written to `data/ieps/` or `data/lessons/`.

### IEP extraction prompt (schema)

```
You are processing an IEP document into structured markdown for a special education platform.

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

After extracting all sections, generate a ## Key Profile Summary containing:
- Disability classification and primary impact statement
- Present levels by domain with grade-level comparisons (e.g. "Reading: Grade 3, 4 years below grade level")
- All active IEP goals with baseline and annual target
- All accommodations in effect as a flat bulleted list
- Behavioral patterns: documented avoidance signals and reliable engagement strategies

The Key Profile Summary is the primary context unit for AI generation. Write it to be consumed directly by an LLM — concise, structured, no administrative language.

IEP text follows:
{raw_text}
```

### Lesson extraction prompt (schema)

```
You are processing a curriculum lesson document into structured markdown for a special education platform.

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
(source credit verbatim from source)

Add an ingestion manifest as an HTML comment block at the top of the file recording:
source filename, processing date, extraction model, curriculum schema detected,
normalization decisions, verbatim preservation scope, and any flags.

Lesson text follows:
{raw_text}
```

### Pre-processed files (MVP)

All three files are already created and available:

| File | Status |
|---|---|
| `data/ieps/jasmine_bailey_iep.md` | ✓ Ready |
| `data/ieps/marcus_chen_iep.md` | ✓ Ready |
| `data/lessons/what_is_community_lesson.md` | ✓ Ready |

The lesson markdown demonstrates the pipeline output format including the ingestion manifest comment block, normalized activity structure, verbatim text and question preservation, vocabulary table, and inline glossary entries.

---



```
waypoint-challenge/
├── data/
│   ├── ieps/
│   │   ├── jasmine_bailey_iep.md
│   │   └── marcus_chen_iep.md
│   └── lessons/
│       └── what_is_community_lesson.md
├── src/
│   ├── index.ts                  # MCP server entry point
│   ├── tools/
│   │   ├── get_student_profile.ts
│   │   ├── get_iep_goal.ts
│   │   ├── get_accommodations.ts
│   │   ├── get_lesson.ts
│   │   ├── get_period_roster.ts
│   │   └── generate_modifications.ts
│   ├── resources/
│   │   ├── iep_resource.ts
│   │   └── lesson_resource.ts
│   └── utils/
│       ├── file_reader.ts        # Filesystem access
│       └── markdown_parser.ts   # Section extraction from IEP/lesson markdown
├── package.json
├── tsconfig.json
└── README.md                    # Submission README
```

---

## Data Files

### IEP Files

The two IEP markdown files are already created (`jasmine_bailey_iep.md`, `marcus_chen_iep.md`). Each has the following sections, extractable by header:

- `## Key Profile Summary` — Tier 1 context unit; the default input for generation
- `### Goal N — [Area]` — Tier 2; individual goal records (e.g. `Goal 1 — Counseling`)
- `## Accommodations and Modifications` — Tier 3; flat accommodation list
- Full file — Tier 4 fallback

The `## Key Profile Summary` section in each file is the pre-generated synthesis block. It is both the ingestion pipeline output and the primary runtime context for generation.

### Lesson File

`what_is_community_lesson.md` is pre-created in `data/lessons/`. It was produced following the ingestion pipeline described above and includes:

- An ingestion manifest comment block at the top (source file, processing date, model, normalization decisions, verbatim preservation scope)
- Metadata table, skill focus, knowledge focus, teacher notes
- Lesson structure table (4 activities with timing and modalities)
- Vocabulary table with pronunciation and inline glossary for all footnoted terms
- Full verbatim text passage (paragraphs 1–11 with paragraph numbers preserved)
- During reading questions labeled `DRQ-[section][letter]` with activity type and `[SUPPORT]` flags for optional questions
- Independent practice: 4 MC questions with verbatim stems and all answer choices, 1 short response prompt verbatim with self-checklist
- Student-led discussion: 3 questions verbatim

Do not modify this file. It is the reference output for the ingestion pipeline and the ground truth for generation.

### roster.json

```json
{
  "periods": [
    {
      "id": "period-1",
      "name": "Period 1 — 7th Grade ELA",
      "description": "Single-student demo: Jasmine Bailey only",
      "lesson_id": "what-is-community",
      "iep_students": ["jasmine-bailey"]
    },
    {
      "id": "period-2",
      "name": "Period 2 — 7th Grade ELA",
      "description": "Multi-student demo: Jasmine Bailey and Marcus Chen",
      "lesson_id": "what-is-community",
      "iep_students": ["jasmine-bailey", "marcus-chen"]
    }
  ]
}
```

### ID-to-filename mapping

| Student ID | File |
|---|---|
| `jasmine-bailey` | `data/ieps/jasmine_bailey_iep.md` |
| `marcus-chen` | `data/ieps/marcus_chen_iep.md` |

| Lesson ID | File |
|---|---|
| `what-is-community` | `data/lessons/what_is_community_lesson.md` |

---

## MCP Server Entry Point (`src/index.ts`)

Initialize an MCP server with name `waypoint-learning` and version `0.1.0`. Register all tools and resources defined below. Use `StdioServerTransport`.

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'waypoint-learning', version: '0.1.0' },
  { capabilities: { tools: {}, resources: {} } }
);

// Register tools and resources here

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## Utility: `src/utils/file_reader.ts`

Provides typed filesystem access. All paths resolve relative to `process.cwd()/data`.

```typescript
export function readIEP(studentId: string): string
export function readLesson(lessonId: string): string
```

> **V1 note:** `readRoster()` and the `RosterConfig` type are deferred to v1 alongside the `get_period_roster` tool and `roster.json` config file.

---

## Utility: `src/utils/markdown_parser.ts`

Extracts named sections from IEP markdown files by header. All extraction is done by string matching on `##` and `###` headers — no external markdown library needed.

```typescript
// Returns the content of the "## Key Profile Summary" section
export function extractKeyProfileSummary(markdown: string): string

// Returns the content of a specific goal section, e.g. "### Goal 2 — Mathematics"
export function extractGoal(markdown: string, goalNumber: number): string

// Returns the content of the "## Accommodations and Modifications" section
export function extractAccommodations(markdown: string): string

// Returns the full markdown (Tier 4 fallback)
export function getFullDocument(markdown: string): string
```

Implementation note: find the target header line, then collect lines until the next header of the same or higher level (`##` or `#`).

---

## Tools

### `get_student_profile`

Returns the Tier 1 Key Profile Summary for a student.

**Input:**
```typescript
{ student_id: string }
```

**Output:** Markdown string — the `## Key Profile Summary` section from the student's IEP file.

**Error:** If the student ID is not found, return a descriptive error message.

---

### `get_iep_goal`

Returns a specific IEP goal record (Tier 2) for a student.

**Input:**
```typescript
{ student_id: string; goal_number: number }
```

**Output:** Markdown string — the matching `### Goal N` section including baseline, annual goal, criteria, method, schedule, responsible party, and short-term objectives.

---

### `get_accommodations`

Returns the flat accommodation list (Tier 3) for a student.

**Input:**
```typescript
{ student_id: string }
```

**Output:** Markdown string — the `## Accommodations and Modifications` section from the student's IEP file.

---

### `get_lesson`

Returns the full processed lesson document.

**Input:**
```typescript
{ lesson_id: string }
```

**Output:** Markdown string — the full `what_is_community_lesson.md` file.

---

### `generate_modifications` *(core tool)*

Generates a complete modification guide for a lesson and one or more students. This tool assembles context from the data layer and makes an Anthropic API call to produce the guide.

**Input:**
```typescript
{
  lesson_id: string;
  student_ids: string[];   // one or more student IDs
}
```

**Process:**
1. Load the full lesson document via `readLesson(lesson_id)`
2. For each student ID, load the Key Profile Summary via `extractKeyProfileSummary(readIEP(id))`
3. Determine output organization: `isMultiStudent = student_ids.length > 1`
4. Build system prompt and user message (see Prompt Design below)
5. Call `anthropic.messages.create` with `claude-opus-4-5`, `max_tokens: 4000`
6. Return the generated guide text

**Output:** Markdown string — the complete modification guide.

---

## Resources

Expose IEP tiers and lesson content as MCP resources so Claude can read them directly in addition to using tools.

| Resource URI | Description |
|---|---|
| `iep://{student_id}/summary` | Tier 1 — Key Profile Summary |
| `iep://{student_id}/goals/{goal_number}` | Tier 2 — Individual goal record |
| `iep://{student_id}/accommodations` | Tier 3 — Accommodation list |
| `iep://{student_id}/full` | Tier 4 — Full IEP document |
| `lesson://{lesson_id}` | Full lesson document |

> **V1 note:** `roster://{period_id}` is deferred to v1 alongside the `get_period_roster` tool.

---

## Prompt Design for `generate_modifications`

### System prompt

```
You are an expert special education instructional coach helping a teacher prepare for class.

Your task is to generate a modification guide for the lesson provided, tailored specifically to the IEP students listed. The guide must be grounded in both the lesson content and each student's IEP — not generic accommodation strategies.

REQUIREMENTS:
- Every modification must be traceable to a specific IEP source (accommodation, present level, or goal)
- Every modification must reference actual lesson content — use the specific activity names, question numbers, and verbatim prompt text from the lesson
- Ready-to-use materials (scaffolded questions, sentence frames, prompts) must be derived from the real lesson questions, not invented generically
- Tag each recommendation with the IEP goal it supports, where applicable

OUTPUT STRUCTURE:
1. Before-class checklist — materials to prepare, seating, partner assignments
2. One section per lesson activity, in lesson order:
   - Activity name and duration
   - Modifications per student (specific, actionable)
   - Ready-to-use material (the actual scaffolded version, sentence frame, or prompt — copy-paste ready)
   - Watch-for (behavioral signal from IEP + what to do when it appears)
3. [Multi-student only] Synthesis section:
   - Overlapping needs (one prep task serves multiple students)
   - Divergent needs (different scaffolds required at the same activity)
   - Interaction effects (instructional opportunities created by this student combination)

FORMAT: Clean markdown. Use headers for each activity. Use bold for student names in multi-student sections. The guide should be printable and usable in class without further editing.
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
{if multi: "The guide should be organized by lesson activity, with each activity listing modifications per student. Include a synthesis section at the end."}
```

---

## Demo Scenarios

These are the two scenarios the evaluator should be able to run. Include example invocations in the submission README.

### Scenario 1 — Single student

> "Generate a modification guide for Jasmine Bailey for the What is Community lesson."

Expected tool call: `generate_modifications({ lesson_id: "what-is-community", student_ids: ["jasmine-bailey"] })`

Expected output: Student-organized guide with before-class checklist, four activity sections, each with Jasmine-specific modifications and ready-to-use materials.

### Scenario 2 — Multi-student

> "Generate a modification guide for both Jasmine Bailey and Marcus Chen for the What is Community lesson."

Expected tool call: `generate_modifications({ lesson_id: "what-is-community", student_ids: ["jasmine-bailey", "marcus-chen"] })`

Expected output: Activity-organized guide with modifications per student at each activity, plus a synthesis section identifying overlapping needs, divergent needs, and interaction effects between the two students.

### Additional scenarios (show range in README or demo video)

- `get_student_profile({ student_id: "marcus-chen" })` — demonstrates Tier 1 retrieval
- `get_iep_goal({ student_id: "jasmine-bailey", goal_number: 3 })` — demonstrates Tier 2 on-demand retrieval
- `get_accommodations({ student_id: "jasmine-bailey" })` — demonstrates Tier 3 retrieval

---

## Environment

Required environment variable:
```
ANTHROPIC_API_KEY=your_key_here
```

The server reads this at startup. Generation calls use `claude-opus-4-5`.

---

## package.json (minimum)

```json
{
  "name": "waypoint-challenge",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## Claude Desktop Configuration

For local evaluation, add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "waypoint-learning": {
      "command": "node",
      "args": ["/absolute/path/to/waypoint-challenge/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "your_key_here"
      }
    }
  }
}
```

---

## Submission README Requirements

The submission README should cover, in order:

1. **What this is** — one paragraph connecting to the problem (IEP-to-lesson translation gap)
2. **How to run** — prerequisites, install, build, Claude Desktop config
3. **Demo scenarios** — the two primary scenarios with example prompts
4. **Architecture decisions** — explain the four-tier IEP chunking strategy, the service-layer design (MCP now, REST wrapper later), and the multi-student output organization flip. Write this for a semi-technical reader, not an engineering audience.
5. **Example outputs** — paste or link the actual generated guides for both scenarios
6. **What's out of scope** — reference the PRD out-of-scope list; briefly note the v1 direction (REST wrapper, web UI, automated ingestion)

The architecture decisions section is the highest-leverage part of the README for evaluation purposes. Write it last, after the implementation works, and make sure it reflects the actual decisions made during build — not just the ones planned here.
