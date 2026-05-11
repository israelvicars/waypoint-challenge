# Waypoint Learning — MCP Server Submission

Waypoint closes the gap between what an IEP says and what a teacher can actually do with it tomorrow. The central insight driving the architecture is that the translation problem isn't an AI problem — it's a context problem: the right information, structured for reasoning, handed to the model at the right moment. The approach taken here pre-processes both the IEP and the lesson at ingestion time, extracting a Key Profile Summary that distills a 20+ page legal document into ~300 words of teacher-relevant signal, and preserving every lesson question verbatim so the model can generate scaffolds for the *actual* prompts a student will encounter — not generic strategies. The output is a modification guide organized by lesson activity, tagged to specific IEP goals and accommodations, with copy-paste-ready materials. A teacher with two IEP students in one period can generate a complete, classroom-ready guide in a single tool call.

---

## Supporting Documents

**[`waypoint_ux.md`](./waypoint_ux.md) — User Story Map**
Defines the teacher persona (Maya Torres, 7th grade ELA, 15–18 IEP students across five periods), the preparation journey, and the three design principles that constrain every architectural decision: organize around the lesson not the IEP, ready to use not ready to interpret, one operation covers the whole day. Start here to understand what the system is for and who it serves.

**[`waypoint_prd.md`](./waypoint_prd.md) — Product Requirements Document**
Covers the four system components (ingestion pipeline, data layer, MCP server, modification guide generator), the full functional and non-functional requirements, and the explicit v0.1 / v1 scope boundary. The PRD reflects the product as specified before implementation and documents the open questions resolved during the build. Read this to understand what was required, what was deferred, and why.

**[`waypoint_mvp_spec.md`](./waypoint_mvp_spec.md) — Technical Architecture & Implementation**
The implementation-level reference: tech stack, ingestion pipeline stages and extraction schemas, tool and resource definitions, IEP chunking strategy, and the full prompt design for `generate_modifications`. Includes the complete system prompt and user message format. This is the companion document to the code — read it alongside `src/tools/generate_modifications.ts`.

