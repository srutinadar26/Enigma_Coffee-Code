const fs = require('fs');
const path = require('path');

/**
 * Extracts raw text from an uploaded document.
 * - PDFs: parsed with pdf-parse (text layer). Falls back gracefully if scanned/no text layer.
 * - Images (jpg/png/webp): OCR'd with Tesseract.js.
 * - Plain text: read directly.
 */
async function extractText(filePath, mimeType) {
  try {
    if (mimeType === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      if (data.text && data.text.trim().length > 20) {
        return { text: data.text, method: 'pdf-text-layer' };
      }
      return { text: '', method: 'pdf-no-text-layer' };
    }

    if (/^image\//.test(mimeType)) {
      const Tesseract = require('tesseract.js');
      const { data } = await Tesseract.recognize(filePath, 'eng');
      return { text: data.text || '', method: 'tesseract-ocr' };
    }

    if (mimeType === 'text/plain') {
      return { text: fs.readFileSync(filePath, 'utf8'), method: 'plain-text' };
    }

    return { text: '', method: 'unsupported-mime-type' };
  } catch (err) {
    console.error('OCR extraction error:', err.message);
    return { text: '', method: 'error', error: err.message };
  }
}

module.exports = { extractText };
