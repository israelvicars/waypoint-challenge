import { ingestIepPdf } from '../utils/pdf_ingest.js';
export async function ingestIep(pdfPath, studentId) {
    const { markdown, written_to } = await ingestIepPdf(pdfPath, studentId);
    return `IEP ingested for student "${studentId}".\nWritten to: ${written_to}\n\n---\n\n${markdown}`;
}
//# sourceMappingURL=ingest_iep.js.map