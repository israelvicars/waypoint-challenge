import { readIEP } from '../utils/file_reader.js';
import { extractAccommodations } from '../utils/markdown_parser.js';

export function getAccommodations(studentId: string): string {
  const markdown = readIEP(studentId);
  const acc = extractAccommodations(markdown);
  if (!acc) throw new Error(`No Accommodations section found in IEP for student "${studentId}"`);
  return acc;
}
