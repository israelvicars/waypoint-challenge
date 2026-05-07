import Anthropic from '@anthropic-ai/sdk';
import { readIEP, readLesson } from '../utils/file_reader.js';
import { extractKeyProfileSummary } from '../utils/markdown_parser.js';
import { MODEL } from '../config.js';
const anthropic = new Anthropic();
const SYSTEM_PROMPT = `You are an expert special education instructional coach helping a teacher prepare for class.

Your task is to generate a modification guide for the lesson provided, tailored specifically to the IEP students listed. The guide must be grounded in both the lesson content and each student's IEP — not generic accommodation strategies.

REQUIREMENTS:
- Every modification must be traceable to a specific IEP source (accommodation, present level, or goal). End each recommendation with a citation tag: [Goal N] or [Accom: <key phrase>] or [Present Level: <domain>].
- Every modification must reference actual lesson content — use the specific activity names, question numbers (DRQ-1A, MC-3, SR-1, DISC-2, etc.), and verbatim prompt text from the lesson.
- Ready-to-use materials (scaffolded questions, sentence frames, prompts) must be derived from the real lesson questions, not invented generically.
- The guide must be printable and usable in class without further editing.

OUTPUT STRUCTURE:
1. **Before-class checklist** — materials to prepare, seating, partner assignments
2. One section per lesson activity, in lesson order:
   - Activity name and duration
   - Modifications per student (specific, actionable), each with a citation tag
   - Ready-to-use material (the actual scaffolded version, sentence frame, or prompt — copy-paste ready)
   - Watch-for (behavioral signal from IEP + what to do when it appears)
3. [Multi-student only] **## Synthesis** section — REQUIRED for multi-student guides, must appear at the end:
   - **Overlapping needs** (one prep task serves multiple students)
   - **Divergent needs** (different scaffolds required at the same activity)
   - **Interaction effects** (instructional opportunities created by this student combination)

FORMAT: Clean markdown. Use ## headers for each activity. Use **bold** for student names in multi-student sections.
IMPORTANT: For multi-student guides, always end with the ## Synthesis section even if the per-activity sections are long.`;
function buildUserMessage(lessonMarkdown, studentProfiles, isMulti) {
    const profileBlock = studentProfiles
        .map(({ name, profile }) => `## ${name}\n${profile}`)
        .join('\n\n---\n\n');
    const guideType = isMulti
        ? 'class period modification guide. Organize by lesson activity, listing modifications per student at each activity. Include a synthesis section at the end.'
        : 'single-student modification guide. Organize by lesson activity.';
    return `LESSON:\n${lessonMarkdown}\n\n---\n\nSTUDENT IEP PROFILES:\n${profileBlock}\n\n---\n\nGenerate a ${guideType}`;
}
const STUDENT_NAMES = {
    'jasmine-bailey': 'Jasmine Bailey',
    'marcus-chen': 'Marcus Chen',
};
function studentName(id) {
    return STUDENT_NAMES[id] ?? id;
}
// Soft check — log a warning if no lesson question labels appear in output
function warnIfUngrounded(guide) {
    if (!/DRQ-|MC-|SR-|DISC-/i.test(guide)) {
        console.error('[waypoint] Warning: generated guide may not reference lesson question IDs (DRQ-/MC-/SR-/DISC-)');
    }
}
export async function generateModifications(lessonId, studentIds) {
    const lessonMarkdown = readLesson(lessonId);
    const studentProfiles = studentIds.map((id) => ({
        name: studentName(id),
        profile: extractKeyProfileSummary(readIEP(id)),
    }));
    const isMulti = studentIds.length > 1;
    const userMessage = buildUserMessage(lessonMarkdown, studentProfiles, isMulti);
    const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
    });
    const guide = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
    warnIfUngrounded(guide);
    return guide;
}
//# sourceMappingURL=generate_modifications.js.map