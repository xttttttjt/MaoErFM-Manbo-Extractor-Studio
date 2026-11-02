export interface AudioTrackOption {
  id: number | string;
  bandwidth: number;
  bitrateKbps: number;
  label: string;
  size?: number | null;
  codecs?: string;
  streamUrl?: string;
}

export interface AudioFileInfo {
  success: boolean;
  isPaid?: boolean;
  price?: number;
  soundId: string;
  title: string;
  format: 'm4a' | 'mp3';
  bitrateKbps?: number;
  qualityLabel?: string;
  availableTracks?: AudioTrackOption[];
  contentLength?: number | null;
  downloadUrl?: string;
  error?: string;
}

const OLD_COOKIE_STORAGE_KEY = 'missevan_vip_cookie';
const COOKIE_STORAGE_KEY = 'missevan_custom_cookie';

export function normalizeClientCookie(raw?: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  if (!cleaned) return '';

  cleaned = cleaned
    .replace(/^cookie\s*:\s*/i, '')
    .replace(/^["']+|["']+$/g, '')
    .replace(/[\r\n\t]+/g, '; ')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();

  if (!cleaned) return '';
  if (!cleaned.includes('=')) {
    cleaned = `token=${cleaned}`;
  }
  return cleaned;
}

export function getSavedMissEvanCookie(): string {
  try {
    localStorage.removeItem(OLD_COOKIE_STORAGE_KEY);
    const stored = localStorage.getItem(COOKIE_STORAGE_KEY);
    if (stored && stored.trim()) {
      return normalizeClientCookie(stored);
    }
    return '';
  } catch {
    return '';
  }
}

export async function saveMissEvanCookie(cookie: string): Promise<string> {
  const normalized = normalizeClientCookie(cookie);
  try {
    if (normalized) {
      localStorage.setItem(COOKIE_STORAGE_KEY, normalized);
    } else {
      localStorage.removeItem(COOKIE_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }

  try {
    await fetch('/api/missevan/cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie: normalized }),
    });
  } catch {
    // ignore network errors
  }
  return normalized;
}

const MANBO_COOKIE_STORAGE_KEY = 'kilamanbo_vip_token';

export function normalizeClientManboCookie(raw?: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  if (!cleaned) return '';

  cleaned = cleaned
    .replace(/^cookie\s*:\s*/i, '')
    .replace(/^["']+|["']+$/g, '')
    .replace(/[\r\n\t]+/g, '; ')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();

  if (!cleaned) return '';
  if (!cleaned.includes('=')) {
    cleaned = `authToken=${cleaned}`;
  }
  return cleaned;
}

export function getSavedManboCookie(): string {
  try {
    const stored = localStorage.getItem(MANBO_COOKIE_STORAGE_KEY);
    return stored ? normalizeClientManboCookie(stored) : '';
  } catch {
    return '';
  }
}

export async function saveManboCookie(cookie: string): Promise<string> {
  const normalized = normalizeClientManboCookie(cookie);
  try {
    if (normalized) {
      localStorage.setItem(MANBO_COOKIE_STORAGE_KEY, normalized);
    } else {
      localStorage.removeItem(MANBO_COOKIE_STORAGE_KEY);
    }
  } catch {
    // ignore
  }

  try {
    await fetch('/api/manbo/cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie: normalized }),
    });
  } catch {
    // ignore
  }
  return normalized;
}

export const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB per chunk (well below Cloud Run 32 MB limit)

export interface ManboAudioFileInfo {
  success: boolean;
  title: string;
  format: string;
  contentLength?: number | null;
  url: string;
  error?: string;
}

export async function fetchManboAudioInfo(audioUrl: string, title?: string): Promise<ManboAudioFileInfo> {
  if (!audioUrl) {
    return { success: false, title: title || '', format: 'mp4', url: '', error: 'URL không hợp lệ' };
  }
  try {
    const res = await fetch(`/api/manbo/audio-info?url=${encodeURIComponent(audioUrl)}&title=${encodeURIComponent(title || 'manbo_audio')}`);
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, title: title || '', format: 'mp4', url: audioUrl, error: err.message };
  }
}

/**
 * Safely downloads KilaManbo decrypted audio stream via server proxy in 8MB chunks into a local Blob,
 * reporting real-time percentage progress, and triggers browser save without navigating iframe.
 */
export async function downloadKilaManboAudio(
  audioUrl: string,
  title: string,
  onProgress?: (percent: number, loaded: number, total: number) => void
): Promise<{ ok: boolean; error?: string }> {
  if (!audioUrl) {
    return {
      ok: false,
      error: 'Tập này chưa có luồng âm thanh hoặc là tập VIP cần cài đặt authToken.',
    };
  }

  try {
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100).trim() || 'kilamanbo_audio';
    const filename = `${safeTitle}.mp4`;

    // 1. Check file size
    const info = await fetchManboAudioInfo(audioUrl, safeTitle);
    const totalBytes = typeof info.contentLength === 'number' && info.contentLength > 0 ? info.contentLength : 0;

    // 2. If larger than 8MB, download in 8MB chunks for Cloud Run reliability
    if (totalBytes > CHUNK_SIZE) {
      const chunks: ArrayBuffer[] = [];
      let loadedBytes = 0;

      for (let start = 0; start < totalBytes; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE - 1, totalBytes - 1);
        const chunkUrl = `/api/manbo/audio-proxy?url=${encodeURIComponent(audioUrl)}&title=${encodeURIComponent(safeTitle)}&start=${start}&end=${end}`;
        
        const chunkRes = await fetch(chunkUrl);
        if (!chunkRes.ok && chunkRes.status !== 206) {
          throw new Error(`HTTP ${chunkRes.status}: Lỗi tải phần dữ liệu âm thanh từ máy chủ`);
        }

        const buf = await chunkRes.arrayBuffer();
        chunks.push(buf);
        loadedBytes += buf.byteLength;

        if (onProgress) {
          const pct = Math.min(100, Math.round((loadedBytes / totalBytes) * 100));
          onProgress(pct, loadedBytes, totalBytes);
        }
      }

      const blob = new Blob(chunks, { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return { ok: true };
    }

    // 3. For smaller files or unknown sizes, download stream directly
    const proxyUrl = `/api/manbo/audio-proxy?url=${encodeURIComponent(audioUrl)}&title=${encodeURIComponent(safeTitle)}&download=1`;
    const res = await fetch(proxyUrl);

    if (!res.ok && res.status !== 206) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}: Không thể kết nối CDN KilaManbo`);
    }

    const headerLen = parseInt(res.headers.get('content-length') || '0', 10);
    const effectiveTotal = totalBytes || headerLen;

    if (!res.body) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return { ok: true };
    }

    const reader = res.body.getReader();
    const parts: BlobPart[] = [];
    let loadedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        parts.push(value);
        loadedBytes += value.byteLength;
        if (onProgress && effectiveTotal > 0) {
          onProgress(
            Math.min(100, Math.round((loadedBytes / effectiveTotal) * 100)),
            loadedBytes,
            effectiveTotal
          );
        }
      }
    }

    const blob = new Blob(parts, { type: 'video/mp4' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    return { ok: true };
  } catch (err: any) {
    console.error('KilaManbo audio download error:', err);
    return { ok: false, error: err.message || 'Lỗi khi tải file âm thanh KilaManbo' };
  }
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export async function fetchAudioInfo(soundId: string, quality?: string): Promise<AudioFileInfo> {
  const cookie = getSavedMissEvanCookie();
  const headers: Record<string, string> = {};
  if (cookie) {
    headers['x-missevan-cookie'] = cookie;
  }

  const query = quality ? `?quality=${encodeURIComponent(quality)}` : '';
  const res = await fetch(`/api/missevan/audio/${soundId}/info${query}`, { headers });
  const data = await res.json().catch(() => ({
    success: false,
    soundId,
    title: `Sound ${soundId}`,
    format: 'm4a' as const,
    error: `Không thể lấy thông tin âm thanh (HTTP ${res.status})`,
  }));

  return data;
}

/**
 * Safely checks audio availability, downloads audio in 8MB chunks into a local Blob,
 * and triggers browser save without navigating the iframe.
 */
export async function safeTriggerAudioDownload(
  soundId: string,
  customName?: string,
  onProgress?: (percent: number, loaded: number, total: number) => void,
  quality?: string
): Promise<{ ok: boolean; isPaid?: boolean; error?: string }> {
  const info = await fetchAudioInfo(soundId, quality);
  if (!info.success || info.isPaid) {
    return {
      ok: false,
      isPaid: info.isPaid,
      error:
        info.error ||
        'Tập này là tập VIP trả phí trên MissEvan. Vui lòng nhập Cookie tài khoản đã mua để tải âm thanh.',
    };
  }

  try {
    const { blob, filename } = await fetchAudioBlob(soundId, onProgress, customName, info, quality);
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Không thể tải dữ liệu âm thanh từ máy chủ.',
    };
  }
}

/**
 * Legacy helper mapped to safeTriggerAudioDownload
 */
export function triggerAudioDownload(soundId: string, customName?: string, quality?: string) {
  void safeTriggerAudioDownload(soundId, customName, undefined, quality);
}

/**
 * Downloads audio as a Blob using 8MB chunked requests with real-time progress callback
 */
export async function fetchAudioBlob(
  soundId: string,
  onProgress?: (percent: number, loaded: number, total: number) => void,
  customName?: string,
  preloadedInfo?: AudioFileInfo,
  quality?: string
): Promise<{ blob: Blob; filename: string; format: string }> {
  const info = preloadedInfo || (await fetchAudioInfo(soundId, quality));
  if (!info.success || info.isPaid) {
    throw new Error(
      info.error || 'Tập này yêu cầu Cookie tài khoản VIP đã mua trên MissEvan.'
    );
  }

  const cookie = getSavedMissEvanCookie();
  const headers: Record<string, string> = {};
  if (cookie) {
    headers['x-missevan-cookie'] = cookie;
  }

  const baseName = customName || info.title || `MissEvan_${soundId}`;
  const safeTitle = baseName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100).trim();
  const ext = info.format === 'mp3' ? 'mp3' : 'm4a';
  const filename = `${safeTitle}.${ext}`;
  const contentType = ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4';

  let totalBytes = info.contentLength && info.contentLength > 0 ? info.contentLength : 0;
  const parts: BlobPart[] = [];
  let loadedBytes = 0;
  let currentStart = 0;

  while (true) {
    const currentEnd =
      totalBytes > 0
        ? Math.min(currentStart + CHUNK_SIZE - 1, totalBytes - 1)
        : currentStart + CHUNK_SIZE - 1;

    const qualityQuery = quality ? `&quality=${encodeURIComponent(quality)}` : '';
    const url = `/api/missevan/audio/${soundId}/download?start=${currentStart}&end=${currentEnd}${qualityQuery}`;
    const response = await fetch(url, { headers });

    if (!response.ok && response.status !== 206) {
      const errData = await response.json().catch(() => null);
      throw new Error(
        errData?.error || `Tải dữ liệu âm thanh thất bại (HTTP ${response.status})`
      );
    }

    // Parse total size from Content-Range (e.g. "bytes 0-8388607/47735781") if not already known
    const contentRange = response.headers.get('Content-Range');
    if (contentRange) {
      const match = contentRange.match(/\/(\d+)$/);
      if (match && match[1]) {
        const parsedTotal = parseInt(match[1], 10);
        if (parsedTotal > 0) totalBytes = parsedTotal;
      }
    }

    if (!response.body) {
      const chunkBlob = await response.blob();
      if (chunkBlob.size === 0) break;
      parts.push(chunkBlob);
      loadedBytes += chunkBlob.size;
      currentStart += chunkBlob.size;
      if (onProgress && totalBytes > 0) {
        onProgress(
          Math.min(100, Math.round((loadedBytes / totalBytes) * 100)),
          loadedBytes,
          totalBytes
        );
      }
      if (totalBytes > 0 && currentStart >= totalBytes) break;
      if (chunkBlob.size < CHUNK_SIZE) break;
      continue;
    }

    const reader = response.body.getReader();
    let chunkBytesRead = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        parts.push(value as BlobPart);
        loadedBytes += value.byteLength;
        chunkBytesRead += value.byteLength;
        if (onProgress && totalBytes > 0) {
          onProgress(
            Math.min(100, Math.round((loadedBytes / totalBytes) * 100)),
            loadedBytes,
            totalBytes
          );
        }
      }
    }

    if (chunkBytesRead === 0) break;
    currentStart += chunkBytesRead;

    if (totalBytes > 0 && currentStart >= totalBytes) break;
    if (response.status === 200 && !contentRange) break;
    if (chunkBytesRead < CHUNK_SIZE && totalBytes === 0) break;
  }

  const blob = new Blob(parts, { type: contentType });
  return { blob, filename, format: ext };
}

/**
 * Converts an AudioBuffer to an uncompressed 16-bit PCM WAV Blob using standard Web Audio API
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  const arrayBuffer = new ArrayBuffer(totalSize);
  const dataView = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      dataView.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  dataView.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  dataView.setUint32(16, 16, true);
  dataView.setUint16(20, format, true);
  dataView.setUint16(22, numChannels, true);
  dataView.setUint32(24, sampleRate, true);
  dataView.setUint32(28, sampleRate * blockAlign, true);
  dataView.setUint16(32, blockAlign, true);
  dataView.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  dataView.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      dataView.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([dataView], { type: 'audio/wav' });
}

/**
 * Converts an arbitrary audio Blob (e.g. M4A/MP4/MP3) to an uncompressed WAV Blob in browser
 */
export async function convertBlobToWav(sourceBlob: Blob): Promise<Blob> {
  const arrayBuffer = await sourceBlob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API is not supported in this browser environment.');
  }
  const audioCtx = new AudioContextClass();
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    return audioBufferToWav(audioBuffer);
  } finally {
    if (audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  }
}

export type ManboExportAudioFormat = 'm4a' | 'mp3' | 'wav';

/**
 * Downloads KilaManbo audio with specified format (m4a, mp3, wav)
 */
export async function downloadKilaManboAudioWithFormat(
  audioUrl: string,
  title: string,
  format: ManboExportAudioFormat = 'm4a',
  onProgress?: (percent: number, loaded: number, total: number) => void
): Promise<{ ok: boolean; error?: string }> {
  if (!audioUrl) {
    return { ok: false, error: 'URL âm thanh không được để trống.' };
  }

  try {
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100).trim() || 'kilamanbo_audio';
    const info = await fetchManboAudioInfo(audioUrl, safeTitle);
    const totalBytes = typeof info.contentLength === 'number' && info.contentLength > 0 ? info.contentLength : 0;

    let rawBlob: Blob;

    if (totalBytes > CHUNK_SIZE) {
      const chunks: ArrayBuffer[] = [];
      let loadedBytes = 0;

      for (let start = 0; start < totalBytes; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE - 1, totalBytes - 1);
        const chunkUrl = `/api/manbo/audio-proxy?url=${encodeURIComponent(audioUrl)}&title=${encodeURIComponent(safeTitle)}&start=${start}&end=${end}`;
        const chunkRes = await fetch(chunkUrl);
        if (!chunkRes.ok && chunkRes.status !== 206) {
          throw new Error(`HTTP ${chunkRes.status}: Lỗi tải phần dữ liệu âm thanh`);
        }
        const buf = await chunkRes.arrayBuffer();
        chunks.push(buf);
        loadedBytes += buf.byteLength;
        if (onProgress) {
          const pct = Math.min(format === 'wav' ? 85 : 100, Math.round((loadedBytes / totalBytes) * (format === 'wav' ? 85 : 100)));
          onProgress(pct, loadedBytes, totalBytes);
        }
      }
      rawBlob = new Blob(chunks, { type: 'audio/mp4' });
    } else {
      const proxyUrl = `/api/manbo/audio-proxy?url=${encodeURIComponent(audioUrl)}&title=${encodeURIComponent(safeTitle)}&download=1`;
      const res = await fetch(proxyUrl);
      if (!res.ok && res.status !== 206) {
        throw new Error(`HTTP ${res.status}: Không thể tải luồng âm thanh từ CDN`);
      }
      rawBlob = await res.blob();
    }

    let finalBlob: Blob = rawBlob;
    let finalExt = format;

    if (format === 'wav') {
      if (onProgress) onProgress(92, rawBlob.size, rawBlob.size);
      finalBlob = await convertBlobToWav(rawBlob);
      if (onProgress) onProgress(100, finalBlob.size, finalBlob.size);
    } else if (format === 'mp3') {
      finalBlob = new Blob([rawBlob], { type: 'audio/mpeg' });
      finalExt = 'mp3';
    } else {
      finalBlob = new Blob([rawBlob], { type: 'audio/mp4' });
      finalExt = 'm4a';
    }

    const downloadFilename = `${safeTitle}.${finalExt}`;
    const blobUrl = URL.createObjectURL(finalBlob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

    return { ok: true };
  } catch (err: any) {
    console.error('Download audio error:', err);
    return { ok: false, error: err.message || 'Lỗi xử lý file âm thanh' };
  }
}
