import { readIEP } from '../utils/file_reader.js';
import { extractKeyProfileSummary } from '../utils/markdown_parser.js';
export function getStudentProfile(studentId) {
    const markdown = readIEP(studentId);
    const summary = extractKeyProfileSummary(markdown);
    if (!summary)
        throw new Error(`No Key Profile Summary found in IEP for student "${studentId}"`);
    return summary;
}
//# sourceMappingURL=get_student_profile.js.map