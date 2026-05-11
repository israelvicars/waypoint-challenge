import { ingestLessonPdf } from '../utils/pdf_ingest.js';
export async function ingestLesson(pdfPath, lessonId) {
    const { markdown, written_to } = await ingestLessonPdf(pdfPath, lessonId);
    return `Lesson ingested as "${lessonId}".\nWritten to: ${written_to}\n\n---\n\n${markdown}`;
}
//# sourceMappingURL=ingest_lesson.js.map