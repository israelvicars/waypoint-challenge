# Waypoint Learning — Product Requirements Document

**Version:** 0.2 (draft)
**Status:** In review
**Author:** Waypoint Learning
**Last updated:** 2026-05-07

---

## 1. Product Overview

Waypoint is an AI-powered platform for special education teachers, positioned as the operating system for IEP management. The platform roadmap spans three phases: Instruction & Progress Monitoring (launching Fall 2026), End-to-End IEP Workflow (2027), and a district-wide student platform beyond that.

This document covers the **modification guide capability** — part of the Instruction & Progress Monitoring phase — which delivers curriculum-aligned, IEP-grounded differentiation recommendations to teachers at the lesson level. It is the entry point into the product: the highest-frequency teacher need, the clearest time savings, and the strongest proof of the platform's core value proposition.

Given a lesson plan and one or more student IEPs, the system produces a structured, ready-to-use modification guide that tells the teacher exactly what to do differently at each step of the lesson — for every IEP student in the period. The success bar is operational: a teacher generates modification guides for all IEP students across all periods in under ten minutes of active prep, and receives output specific enough to use in class without editing.

---

## 2. Users and Context

See the [User Story Map](./waypoint_ux.md) for the full teacher persona, journey, and design principles. In brief:

- **Primary user:** General education teachers with one or more IEP students per class period
- **Context of use:** Evening or free-period prep, typically 24–48 hours before the lesson
- **Scale:** A single teacher may have 15–18 IEP students across five or six periods per day, each with a different IEP and a different lesson

The system must serve this scale efficiently. Single-student generation is a supported mode but not the primary design target.

---

## 3. System Architecture

The system is a **service layer** — a set of MCP tool endpoints that expose IEP and lesson data and invoke Claude-powered generation. It is not a standalone application. A future web UI (currently in design at trywaypointlearning.com) will consume this service layer via a client that wraps MCP tool calls. For MVP evaluation, the service is invoked directly via MCP integration.

This separation is intentional. The MCP server defines the API contract. The client — whether Claude Desktop, a web UI, or a future mobile interface — is an implementation detail that sits above this layer and is out of scope for this version.

The system consists of four components.

### 3.1 Document Ingestion Pipeline

**What it does:** Converts source IEP and lesson documents (PDF) into structured markdown files suitable for LLM consumption. Runs once per document at ingest time and stores the result. Does not run at generation time.

**Why it exists:** Raw PDF IEPs are dense, inconsistently formatted, multi-page legal documents. Lesson documents vary significantly across curriculum publishers. Re-parsing either document type at generation time is slow, expensive, and lossy. Pre-processing absorbs all document variance once, producing a stable, structured representation the MCP server reads efficiently regardless of source format.

#### Pipeline Stages

```
PDF
 │
 ▼
Stage 1 — Raw text extraction
 │  Tool: pdf-parse (Node) or pdfplumber (Python)
 │  Preserves reading order, strips layout formatting
 │  Output: flat text with paragraph structure intact
 │
 ▼
Stage 2 — LLM extraction pass
 │  Model: claude-opus-4-5
 │  Schema-specific prompt differs for IEP vs lesson documents
 │  IEP prompt: extract into standard section schema
 │  Lesson prompt: normalize activity structure; preserve verbatim question text
 │  Output: structured markdown with consistent headers
 │
 ▼
Structured markdown
    Stored in data/ieps/ or data/lessons/
    Read by MCP server at generation time
```

Both document types produce structured markdown. The MCP server has no knowledge of the source format — manually curated markdown and pipeline output are interchangeable. This is the correct abstraction boundary.

#### IEP Schema

IEPs issued under IDEA follow a federally mandated structure with state-specific but predictable section ordering. The Massachusetts form used by both students in this system is consistent enough for reliable schema-based extraction. Variance is in writing style and specificity, not document structure.

The LLM extraction pass targets these sections in order:

| Section | Extraction target |
|---|---|
| Student profile | Name, DOB, grade, disability classification, language, AT requirement |
| Present levels — Academics | Current performance, strengths, disability impact per subject |
| Present levels — Behavioral | Current performance, strengths, disability impact |
| Accommodations | All accommodation entries across all columns; normalized to flat list |
| Measurable annual goals | One record per goal: area, baseline, annual target, criteria, method, schedule, responsible party, short-term objectives |
| Service delivery | Type, provider, location, frequency per goal |
| Assessment accommodations | All designated features and test presentation accommodations |
| Key Profile Summary | LLM-generated synthesis (see below) |

#### Lesson Schema

