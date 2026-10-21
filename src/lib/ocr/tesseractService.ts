/**
 * Client-Side Open-Source Tesseract OCR Service
 * 
 * 100% On-Device / Browser-Compatible OCR
 * - Zero external API keys
 * - Zero cost
 * - Zero cloud upload of receipt images (complete privacy)
 * - Uses WebAssembly + Web Workers via tesseract.js
 * - Includes offline Canvas image pre-processing (grayscale + contrast binarization)
 */

import { createWorker } from 'tesseract.js';
import { parseReceiptText, ParsedReceiptData } from './receiptParser';

export interface OcrProgressUpdate {
  status: string;
  progress: number; // 0 to 100
}

/**
 * Preprocesses an image via HTML5 Canvas to drastically enhance OCR character recognition:
 * - Rescales for ideal DPI (minimum 1200px width/height)
 * - Converts to high-contrast grayscale
 * - Applies contrast stretching and mild binarization to clean thermal receipt paper shadows
 */
export async function preprocessReceiptImage(imageSource: string | File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource));
          return;
        }

        // Compute optimal resolution
        let width = img.width;
        let height = img.height;
        const minDim = 1200;
        const maxDim = 2600;

        if (Math.min(width, height) < minDim) {
          const scale = minDim / Math.min(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        } else if (Math.max(width, height) > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;

        // Draw original
        ctx.drawImage(img, 0, 0, width, height);

        // Extract pixel data for contrast enhancement
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Grayscale + Contrast Stretch
        for (let i = 0; i < data.length; i += 4) {
          // Standard luminance formula
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // Contrast curve: push light grays to white, dark grays to black
          let enhanced = gray;
          if (gray > 165) {
            enhanced = Math.min(255, gray * 1.15);
          } else if (gray < 110) {
            enhanced = Math.max(0, gray * 0.85);
          }

          data[i] = enhanced;
          data[i + 1] = enhanced;
          data[i + 2] = enhanced;
        }

        ctx.putImageData(imgData, 0, 0);

        // Return processed image data URL
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (err) {
        console.warn('Canvas pre-processing warning, using raw image:', err);
        resolve(typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource));
      }
    };

    img.onerror = (err) => {
      reject(new Error('Failed to load receipt image for pre-processing.'));
    };

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      img.src = URL.createObjectURL(imageSource);
    }
  });
}

/**
 * Executes zero-cost client-side OCR on receipt image using Tesseract WebAssembly engine
 */
export async function scanReceiptWithTesseract(
  imageSource: string | File | Blob,
  preferredCurrency: string = 'INR',
  onProgress?: (update: OcrProgressUpdate) => void
): Promise<ParsedReceiptData> {
  onProgress?.({ status: 'Enhancing receipt contrast and sharpness...', progress: 10 });

  let processedImage: string;
  try {
    processedImage = await preprocessReceiptImage(imageSource);
  } catch {
    processedImage = typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);
  }

  onProgress?.({ status: 'Initializing local Tesseract OCR engine...', progress: 25 });

  let worker: any = null;
  try {
    worker = await createWorker('eng', 1, {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round(35 + (m.progress || 0) * 55);
          onProgress?.({
            status: `Recognizing receipt text (${Math.round((m.progress || 0) * 100)}%)...`,
            progress: pct,
          });
        } else if (m.status === 'loading tesseract core') {
          onProgress?.({ status: 'Loading WebAssembly OCR core...', progress: 28 });
        } else if (m.status === 'initializing tesseract') {
          onProgress?.({ status: 'Configuring language model...', progress: 32 });
        }
      },
    });

    onProgress?.({ status: 'Extracting characters and text lines...', progress: 50 });
    const ret = await worker.recognize(processedImage);
    const extractedText = ret?.data?.text || '';

    onProgress?.({ status: 'Applying deterministic receipt field parser...', progress: 95 });
    await worker.terminate();
    worker = null;

    const parsed = parseReceiptText(extractedText, preferredCurrency);
    onProgress?.({ status: 'Done! Reviewing extracted information...', progress: 100 });

    return parsed;
  } catch (err: any) {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // ignore
      }
    }
    console.error('Tesseract Web OCR Error:', err);
    throw new Error(err.message || 'Local OCR recognition encountered an issue.');
  }
}
