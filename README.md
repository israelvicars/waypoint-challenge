# Waypoint Learning — MCP Server Submission

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

## What's Out of Scope (v0.1)

- **Automated PDF ingestion** — IEP and lesson files are pre-processed into structured markdown. A v1 pipeline using `pdf-parse` → LLM extraction pass handles this automatically.
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