Lesson documents vary significantly across curriculum publishers (CommonLit, EL Education, Illustrative Math, Zearn, district-developed, teacher-created). The extraction prompt must normalize structure across this variance while preserving one constraint absolutely: **all question and prompt text must be copied verbatim from the source document, not paraphrased or summarized.** The quality of modification guide output depends directly on the generator receiving the actual question text — a scaffolded version of DRQ-1A is only meaningful if DRQ-1A is present exactly as written.

The LLM extraction pass targets these sections:

| Section | Extraction target |
|---|---|
| Metadata | Title, author, grade, unit, lesson number, curriculum publisher, skill standards |
| Skill and knowledge focus | Verbatim from source |
| Lesson structure | Activity sequence: name, duration, modality per activity |
| Vocabulary | All terms with pronunciation, part of speech, and definition |
| Text passage | Full verbatim text with paragraph numbers preserved |
| During reading questions | Verbatim question text; activity type (Think & Share / Write / Turn & Talk); paragraph scope; support flag for optional questions |
| Independent practice — MC | Verbatim question stem and all answer choices; skill standard tag |
| Independent practice — Short response | Verbatim prompt; any self-checklist items |
| Discussion questions | Verbatim question text; bold vocabulary terms flagged |

The pipeline also emits an **ingestion manifest** — a comment block at the top of each processed file recording the source filename, processing date, extraction model, curriculum schema detected, normalization decisions made, verbatim preservation scope, and any flags for downstream use. This manifest is not consumed by the MCP server but provides an audit trail for human review and pipeline debugging.

#### Key Profile Summary

The IEP ingestion pipeline generates a Key Profile Summary as its terminal step. This is an LLM-synthesized digest of the most instructionally relevant facts: disability classification, present levels by domain with grade-level comparisons, active IEP goals with baselines and targets, accommodations in effect, and documented behavioral patterns including avoidance signals and reliable engagement strategies.

The Key Profile Summary is embedded as the final named section (`## Key Profile Summary`) in each processed IEP markdown file. It serves two roles: it is the output of ingestion, and it is the default runtime context unit for generation (Tier 1 in the chunking strategy). This design ensures the synthesis work is done once at ingest time, not redundantly on every generation call.

In production, the Key Profile Summary is generated by the LLM extraction pass. For MVP, it is pre-generated and embedded in each IEP markdown file, serving as the reference format for what the production pass should produce.

**MVP implementation:** Ingestion is manual for MVP. Both IEP files and the lesson file have been pre-processed into structured markdown and are stored in `data/ieps/` and `data/lessons/`. The existing files demonstrate the intended pipeline output format. Automated PDF ingestion is a v1 capability.

### 3.2 Data Layer

**What it does:** Stores and serves processed IEP and lesson documents. Maintains the mapping between students, class periods, and teachers.

**Why it exists:** The MCP server needs fast, targeted access to specific slices of student and lesson data. The data layer holds both the full processed documents and the Key Profile Summaries as separately retrievable units per student.

**MVP implementation:** Local filesystem with a structured directory:

```
data/
  ieps/
    jasmine_bailey_iep.md
    marcus_chen_iep.md
  lessons/
    what_is_community_lesson.md
  roster.json
```

`roster.json` maps period IDs to student IDs and lesson IDs, serving as a static stand-in for a future SIS integration.

**Core entities:**

| Entity | Description |
|---|---|
| `Student` | Identity record linking a student to their processed IEP file |
| `IEP` | Processed IEP markdown for a student, versioned by IEP date |
| `Lesson` | Processed lesson markdown including activity sequence and verbatim question text |
| `Period` | A class period belonging to a teacher, with an ordered student roster |
| `Roster` | The subset of students in a period who have active IEPs |
| `ModificationGuide` | The generated output for a given lesson and one or more students |

### 3.3 MCP Server

**What it does:** Exposes student and lesson data to Claude as structured resources and tools. Handles generation requests for modification guides. This is the primary API surface of the system.

**Why it exists:** Claude has no persistent access to IEP or lesson documents. The MCP server is the mechanism by which that data enters Claude's context in a controlled, structured way — providing the right information at the right level of granularity for each stage of the generation task.

#### IEP Chunking Strategy

The IEP is not treated as a single document to be loaded wholesale into context. It is chunked into four functional retrieval tiers, each serving a distinct reasoning task:

**Tier 1 — Key Profile Summary** (default context unit)
The primary input for any generation request. Contains present levels by domain, active IEP goals with baselines and targets, accommodations in effect, and documented behavioral patterns in compact structured form. This is what enters context first for every modification generation call — the pre-computed answer to "what do I need to know about this student to modify a lesson." Typically 200–400 words per student, compact enough to include for multiple students simultaneously without exhausting the context window before lesson content arrives.

