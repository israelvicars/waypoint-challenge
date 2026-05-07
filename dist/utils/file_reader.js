import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
function dataDir() {
    if (process.env.WAYPOINT_DATA_DIR)
        return process.env.WAYPOINT_DATA_DIR;
    const thisFile = fileURLToPath(import.meta.url);
    return path.resolve(path.dirname(thisFile), '../../data');
}
const STUDENT_FILES = {
    'jasmine-bailey': 'ieps/jasmine_bailey_iep.md',
    'marcus-chen': 'ieps/marcus_chen_iep.md',
};
const LESSON_FILES = {
    'what-is-community': 'lessons/what_is_community_lesson.md',
};
export function readIEP(studentId) {
    const rel = STUDENT_FILES[studentId];
    if (!rel)
        throw new Error(`Unknown student ID: "${studentId}". Known IDs: ${Object.keys(STUDENT_FILES).join(', ')}`);
    return readFileSync(path.join(dataDir(), rel), 'utf-8');
}
export function readLesson(lessonId) {
    const rel = LESSON_FILES[lessonId];
    if (!rel)
        throw new Error(`Unknown lesson ID: "${lessonId}". Known IDs: ${Object.keys(LESSON_FILES).join(', ')}`);
    return readFileSync(path.join(dataDir(), rel), 'utf-8');
}
//# sourceMappingURL=file_reader.js.map