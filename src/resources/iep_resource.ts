import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readIEP } from '../utils/file_reader.js';
import {
  extractKeyProfileSummary,
  extractGoal,
  extractAccommodations,
  getFullDocument,
} from '../utils/markdown_parser.js';

export function registerIepResources(server: McpServer): void {
  // Tier 1 — Key Profile Summary
  server.resource(
    'iep-summary',
    new ResourceTemplate('iep://{student_id}/summary', { list: undefined }),
    { description: 'Tier 1: Key Profile Summary — the primary context unit for modification generation' },
    async (uri, { student_id }) => ({
      contents: [{ uri: uri.href, text: extractKeyProfileSummary(readIEP(student_id as string)), mimeType: 'text/markdown' }],
    })
  );

  // Tier 2 — Individual goal record
  server.resource(
    'iep-goal',
    new ResourceTemplate('iep://{student_id}/goals/{goal_number}', { list: undefined }),
    { description: 'Tier 2: Individual IEP goal record by number' },
    async (uri, { student_id, goal_number }) => ({
      contents: [{ uri: uri.href, text: extractGoal(readIEP(student_id as string), Number(goal_number)), mimeType: 'text/markdown' }],
    })
  );

  // Tier 3 — Accommodation list
  server.resource(
    'iep-accommodations',
    new ResourceTemplate('iep://{student_id}/accommodations', { list: undefined }),
    { description: 'Tier 3: Flat accommodation list' },
    async (uri, { student_id }) => ({
      contents: [{ uri: uri.href, text: extractAccommodations(readIEP(student_id as string)), mimeType: 'text/markdown' }],
    })
  );

  // Tier 4 — Full IEP document
  server.resource(
    'iep-full',
    new ResourceTemplate('iep://{student_id}/full', { list: undefined }),
    { description: 'Tier 4: Full processed IEP document (fallback)' },
    async (uri, { student_id }) => ({
      contents: [{ uri: uri.href, text: getFullDocument(readIEP(student_id as string)), mimeType: 'text/markdown' }],
    })
  );
}
