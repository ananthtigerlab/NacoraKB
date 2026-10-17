import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';

// Extract plain text from an uploaded file so it can be indexed and fed into Claude for interpretation.
// Falls back to empty string when the type isn't supported yet — the source row still exists, the BA can
// add notes on it directly.

export async function extractText(filePath: string, mimeType: string | undefined): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (mimeType?.startsWith('text/') || ['.md', '.txt', '.csv', '.json', '.log'].includes(ext)) {
      return (await fs.readFile(filePath, 'utf8')).slice(0, 200_000);
    }
    if (ext === '.pdf') {
      // pdf-parse is CommonJS.
      const { default: pdfParse } = await import('pdf-parse');
      const buf = await fs.readFile(filePath);
      const parsed = await pdfParse(buf);
      return parsed.text.slice(0, 200_000);
    }
    if (ext === '.docx') {
      const mammoth = await import('mammoth');
      const buf = await fs.readFile(filePath);
      const r = await mammoth.extractRawText({ buffer: buf });
      return r.value.slice(0, 200_000);
    }
    if (mimeType?.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      // OCR via tesseract.js — heavier, but critical for the "manager sent me a screenshot" flow (PRD §10.1).
      const Tesseract = (await import('tesseract.js')).default;
      const { data } = await Tesseract.recognize(filePath, 'eng');
      return data.text.slice(0, 200_000);
    }
  } catch (err) {
    console.warn('[extract] failed for', filePath, (err as Error).message);
  }
  return '';
}
