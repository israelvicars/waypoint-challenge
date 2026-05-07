import { readLesson } from '../utils/file_reader.js';

export function getLesson(lessonId: string): string {
  return readLesson(lessonId);
}