**[`waypoint_ingest.md`](./waypoint_ingest.md) — Ingestion Pipeline Deep Dive**
Explains the problem ingestion solves (why re-parsing at generation time doesn't scale), the four-tier chunking strategy, the design decision behind the Key Profile Summary, and the verbatim preservation contract for lesson questions. This document makes the case for why pre-processing is the pivotal architectural choice — not a convenience but a correctness requirement at classroom scale.

---

## Approach Overview

### I. The Problem Worth Solving
- ~10M U.S. students have IEPs — legally binding, 20+ page documents teachers are required to act on daily
- The bottleneck isn't knowing what a student needs; it's the translation gap between an IEP and *tomorrow's specific lesson*
- A teacher with 15–18 IEP students across five periods faces this gap every single day, with a 40-minute prep window
- The output that doesn't exist: a modification guide grounded in both documents, specific enough to use without editing

### II. Design Before Architecture
- Started with the teacher persona and the real constraint: she's not looking to learn about IEPs — she needs the intersection work done for her
- Three design principles that drove every technical decision:
  - Organize around the lesson, not the IEP
  - Ready to use, not ready to interpret
  - One operation covers the whole day (batch by default)
- Output format flip: single student → student-organized; multiple students → activity-organized with synthesis layer

### III. The Core Architecture Problem
- Naïve approach (pass full IEP + full lesson to Claude on every request) fails at classroom scale: slow, expensive, noisy context, and collapses when 15 students × 30 pages each hit the context window
- Two structural solutions:
  - **Four-tier IEP chunking** — pre-slice the IEP at ingestion time; Tier 1 (Key Profile Summary, ~300 words) is always loaded; Tiers 2–4 retrieved on demand
  - **Verbatim lesson preservation** — every question stem copied exactly and labeled by ID (DRQ-1A, MC-3, etc.); these IDs become the contract between the lesson document and every modification the system generates

### IV. The Ingestion Pipeline (Stretch Goal — Feature Branch)
- Separates ingestion from generation: each document processed once, stored as structured markdown, never re-parsed at generation time
- IEPs: LLM extraction pass produces standard section schema + a **Key Profile Summary generated at ingestion** (the synthesis is paid once, not on every teacher request)
- Lessons: verbatim preservation of all question text is a hard requirement, not a preference — enforced in the extraction prompt, verified by checking for question IDs in output
- Pre-processed files for both IEPs and the lesson are committed and ready to use without re-ingestion

### V. The MCP Server
- Five tools exposed:
  - `generate_modifications` — core tool; accepts lesson ID + array of student IDs; returns full modification guide
  - `get_student_profile` / `get_iep_goal` / `get_accommodations` — tiered IEP retrieval (Tiers 1–3)
  - `get_lesson` — full lesson retrieval
  - `ingest_iep` / `ingest_lesson` — PDF → structured markdown (stretch goal, feature branch)
- IEP data also exposed as typed MCP resources (`iep://{student_id}/summary`, `goals/{n}`, etc.)
- Core logic lives in `src/utils/` and `src/tools/` as pure functions — the MCP layer is a thin wrapper, not the service itself; a REST layer can consume the same functions directly

### VI. Prompt Design
- System prompt establishes the role (special education instructional coach) and three hard requirements: every modification traced to a specific IEP source with citation tags; every modification references actual lesson content by question ID; all ready-to-use materials derived from verbatim lesson questions
- Output structure enforced: before-class checklist → per-activity sections in lesson order → synthesis (multi-student only)

### VII. Demo Scenarios
- **Scenario 1** — Single student: Jasmine Bailey × What is Community → student-organized guide with before-class checklist, four activity sections, IEP goal tags on every recommendation
- **Scenario 2** — Multi-student: Jasmine Bailey + Marcus Chen × same lesson → activity-organized guide with per-student modifications at each activity + synthesis section (overlapping needs, divergent needs, interaction effects)
- Additional tool demonstrations: profile lookup, goal retrieval, accommodation list, live PDF ingestion

### VIII. What's Deferred and Why
- `get_period_roster` + `roster.json` (v1) — enables true batch generation across a full day's periods; student IDs passed directly for MVP
- REST wrapper + web UI (v1) — MCP tool signatures defined here *are* the API contract; a web client is one additional layer
- Progress reporting + outcome logging (v1+) — IEP goal tags on every recommendation are already the data foundation; reporting is a layer on top

---

## What This Is

Almost 10 million U.S. students have IEPs — legally binding documents that tell teachers exactly what each student needs. But translating a 20+ page IEP into tomorrow's specific lesson plan takes hours of prep that most teachers don't have. A teacher with 15 IEP students across five periods faces this translation gap every single day.

This MCP server closes that gap. Given a lesson and one or more student IEPs, it produces a **modification guide**: a structured, ready-to-use document that tells the teacher exactly what to do differently for each IEP student at each step of the lesson — before-class prep checklist, per-activity modifications with copy-paste-ready scaffolds, behavioral watch-fors grounded in documented IEP patterns, IEP goal citation tags on every recommendation, and (for multi-student classes) a synthesis section identifying overlapping needs, divergent needs, and instructional opportunities created by the specific student combination.

---

## How to Run

**Prerequisites:** Node.js 18+, an Anthropic API key.

```bash
git clone <your-repo>
cd waypoint-challenge
npm install
npm run build
```

**Required environment variable:**
```bash
export ANTHROPIC_API_KEY=your_key_here
```

**Optional — override the model (default: `claude-opus-4-7`):**
```bash
export ANTHROPIC_MODEL=claude-haiku-4-5-20251001   # fast/cheap for dev
# unset for Opus (production quality)
```

### Claude Desktop configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### CLI (without Claude Desktop)

```bash
npm run scenario:1   # Jasmine Bailey only
npm run scenario:2   # Jasmine Bailey + Marcus Chen
```

Add `WRITE_EXAMPLES=1` to write output to `examples/`.

```bash
npm run ingest:iep      # ingest assets/iep.pdf → data/ieps/jasmine_bailey_iep.md
npm run ingest:lesson   # ingest assets/lesson.pdf → data/lessons/what_is_community_lesson.md
```

### Tests

```bash
npm test                                          # unit tests (no API key needed)
ANTHROPIC_MODEL=claude-haiku-4-5-20251001 npm test   # includes smoke tests
```

---

## Demo Scenarios

Once the server is connected to Claude Desktop, invoke it with natural language:

**Scenario 1 — Single student:**
> "Generate a modification guide for Jasmine Bailey for the What is Community lesson."

Expected tool call: `generate_modifications({ lesson_id: "what-is-community", student_ids: ["jasmine-bailey"] })`

**Scenario 2 — Multi-student:**
> "Generate a modification guide for both Jasmine Bailey and Marcus Chen for the What is Community lesson."

Expected tool call: `generate_modifications({ lesson_id: "what-is-community", student_ids: ["jasmine-bailey", "marcus-chen"] })`

**Additional tool scenarios (show range):**
> "What are Marcus Chen's IEP accommodations?"  
> → `get_accommodations({ student_id: "marcus-chen" })`

> "Show me Goal 3 from Jasmine Bailey's IEP."  
> → `get_iep_goal({ student_id: "jasmine-bailey", goal_number: 3 })`

> "Show me the lesson plan for What is Community."  
> → `get_lesson({ lesson_id: "what-is-community" })`

**Scenario 3 — PDF ingestion:**
> "Ingest the IEP at /absolute/path/to/waypoint-challenge/assets/iep.pdf for student jasmine-bailey."  
> → `ingest_iep({ pdf_path: "/absolute/path/...", student_id: "jasmine-bailey" })`

> "Ingest the lesson at /absolute/path/to/waypoint-challenge/assets/lesson.pdf as what-is-community."  
> → `ingest_lesson({ pdf_path: "/absolute/path/...", lesson_id: "what-is-community" })`

Note: `pdf_path` must be an **absolute path**. Claude Desktop launches with an arbitrary working directory, so relative paths silently fail.

---

## Architecture Decisions

### 1. Four-tier IEP chunking — pre-computed, not re-summarized at runtime

An IEP is a 20+ page legal document. Loading the full document on every generation call is slow, expensive, and puts synthesis work inside the critical path where it compounds with every additional student.

Instead, the IEP is chunked into four retrieval tiers:

| Tier | Content | Size | When used |
|---|---|---|---|
| 1 — Key Profile Summary | Pre-computed synthesis: disability classification, present levels by domain, active goals, accommodations, behavioral patterns | ~300 words | Default — always loaded |
| 2 — Goal records | One section per IEP goal with baseline, target, criteria, measurement method | ~150 words each | On-demand when citing a specific goal |
| 3 — Accommodation list | Flat bulleted list of all active accommodations | ~100 words | On-demand for before-class checklist |
| 4 — Full document | Complete processed IEP markdown | ~2,500 words | Fallback only |

The Key Profile Summary (Tier 1) is the pivotal design decision. It is generated *at ingestion time*, not at generation time. This means the synthesis work — "what does this teacher need to know about this student to modify a lesson?" — is done once when the IEP is ingested and stored as a section of the processed markdown file. At runtime, `generate_modifications` loads the KPS for each student (a string slice, not a re-summarization), combines it with the full lesson, and hands both to the model.

For a class with two IEP students, the generation context is: lesson (~2,600 words) + 2 × KPS (~600 words total) = ~3,200 words of signal. The full IEPs (2 × 2,800 words = 5,600 words) never enter the context window unless a specific section is needed. This keeps context lean as roster size grows toward the production case (15–18 students per teacher).

### 2. Verbatim preservation as an ingestion-to-generation contract

The quality of a modification guide depends on the model receiving the *actual* lesson questions, not a summary. A scaffolded version of DRQ-1A is only meaningful if DRQ-1A is present exactly as written — the model cannot generate a relevant scaffold for a question it hasn't seen.

The lesson ingestion pipeline enforces verbatim preservation of all question text, labeling every question with a normalized ID (`DRQ-1A`, `MC-3`, `SR-1`, `DISC-2`). These IDs serve as the contract: the generation prompt instructs the model to reference them by ID, and the output is soft-checked for their presence as a quality signal.

The system prompt includes this requirement explicitly: *"Every modification must reference actual lesson content — use the specific activity names, question numbers (DRQ-1A, MC-3, SR-1, DISC-2, etc.), and verbatim prompt text from the lesson."* Citation tags (`[Goal N]`, `[Accom: key phrase]`, `[Present Level: domain]`) are required on every recommendation, making IEP grounding visible and auditable.

### 3. Single → student-organized; multi → activity-organized with synthesis

The output format flips based on roster size.

- **One student:** output is organized by student → activities. The teacher is thinking about one person and moving through the lesson chronologically.
- **Multiple students:** output is organized by activity → students. The teacher is standing in front of a class, moving through the lesson. At each step they need to know "what do I do differently for each student *right now*" — not switch mental frames between IEPs.

For multi-student guides, a synthesis section is appended:
- **Overlapping needs** (one prep task covers multiple students) — reduces teacher prep load
- **Divergent needs** (different scaffolds required at the same activity) — flags where the teacher must make two different moves simultaneously
- **Interaction effects** (instructional opportunities created by the specific student combination) — the insight no single-student guide can produce

This flip is determined by `student_ids.length` — single-student is a special case of multi, not a separate code path.

### 4. MCP-first service layer, REST-ready by design

The MCP server exposes five tools. The core logic lives in `src/utils/` (pure functions: file reader, markdown parser) and `src/tools/` (thin wrappers that call those functions and format the result). The MCP tool handlers are ~5 lines each.

This separation means a future REST wrapper or web UI can import the same `generateModifications()`, `extractKeyProfileSummary()`, etc. functions directly — the MCP layer is just one client of the service, not the service itself. The tool signatures defined here serve as the API contract for v1.

---

## Example Outputs

See the `examples/` directory for committed Opus-generated outputs:

- [`examples/scenario_1_jasmine.md`](examples/scenario_1_jasmine.md) — Jasmine Bailey, student-organized guide
- [`examples/scenario_2_jasmine_marcus.md`](examples/scenario_2_jasmine_marcus.md) — Jasmine Bailey + Marcus Chen, activity-organized guide with synthesis

---

## Re-ingesting Source Data

The `ingest_iep` and `ingest_lesson` tools convert source PDFs to structured markdown using `claude-opus-4-7` natively — no `pdf-parse` stage needed. The model receives the PDF directly (text + visual layout) and extracts the structured markdown in a single API call.

```
ingest_iep({ pdf_path: "/abs/path/iep.pdf", student_id: "jasmine-bailey" })
  → writes data/ieps/jasmine_bailey_iep.md
  → generate_modifications reads from the same path automatically
```

The hand-curated originals are archived in `examples/originals/` as a baseline for quality comparison.

---

## What's Out of Scope (v0.1)
- **`get_period_roster` tool and `roster.json`** — deferred to v1. For MVP, student IDs are passed directly to `generate_modifications`. A v1 roster tool resolves them from a period ID.
- **Web UI and REST layer** — the MCP server defines the API contract. A v1 REST wrapper wraps the same tool functions as HTTP endpoints for consumption by a web interface.
- **Teacher authentication, multi-user access** — single-user local service for MVP.
- **Progress reporting, outcome logging, student-facing materials** — v1+ roadmap.

---

## Project Structure

```
src/
  index.ts                    # MCP server entry, StdioServerTransport
  config.ts                   # MODEL from ANTHROPIC_MODEL env var
  tools/
    get_student_profile.ts    # Tier 1 KPS retrieval
    get_iep_goal.ts           # Tier 2 goal record retrieval
    get_accommodations.ts     # Tier 3 accommodation list retrieval
    get_lesson.ts             # Lesson document retrieval
    generate_modifications.ts # Core generation tool (Anthropic API call)
  resources/
    iep_resource.ts           # iep://{student_id}/{summary|goals/N|accommodations|full}
    lesson_resource.ts        # lesson://{lesson_id}
  utils/
    file_reader.ts            # readIEP(), readLesson() — path resolved via import.meta.url
    markdown_parser.ts        # Section extraction by ## / ### header
data/
  ieps/                       # Pre-processed IEP markdown files
  lessons/                    # Pre-processed lesson markdown files
examples/                     # Committed Opus-generated example outputs
scripts/
  run_scenario.ts             # CLI harness for dev iteration and example generation
tests/
  file_reader.test.ts
  markdown_parser.test.ts
  generate_modifications.smoke.test.ts
```