**Tier 2 — Goal records** (on-demand)
Individual goal sections, retrievable by goal number. Contains goal area, baseline, annual target, criteria, measurement method, and short-term objectives. Retrieved when the generator needs to tag a recommendation to a specific goal or cite exact target language in the guide output.

**Tier 3 — Accommodation list** (on-demand)
Flat enumeration of all accommodations in effect, separate from narrative prose. Retrieved when the generator needs to verify accommodation coverage or enumerate items for the before-class checklist.

**Tier 4 — Full IEP document** (fallback)
The complete processed markdown, available but not used by default. Retrieved only when a specific section is needed verbatim — behavioral pattern language, IEP dates, or service delivery details.

This tiered structure keeps generation context lean. Most generation requests touch only Tier 1 and the lesson document. The full IEP (typically 2,000–3,000 words) is a fallback, not the default — including it by default for multiple students simultaneously would consume substantial context before any lesson content arrived.

The Key Profile Summary is both the terminal output of the ingestion pipeline and the primary runtime context unit. This is an explicit design decision: preprocessing pre-computes the synthesis that would otherwise happen redundantly on every generation call.

#### Exposed Resources

| Resource | Description |
|---|---|
| `iep://{student_id}/summary` | Tier 1 — Key Profile Summary |
| `iep://{student_id}/goals/{goal_number}` | Tier 2 — Individual goal record |
| `iep://{student_id}/accommodations` | Tier 3 — Flat accommodation list |
| `iep://{student_id}/full` | Tier 4 — Full processed IEP markdown |
| `lesson://{lesson_id}` | Full processed lesson with activity sequence |
| `roster://{period_id}` | IEP student list for a period |

#### Exposed Tools

| Tool | Signature | Description |
|---|---|---|
| `get_student_profile` | `(student_id: string)` | Returns Tier 1 Key Profile Summary |
| `get_iep_goal` | `(student_id: string, goal_number: int)` | Returns Tier 2 goal record |
| `get_accommodations` | `(student_id: string)` | Returns Tier 3 accommodation list |
| `get_lesson` | `(lesson_id: string)` | Returns full processed lesson |
| `generate_modifications` | `(lesson_id: string, student_ids: string[])` | Core generation tool. Accepts one or more student IDs. Returns activity-organized output for multiple students, student-organized output for one. |

> **V1:** `get_period_roster(period_id)` is deferred to v1. It will accept a period ID, resolve student and lesson IDs from `roster.json`, and return them for use in a subsequent `generate_modifications` call. For MVP, student IDs are passed directly by the caller.

### 3.4 Modification Guide Generator

**What it does:** The Claude-powered reasoning layer that takes lesson and student data — surfaced via MCP tools — and produces the modification guide. This is not a separate service; it is Claude operating with MCP context.

**Input requirements:**
- Tier 1 Key Profile Summary for each student in the roster
- Full lesson with verbatim activity descriptions and question text
- Tier 2 goal records for any IEP goal touched by the lesson (retrieved on demand)

**Output requirements:**
- Before-class preparation checklist
- One section per lesson activity, in lesson order, containing:
  - Specific modifications per student
  - Ready-to-use materials derived from actual lesson content (scaffolded questions, sentence frames, prompts)
  - Behavioral watch-fors grounded in documented IEP patterns
  - IEP goal tag for each recommendation
- Synthesis section (multi-student only): overlapping needs, divergent needs, interaction effects

---

## 4. Functional Requirements

### 4.1 Document Ingestion

- **FR-1:** The system must accept PDF IEP documents and produce structured markdown following the standard IEP section schema.
- **FR-2:** The ingestion pipeline must generate a Key Profile Summary for each processed IEP containing: disability classification, present levels by domain, active IEP goals with baselines and targets, accommodations in effect, and documented behavioral patterns.
- **FR-3:** The system must accept PDF lesson documents and produce structured markdown capturing: lesson metadata, learning objectives, skill standards, and a sequenced activity breakdown with verbatim question text and timing.
- **FR-4:** Ingestion must run once per document. Processed files must be stored and retrievable without re-parsing the source PDF.

### 4.2 Data Layer

- **FR-6:** The system must store the full processed IEP and the Key Profile Summary as separately retrievable units per student.
- **FR-7:** IEP documents must be versioned by IEP date.

> **V1:** FR-5 (period/student mapping via roster) is deferred to v1 alongside the `get_period_roster` tool and `roster.json` config.

### 4.3 MCP Server

