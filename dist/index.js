import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getStudentProfile } from './tools/get_student_profile.js';
import { getIepGoal } from './tools/get_iep_goal.js';
import { getAccommodations } from './tools/get_accommodations.js';
import { getLesson } from './tools/get_lesson.js';
import { generateModifications } from './tools/generate_modifications.js';
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
// --- Resources ---
registerIepResources(server);
registerLessonResources(server);
// --- Start ---
const transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=index.js.map