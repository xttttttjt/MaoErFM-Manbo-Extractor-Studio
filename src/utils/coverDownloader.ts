import { sanitizeFilename } from './formatter';

/**
 * Detect image format from binary magic bytes
 */
export function detectImageFormatFromBuffer(bytes: Uint8Array): { ext: string; mime: string } {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  // WEBP: 52 49 46 46 ... 57 45 42 50
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  // GIF: 47 49 46 38
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return { ext: 'gif', mime: 'image/gif' };
  }
  return { ext: 'jpg', mime: 'image/jpeg' };
}

/**
 * Convert any MissEvan cover image URL (mini, mosaic, or relative)
 * to its pristine full-resolution original HD cover URL
 */
export function getHighResCoverUrl(rawUrl?: string, coverImageKey?: string): string {
  if (rawUrl && typeof rawUrl === 'string') {
    let clean = rawUrl.trim();
    if (clean.startsWith('//')) {
      clean = `https:${clean}`;
    }
    // Handle relative path or hash key (e.g. "202105/05/738a921ec558b51d8fe57c15c3972518213615.jpg")
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = clean.startsWith('/')
        ? `https://static.maoercdn.com${clean}`
        : `https://static.maoercdn.com/covers/${clean}`;
    }
    // Convert thumbnail / mini URLs to original uncompressed covers
    if (clean.includes('/coversmini/')) {
      return clean.replace('/coversmini/', '/covers/');
    }
    if (clean.includes('/mosaic/')) {
      return clean.replace('/mosaic/', '/covers/');
    }
    return clean;
  }

  if (coverImageKey && typeof coverImageKey === 'string') {
    const cleanKey = coverImageKey.trim();
    if (cleanKey) {
      return `https://static.maoercdn.com/covers/${cleanKey}`;
    }
  }

  return '';
}

/**
 * Get preview thumbnail URL
 */
export function getCoverThumbnailUrl(rawUrl?: string, coverImageKey?: string): string {
  if (rawUrl && typeof rawUrl === 'string') {
    let clean = rawUrl.trim();
    if (clean.startsWith('//')) {
      clean = `https:${clean}`;
    }
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = clean.startsWith('/')
        ? `https://static.maoercdn.com${clean}`
        : `https://static.maoercdn.com/coversmini/${clean}`;
    }
    return clean;
  }
  if (coverImageKey && typeof coverImageKey === 'string') {
    return `https://static.maoercdn.com/coversmini/${coverImageKey.trim()}`;
  }
  return '';
}

/**
 * Generate a friendly filename for the downloaded cover image
 */
export function getCoverFilename(title: string, episodeName?: string, ext = 'jpg'): string {
  const cleanTitle = sanitizeFilename(title || 'MissEvan_Cover');
  const cleanEp = episodeName ? `_${sanitizeFilename(episodeName)}` : '';
  const cleanExt = ext.replace(/^\.+/, '');
  return `${cleanTitle}${cleanEp}_cover.${cleanExt}`;
}

/**
 * Fetch cover image binary along with its verified format and Blob
 */
export async function fetchCoverBlobWithMeta(
  imageUrl: string
): Promise<{ blob: Blob; ext: string; mime: string } | null> {
  if (!imageUrl) return null;
  const hdUrl = getHighResCoverUrl(imageUrl);
  if (!hdUrl) return null;

  // 1. Try server proxy endpoint
  try {
    const proxyUrl = `/api/missevan/cover/download?url=${encodeURIComponent(hdUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      // Ensure it is not an error string (JSON or HTML)
      if (bytes.length > 32 && bytes[0] !== 0x3c && bytes[0] !== 0x7b) {
        const { ext, mime } = detectImageFormatFromBuffer(bytes);
        const blob = new Blob([arrayBuffer], { type: mime });
        return { blob, ext, mime };
      }
    }
  } catch (err) {
    console.warn('Failed proxy cover fetch:', err);
  }

  // 2. Direct fallback to CDN URL
  try {
    const directRes = await fetch(hdUrl);
    if (directRes.ok) {
      const arrayBuffer = await directRes.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      if (bytes.length > 32 && bytes[0] !== 0x3c && bytes[0] !== 0x7b) {
        const { ext, mime } = detectImageFormatFromBuffer(bytes);
        const blob = new Blob([arrayBuffer], { type: mime });
        return { blob, ext, mime };
      }
    }
  } catch {
    // ignore
  }

  // 3. Fallback to thumbnail URL if HD URL was not found
  try {
    const thumbUrl = getCoverThumbnailUrl(imageUrl);
    if (thumbUrl && thumbUrl !== hdUrl) {
      const thumbRes = await fetch(`/api/missevan/cover/download?url=${encodeURIComponent(thumbUrl)}`);
      if (thumbRes.ok) {
        const arrayBuffer = await thumbRes.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        if (bytes.length > 32 && bytes[0] !== 0x3c && bytes[0] !== 0x7b) {
          const { ext, mime } = detectImageFormatFromBuffer(bytes);
          const blob = new Blob([arrayBuffer], { type: mime });
          return { blob, ext, mime };
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Fetch cover image binary as Blob (for inclusion in JSZip)
 */
export async function fetchCoverBlob(imageUrl: string): Promise<Blob | null> {
  const meta = await fetchCoverBlobWithMeta(imageUrl);
  return meta ? meta.blob : null;
}

/**
 * Direct browser download for a cover image with verified valid image binary,
 * proper format matching, and Object URL triggering.
 */
export async function downloadCoverImage(imageUrl: string, filename: string): Promise<boolean> {
  if (!imageUrl) return false;

  try {
    const meta = await fetchCoverBlobWithMeta(imageUrl);
    if (meta && meta.blob) {
      // Correct filename extension based on actual image format
      let finalName = filename;
      const extRegex = /\.(jpe?g|png|webp|gif|bmp)$/i;
      if (extRegex.test(finalName)) {
        finalName = finalName.replace(extRegex, `.${meta.ext}`);
      } else {
        finalName = `${finalName}.${meta.ext}`;
      }

      const objectUrl = URL.createObjectURL(meta.blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = finalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
      return true;
    }
  } catch (err) {
    console.error('Error during client-side blob download, falling back:', err);
  }

  // Fallback to server route if client blob fetch was blocked
  const hdUrl = getHighResCoverUrl(imageUrl);
  const downloadApiUrl = `/api/missevan/cover/download?url=${encodeURIComponent(hdUrl)}&filename=${encodeURIComponent(filename)}`;
  const link = document.createElement('a');
  link.href = downloadApiUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}
