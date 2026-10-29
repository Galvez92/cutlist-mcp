import { cutListCsv, placementsCsv, CSV_MIME, CUTLIST_BASENAME, PLACEMENTS_BASENAME } from './engine/csv.js';
import { renderLayoutPdf } from '@engine';
import { PDF_MIME, PDF_BASENAME } from './engine/constants.js';

/** Marca de tiempo local YYYYMMDD-HHMM (para nombres de archivo). */
export function timeStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function exportFileName(base, extension, date = new Date()) {
  return `${base}-${timeStamp(date)}.${extension}`;
}

export function downloadBytes(filename, bytes, mime) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCutListCsv(layout) {
  downloadBytes(exportFileName(CUTLIST_BASENAME, 'csv'), cutListCsv(layout), CSV_MIME);
}

export function downloadPlacementsCsv(layout) {
  downloadBytes(exportFileName(PLACEMENTS_BASENAME, 'csv'), placementsCsv(layout), CSV_MIME);
}

export async function downloadPdf(layout) {
  const bytes = renderLayoutPdf(layout);
  downloadBytes(exportFileName(PDF_BASENAME, 'pdf'), bytes, PDF_MIME);
}
