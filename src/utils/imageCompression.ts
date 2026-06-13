/**
 * Image Compression Utility
 * Compresses images to reduce file size and improve PDF performance
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  outputFormat?: 'image/jpeg' | 'image/png' | 'image/webp';
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 400,
  maxHeight: 400,
  quality: 0.7,
  outputFormat: 'image/jpeg',
};

/**
 * Compress an image file to reduce size
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise<string> - Base64 encoded compressed image
 */
export const compressImage = (
  file: File,
  options: CompressionOptions = {}
): Promise<string> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          let { width, height } = img;

          // Calculate new dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > opts.maxWidth) {
              height = (height * opts.maxWidth) / width;
              width = opts.maxWidth;
            }
          } else {
            if (height > opts.maxHeight) {
              width = (width * opts.maxHeight) / height;
              height = opts.maxHeight;
            }
          }

          // Set canvas dimensions
          canvas.width = Math.round(width);
          canvas.height = Math.round(height);

          // Draw image on canvas with high quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Convert to base64 with compression
          const compressed = canvas.toDataURL(opts.outputFormat, opts.quality);

          resolve(compressed);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Get the size of a base64 string in bytes
 * @param base64 - Base64 encoded string
 * @returns number - Size in bytes
 */
export const getBase64Size = (base64: string): number => {
  // Remove data URL prefix if present
  const base64Data = base64.split(',')[1] || base64;
  
  // Calculate size: each base64 character represents 6 bits
  // Actual bytes = (length * 3) / 4
  const padding = (base64Data.match(/=/g) || []).length;
  return (base64Data.length * 3) / 4 - padding;
};

/**
 * Format bytes to human readable string
 * @param bytes - Number of bytes
 * @returns string - Formatted string (e.g., "1.5 MB")
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Validate image file size
 * @param file - File to validate
 * @param maxSizeBytes - Maximum allowed size in bytes
 * @returns boolean - True if valid
 */
export const validateImageSize = (file: File, maxSizeBytes: number): boolean => {
  return file.size <= maxSizeBytes;
};

/**
 * Validate image dimensions
 * @param file - Image file to validate
 * @param maxWidth - Maximum width
 * @param maxHeight - Maximum height
 * @returns Promise<boolean> - True if valid
 */
export const validateImageDimensions = (
  file: File,
  maxWidth: number,
  maxHeight: number
): Promise<boolean> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        resolve(img.width <= maxWidth && img.height <= maxHeight);
      };

      img.onerror = () => resolve(false);
      img.src = e.target?.result as string;
    };

    reader.onerror = () => resolve(false);
    reader.readAsDataURL(file);
  });
};
