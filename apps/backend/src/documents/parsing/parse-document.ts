import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import type { DocumentFormat } from '../document.entity';

// PDF table cells often extract with no separator between columns (e.g. a date
// glued directly to the next field: "...2026C421407260884780Перевод..."). That
// digit-to-uppercase-letter boundary is never legitimate mid-word in practice
// (unlike letter-to-digit, which shows up inside real tokens like "C421...").
function unglueColumns(text: string): string {
  return text.replace(/([0-9])([A-ZА-ЯЁ])/g, '$1 $2');
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function parseDocument(
  format: DocumentFormat,
  buffer: Buffer,
): Promise<string> {
  switch (format) {
    case 'pdf': {
      const result = await pdfParse(buffer);
      return unglueColumns(result.text);
    }
    case 'docx': {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case 'html':
      return stripHtml(buffer.toString('utf-8'));
    case 'markdown':
      return buffer.toString('utf-8');
  }
}
