import { readIEP } from '../utils/file_reader.js';
import { extractGoal } from '../utils/markdown_parser.js';
export function getIepGoal(studentId, goalNumber) {
    const markdown = readIEP(studentId);
    const goal = extractGoal(markdown, goalNumber);
    if (!goal)
        throw new Error(`Goal ${goalNumber} not found in IEP for student "${studentId}"`);
    return goal;
}
//# sourceMappingURL=get_iep_goal.js.map