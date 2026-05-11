import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getStudentProfile } from './tools/get_student_profile.js';
import { getIepGoal } from './tools/get_iep_goal.js';
import { getAccommodations } from './tools/get_accommodations.js';
import { getLesson } from './tools/get_lesson.js';
import { generateModifications } from './tools/generate_modifications.js';
import { ingestIep } from './tools/ingest_iep.js';
import { ingestLesson } from './tools/ingest_lesson.js';
import { registerIepResources } from './resources/iep_resource.js';
import { registerLessonResources } from './resources/lesson_resource.js';
const server = new McpServer({
    name: 'waypoint-learning',
    version: '0.1.0',
});
// --- Tools ---
server.tool('get_student_profile', 'Returns the Tier 1 Key Profile Summary for a student — the primary context for modification generation.', { student_id: z.string().describe('Student ID, e.g. "jasmine-bailey" or "marcus-chen"') }, async ({ student_id }) => {
    try {
        return { content: [{ type: 'text', text: getStudentProfile(student_id) }] };
    }
    catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
    }
});
server.tool('get_iep_goal', 'Returns a specific IEP goal record (Tier 2) for a student. Use when tagging a recommendation to a specific goal or citing exact target language.', {
    student_id: z.string().describe('Student ID'),
    goal_number: z.number().int().min(1).describe('Goal number (1, 2, 3, …)'),
}, async ({ student_id, goal_number }) => {
    try {
        return { content: [{ type: 'text', text: getIepGoal(student_id, goal_number) }] };
    }
    catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
    }
});
server.tool('get_accommodations', 'Returns the flat accommodation list (Tier 3) for a student. Useful for generating the before-class checklist.', { student_id: z.string().describe('Student ID') }, async ({ student_id }) => {
    try {
        return { content: [{ type: 'text', text: getAccommodations(student_id) }] };
    }
    catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
    }
});
server.tool('get_lesson', 'Returns the full processed lesson document with verbatim activity text, question labels (DRQ-, MC-, SR-, DISC-), and vocabulary.', { lesson_id: z.string().describe('Lesson ID, e.g. "what-is-community"') }, async ({ lesson_id }) => {
    try {
        return { content: [{ type: 'text', text: getLesson(lesson_id) }] };
    }
    catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
    }
});
server.tool('generate_modifications', 'Generates a complete IEP-grounded modification guide for a lesson and one or more students. ' +
    'For a single student, output is student-organized by activity. ' +
    'For multiple students, output is activity-organized with per-student modifications and a synthesis section. ' +
    'Each recommendation includes a citation tag tracing it to a specific IEP source.', {
    lesson_id: z.string().describe('Lesson ID, e.g. "what-is-community"'),
    student_ids: z.array(z.string()).min(1).describe('One or more student IDs, e.g. ["jasmine-bailey"] or ["jasmine-bailey", "marcus-chen"]'),
}, async ({ lesson_id, student_ids }) => {
    try {
        const guide = await generateModifications(lesson_id, student_ids);
        return { content: [{ type: 'text', text: guide }] };
    }
    catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
    }
});
server.tool('ingest_iep', 'Ingests an IEP PDF, extracts structured markdown using claude-opus-4-7, and writes it to data/ieps/. ' +
    'The output includes all IEP sections plus a Key Profile Summary (MCP Reference) at the end — the primary context unit for generate_modifications. ' +
    'pdf_path must be absolute (Claude Desktop launches with an arbitrary working directory).', {
    pdf_path: z.string().describe('Absolute path to the IEP PDF file, e.g. "/Users/you/waypoint-challenge/assets/iep.pdf"'),
    student_id: z.string().describe('Student ID that determines the output filename, e.g. "jasmine-bailey" → data/ieps/jasmine_bailey_iep.md'),
}, async ({ pdf_path, student_id }) => {
    try {
        const result = await ingestIep(pdf_path, student_id);
        return { content: [{ type: 'text', text: result }] };
    }
    catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
    }
});
server.tool('ingest_lesson', 'Ingests a lesson plan PDF, extracts structured markdown using claude-opus-4-7, and writes it to data/lessons/. ' +
    'Verbatim question text is preserved with normalized IDs (DRQ-1A, MC-3, SR-1, DISC-2). ' +
    'pdf_path must be absolute (Claude Desktop launches with an arbitrary working directory).', {
    pdf_path: z.string().describe('Absolute path to the lesson PDF file, e.g. "/Users/you/waypoint-challenge/assets/lesson.pdf"'),
    lesson_id: z.string().describe('Lesson ID that determines the output filename, e.g. "what-is-community" → data/lessons/what_is_community_lesson.md'),
}, async ({ pdf_path, lesson_id }) => {
    try {
        const result = await ingestLesson(pdf_path, lesson_id);
        return { content: [{ type: 'text', text: result }] };
    }
    catch (err) {
        return { content: [{ type: 'text', text: String(err) }], isError: true };
    }
});
// --- Resources ---
registerIepResources(server);
registerLessonResources(server);
// --- Start ---
const transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=index.js.map