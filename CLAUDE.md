# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A TypeScript MCP server that helps teachers generate IEP-grounded lesson modification guides. Submission for the Waypoint Learning contest — deadline **Monday, May 11 @ 12pm ET**. Submit to isaac@waypoint-learning.org with a public GitHub repo link.

The implementation is complete (7 tools) and all tests pass. Reference docs (do not modify): `waypoint_mvp_spec.md`, `waypoint_prd.md`, `waypoint_ux.md`.

## Commands

```bash
npm run build                                        # tsc → dist/
npm test                                             # unit tests (no API key needed)
ANTHROPIC_MODEL=claude-haiku-4-5-20251001 npm test  # includes smoke tests
npm run scenario:1                                   # CLI: Jasmine Bailey only
npm run scenario:2                                   # CLI: Jasmine Bailey + Marcus Chen
WRITE_EXAMPLES=1 npm run scenario:1                  # write output to examples/
npm run ingest:iep                                   # ingest assets/iep.pdf → data/ieps/jasmine_bailey_iep.md
npm run ingest:lesson                                # ingest assets/lesson.pdf → data/lessons/what_is_community_lesson.md
npm run run:all                                      # end-to-end: ingest → read tools → generate → examples/run_all_report.md
```

Model is configurable via `ANTHROPIC_MODEL` env var (default: `claude-opus-4-7`). Use `claude-haiku-4-5-20251001` for dev to keep costs low.

To connect to Claude Desktop, add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "waypoint-learning": {
      "command": "node",
      "args": ["/absolute/path/to/waypoint-challenge/dist/index.js"],
      "env": { "ANTHROPIC_API_KEY": "your_key_here" }
    }
  }
}
```

The server uses `StdioServerTransport` — it does not bind to a port. **All logs go to `console.error`**; never use `console.log` (stdout is the MCP protocol channel).

## Architecture

### IEP Chunking (the key design decision)

IEPs are pre-chunked into four tiers. `generate_modifications` loads Tier 1 + the full lesson by default:

| Tier | Content | When used |
|---|---|---|
| 1 | Key Profile Summary (~300 words, pre-computed at ingest) | Default — always loaded |
| 2 | Individual goal records | On-demand via `get_iep_goal` |
| 3 | Flat accommodation list | On-demand via `get_accommodations` |
| 4 | Full IEP document | Fallback only |

### `generate_modifications` (core tool)

- Loads lesson + KPS per student → calls `anthropic.messages.create` (MODEL, `max_tokens: 8000`)
- Output: **single student → organized by activity**; **multiple students → organized by activity with a synthesis section at the end**
- System prompt requires citation tags on every recommendation: `[Goal N]`, `[Accom: key]`, `[Present Level: domain]`
- Post-generation soft check: warns to stderr if no DRQ-/MC-/SR-/DISC- label appears in output

### Parser gotchas (real data differs from spec)

- KPS header is `## Key Profile Summary (MCP Reference)` — `extractKeyProfileSummary` matches by prefix
- Goal headers use U+2014 em-dash: `### Goal N — [Area]` — regex uses `[—-]` to handle both
- Marcus's IEP structure differs from Jasmine's — parser uses header-walk, not structural assumptions

### PDF ingestion tools

`ingest_iep` and `ingest_lesson` accept a PDF path + ID, call `claude-opus-4-7` with the document natively (no pdf-parse stage), and write structured markdown to `data/`. The `pdf_path` must be absolute — Claude Desktop launches with arbitrary cwd. ID format: `jasmine-bailey` → `jasmine_bailey_iep.md` (hyphens → underscores + suffix). Hand-curated originals are archived in `examples/originals/`.

### Path resolution

Both `file_reader.ts` and `pdf_ingest.ts` resolve `data/` via `import.meta.url` (not `process.cwd()`). Claude Desktop launches with arbitrary cwd; `process.cwd()` silently fails. Supports `WAYPOINT_DATA_DIR` env override.

### Student/Lesson ID mapping

| ID | File |
|---|---|
| `jasmine-bailey` | `data/ieps/jasmine_bailey_iep.md` |
| `marcus-chen` | `data/ieps/marcus_chen_iep.md` |
| `what-is-community` | `data/lessons/what_is_community_lesson.md` |

## Demo Scenarios

**Scenario 1:** `generate_modifications({ lesson_id: "what-is-community", student_ids: ["jasmine-bailey"] })`  
**Scenario 2:** `generate_modifications({ lesson_id: "what-is-community", student_ids: ["jasmine-bailey", "marcus-chen"] })`

Example outputs committed in `examples/`.
