import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readLesson } from '../utils/file_reader.js';
export function registerLessonResources(server) {
    server.resource('lesson', new ResourceTemplate('lesson://{lesson_id}', { list: undefined }), { description: 'Full processed lesson document with verbatim activity text and question labels' }, async (uri, { lesson_id }) => ({
        contents: [{ uri: uri.href, text: readLesson(lesson_id), mimeType: 'text/markdown' }],
    }));
}
//# sourceMappingURL=lesson_resource.js.map