- **FR-8:** The MCP server must expose IEP data across four retrieval tiers: Key Profile Summary (default), individual goal records (on-demand), accommodation list (on-demand), and full document (fallback). Each tier must be independently retrievable.
- **FR-9:** The `generate_modifications` tool must accept an array of student IDs, supporting single and multi-student generation in a single call.
- **FR-10:** The `generate_modifications` tool must return activity-organized output when more than one student ID is provided, and student-organized output when exactly one is provided.
- **FR-11:** The MCP server must expose verbatim lesson question text to Claude during generation. Modifications must be derived from the actual lesson questions, not generalized from topic or skill standard alone.

### 4.4 Modification Guide Output

- **FR-12:** Every modification must be traceable to a specific IEP source — an accommodation, a present level observation, or a goal.
- **FR-13:** Every modification must be tagged with the IEP goal it supports, where applicable.
- **FR-14:** Ready-to-use materials must be derived from verbatim lesson content, not generated generically.
- **FR-15:** The guide must include a before-class preparation checklist distinct from in-lesson modifications.
- **FR-16:** Multi-student guides must include a synthesis section identifying overlapping needs, divergent needs, and instructional interaction effects.

### 4.5 Batch Generation

> **V1:** FR-17 (multi-period session generation) and FR-18 (automatic output organization by roster size) are deferred to v1 alongside `get_period_roster` and `roster.json`. For MVP, both demo scenarios invoke `generate_modifications` directly with explicit student IDs. Output organization (single vs. multi-student) is determined automatically by the length of the `student_ids` array.

---

## 5. Non-Functional Requirements

- **NFR-1:** IEP documents must be parsed at ingestion time and stored as structured markdown. They must not be re-parsed from PDF at generation time.
- **NFR-2:** The Key Profile Summary (Tier 1) must be the default context unit for modification generation. Tiers 2–4 are retrieved only when specifically required.
- **NFR-3:** Tool signatures must accept arrays of student IDs. Single-student generation is a special case of multi-student generation, not a separate code path.
- **NFR-4:** Processed IEP and lesson documents must be stored in a format readable by both the MCP server and a human reviewer. Markdown satisfies this requirement.
- **NFR-5:** The system must be demonstrable using the two pre-processed IEP files and the pre-processed lesson file as sole data inputs, without requiring a database or external service.
- **NFR-6:** The MCP server exposes a stable tool API. Client implementation — web UI, Claude Desktop, CLI — is decoupled from the service layer and not in scope for this version.

---

## 6. Out of Scope (v0.1)

The following are acknowledged as part of the broader product roadmap but explicitly excluded from this version:

- **Web UI and client implementation** — the MCP server defines the API contract; a web UI consuming it is a future build (see trywaypointlearning.com for product direction)
- **Teacher authentication and multi-user access** — the system operates as a single-user local service
- **Period/roster management and batch generation** — `get_period_roster`, `roster.json`, and multi-period session generation are v1 capabilities; for MVP, student IDs are passed directly to `generate_modifications`
- **Automated PDF ingestion pipeline** — lesson and IEP documents are pre-processed manually for MVP
- **Outcome logging** — teachers do not record modification performance after class
- **Progress reporting and IEP goal tracking** — quarterly reports and annual review prep are a v1+ capability
- **Student-facing materials generation** — the system produces teacher-facing guides only
- **Real-time in-class assistance** — the system is a prep tool; it does not operate during instruction

---

## 7. Assumptions

### MVP
| # | Decision |
|---|---|
| OQ-1 | Processed IEP and lesson documents stored on local filesystem in `data/ieps/` and `data/lessons/`. No database required. |
| OQ-2 | Lesson and IEP documents are manually pre-processed into markdown before the MCP server runs. Automated PDF ingestion is a v1 capability. |
| OQ-3 | The MCP protocol is the client interface for MVP. The service is invoked directly via MCP integration (e.g. Claude Desktop). No web UI or REST layer in scope. |
| OQ-4 | Period and roster management is not required for MVP. The two demo scenarios — single-student and multi-student modification guide generation — are invoked directly via tool calls with explicit student IDs. A lightweight `roster.json` config maps period IDs to student and lesson IDs for convenience but is not a required dependency. |
| OQ-5 | Key Profile Summaries are pre-generated and embedded in each IEP markdown file. This is the reference format for what the production LLM ingestion pass should produce. |

### V1
| # | Direction |
|---|---|
| OQ-3 | REST wrapper exposes MCP tools as HTTP endpoints for consumption by the web UI. Tool signatures defined in this PRD serve as the API contract. |
| OQ-4 | Period and roster data flows from a SIS integration into the data layer. Implementation depends on REST wrapper design and web UI choices; deferred until those are defined. |
