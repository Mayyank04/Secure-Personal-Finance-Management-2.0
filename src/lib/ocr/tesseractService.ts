
import { createWorker } from 'tesseract.js';
import { parseReceiptText, ParsedReceiptData } from './receiptParser';

export interface OcrProgressUpdate {
  status: string;
  progress: number;
}

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

        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;

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
