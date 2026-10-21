import JSZip from 'jszip';
import { MissEvanDanmakuItem, MissEvanSoundInfo } from '../types/missevan';
import { formatTime } from './parser';

/**
 * Generate standard SRT subtitle string
 */
export function generateSRT(items: MissEvanDanmakuItem[], offsetSeconds = 0): string {
  let srt = '';
  let index = 1;

  for (const item of items) {
    const start = Math.max(0, item.time + offsetSeconds);
    const end = Math.max(start + 0.5, item.endTime + offsetSeconds);

    srt += `${index}\n`;
    srt += `${formatTime(start, 'srt')} --> ${formatTime(end, 'srt')}\n`;
    srt += `${item.text}\n\n`;
    index++;
  }

  return srt;
}

/**
 * Generate standard LRC subtitle/lyrics string for audio players
 */
export function generateLRC(items: MissEvanDanmakuItem[], soundInfo?: MissEvanSoundInfo | null, offsetSeconds = 0): string {
  let lrc = '';
  if (soundInfo) {
    lrc += `[ti:${soundInfo.soundstr || 'MissEvan Vinyl Audio'}]\n`;
    lrc += `[ar:${soundInfo.username || 'MaoEr FM'}]\n`;
    lrc += `[al:MissEvan Audio Drama Collection]\n`;
    lrc += `[by:MissEvan Vinyl Studio]\n\n`;
  }

  for (const item of items) {
    const start = Math.max(0, item.time + offsetSeconds);
    lrc += `[${formatTime(start, 'lrc')}]${item.text}\n`;
  }

  return lrc;
}

/**
 * Generate WebVTT subtitle string
 */
export function generateVTT(items: MissEvanDanmakuItem[], offsetSeconds = 0): string {
  let vtt = 'WEBVTT - MissEvan Vinyl Subtitles\n\n';
  let index = 1;

  for (const item of items) {
    const start = Math.max(0, item.time + offsetSeconds);
    const end = Math.max(start + 0.5, item.endTime + offsetSeconds);

    vtt += `${index}\n`;
    vtt += `${formatTime(start, 'vtt')} --> ${formatTime(end, 'vtt')}\n`;
    vtt += `${item.text}\n\n`;
    index++;
  }

  return vtt;
}

/**
 * Generate Advanced SubStation Alpha (ASS) format with styled bottom subtitle alignment
 */
export function generateASS(items: MissEvanDanmakuItem[], soundInfo?: MissEvanSoundInfo | null, offsetSeconds = 0): string {
  const title = soundInfo?.soundstr || 'MissEvan Subtitles';
  const header = `[Script Info]
Title: ${title}
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Alegreya,52,&H00FFFFFF,&H000000FF,&H0018151C,&H80000000,-1,0,0,0,100,100,0,0,1,3.5,1.5,2,40,40,45,1
Style: VinylPink,Alegreya,50,&H00A06BF4,&H000000FF,&H00100C14,&H80000000,-1,0,0,0,100,100,0,0,1,3.5,1.5,2,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const formatAssTime = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    const csec = Math.floor((sec % 1) * 100);
    const p2 = (n: number) => n.toString().padStart(2, '0');
    return `${hrs}:${p2(mins)}:${p2(secs)}.${p2(csec)}`;
  };

  let events = '';
  for (const item of items) {
    const start = Math.max(0, item.time + offsetSeconds);
    const end = Math.max(start + 0.5, item.endTime + offsetSeconds);
    const text = item.text.replace(/\n/g, '\\N');
    events += `Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Default,,0,0,0,,${text}\n`;
  }

  return header + events;
}

/**
 * Generate plain text transcript (clean transcript for reading or fan translation)
 */
export function generateTXT(items: MissEvanDanmakuItem[], withTimestamps = false, offsetSeconds = 0): string {
  let txt = '';
  for (const item of items) {
    if (withTimestamps) {
      const start = Math.max(0, item.time + offsetSeconds);
      txt += `[${formatTime(start, 'display')}] `;
    }
    txt += `${item.text}\n`;
  }
  return txt;
}

/**
 * Trigger browser file download directly
 */
export function downloadFile(content: string | Blob, filename: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Package all subtitle formats and cover image into a single .zip file
 */
export async function downloadAllAsZip(
  items: MissEvanDanmakuItem[],
  soundInfo: MissEvanSoundInfo | null,
  rawXml: string,
  offsetSeconds = 0,
  customBaseTitle?: string
): Promise<void> {
  const zip = new JSZip();
  const baseName = customBaseTitle
    ? sanitizeFilename(customBaseTitle)
    : soundInfo
    ? `MissEvan_${soundInfo.id}_${sanitizeFilename(soundInfo.soundstr)}`
    : 'subtitles';

  zip.file(`${baseName}.srt`, generateSRT(items, offsetSeconds));
  zip.file(`${baseName}.lrc`, generateLRC(items, soundInfo, offsetSeconds));
  zip.file(`${baseName}.vtt`, generateVTT(items, offsetSeconds));
  zip.file(`${baseName}.ass`, generateASS(items, soundInfo, offsetSeconds));
  zip.file(`${baseName}_transcript.txt`, generateTXT(items, true, offsetSeconds));
  zip.file(`${baseName}_pure.txt`, generateTXT(items, false, offsetSeconds));
  zip.file(`${baseName}_data.json`, JSON.stringify(items, null, 2));

  if (rawXml) {
    zip.file(`${baseName}_raw.xml`, rawXml);
  }

  // Include high resolution cover art if available
  const coverUrl = soundInfo?.front_cover || soundInfo?.cover_image;
  if (coverUrl) {
    try {
      const { fetchCoverBlobWithMeta } = await import('./coverDownloader');
      const meta = await fetchCoverBlobWithMeta(coverUrl);
      if (meta && meta.blob) {
        zip.file(`${baseName}_cover.${meta.ext}`, meta.blob);
      }
    } catch (err) {
      console.warn('Could not bundle cover image in ZIP:', err);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadFile(blob, `${baseName}_vinyl_all_formats.zip`, 'application/zip');
}

/**
 * Remove filesystem invalid characters from filename
 */
export function sanitizeFilename(name: string): string {
  if (!name) return 'subtitle';
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80).trim();
}

/**
 * Generate Translated SRT subtitle string
 */
export function generateTranslatedSRT(items: MissEvanDanmakuItem[], offsetSeconds = 0): string {
  let srt = '';
  let index = 1;

  for (const item of items) {
    const start = Math.max(0, item.time + offsetSeconds);
    const end = Math.max(start + 0.5, item.endTime + offsetSeconds);
    const content = item.translatedText || item.text;

    srt += `${index}\n`;
    srt += `${formatTime(start, 'srt')} --> ${formatTime(end, 'srt')}\n`;
    srt += `${content}\n\n`;
    index++;
  }

  return srt;
}

/**
 * Generate Bilingual SRT subtitle string (Original Chinese + Translated dialogue)
 */
export function generateBilingualSRT(items: MissEvanDanmakuItem[], offsetSeconds = 0): string {
  let srt = '';
  let index = 1;

  for (const item of items) {
    const start = Math.max(0, item.time + offsetSeconds);
    const end = Math.max(start + 0.5, item.endTime + offsetSeconds);
    const original = item.text;
    const translated = item.translatedText;
    const body = translated && translated !== original ? `${original}\n${translated}` : original;

    srt += `${index}\n`;
    srt += `${formatTime(start, 'srt')} --> ${formatTime(end, 'srt')}\n`;
    srt += `${body}\n\n`;
    index++;
  }

  return srt;
}

/**
 * Generate Translated WebVTT subtitle string
 */
export function generateTranslatedVTT(items: MissEvanDanmakuItem[], offsetSeconds = 0): string {
  let vtt = 'WEBVTT - MissEvan Translated Subtitles\n\n';
  let index = 1;

  for (const item of items) {
    const start = Math.max(0, item.time + offsetSeconds);
    const end = Math.max(start + 0.5, item.endTime + offsetSeconds);
    const content = item.translatedText || item.text;

    vtt += `${index}\n`;
    vtt += `${formatTime(start, 'vtt')} --> ${formatTime(end, 'vtt')}\n`;
    vtt += `${content}\n\n`;
    index++;
  }

  return vtt;
}

/**
 * Generate Bilingual WebVTT subtitle string
 */
export function generateBilingualVTT(items: MissEvanDanmakuItem[], offsetSeconds = 0): string {
  let vtt = 'WEBVTT - MissEvan Bilingual Subtitles\n\n';
  let index = 1;

  for (const item of items) {
    const start = Math.max(0, item.time + offsetSeconds);
    const end = Math.max(start + 0.5, item.endTime + offsetSeconds);
    const original = item.text;
    const translated = item.translatedText;
    const body = translated && translated !== original ? `${original}\n${translated}` : original;

    vtt += `${index}\n`;
    vtt += `${formatTime(start, 'vtt')} --> ${formatTime(end, 'vtt')}\n`;
    vtt += `${body}\n\n`;
    index++;
  }

  return vtt;
}

/**
 * Generate Translated LRC lyrics string
 */
export function generateTranslatedLRC(items: MissEvanDanmakuItem[], soundInfo?: MissEvanSoundInfo | null, offsetSeconds = 0): string {
  let lrc = '';
  if (soundInfo) {
    lrc += `[ti:${soundInfo.soundstr || 'MissEvan Audio'}]\n`;
    lrc += `[ar:${soundInfo.username || 'MaoEr FM'}]\n`;
    lrc += `[al:MissEvan Translated Audio Drama Collection]\n\n`;
  }

  for (const item of items) {
    const start = Math.max(0, item.time + offsetSeconds);
    const content = item.translatedText || item.text;
    lrc += `[${formatTime(start, 'lrc')}]${content}\n`;
  }

  return lrc;
}

/**
 * Generate Bilingual LRC lyrics string
 */
export function generateBilingualLRC(items: MissEvanDanmakuItem[], soundInfo?: MissEvanSoundInfo | null, offsetSeconds = 0): string {
  let lrc = '';
  if (soundInfo) {
    lrc += `[ti:${soundInfo.soundstr || 'MissEvan Audio'}]\n`;
    lrc += `[ar:${soundInfo.username || 'MaoEr FM'}]\n`;
    lrc += `[al:MissEvan Bilingual Audio Drama Collection]\n\n`;
  }

  for (const item of items) {
    const start = Math.max(0, item.time + offsetSeconds);
    const original = item.text;
    const translated = item.translatedText;
    const body = translated && translated !== original ? `${original} // ${translated}` : original;
    lrc += `[${formatTime(start, 'lrc')}]${body}\n`;
  }

  return lrc;
}

/**
 * Generate plain text transcript for translated text
 */
export function generateTranslatedTXT(items: MissEvanDanmakuItem[], withTimestamps = false, offsetSeconds = 0): string {
  let txt = '';
  for (const item of items) {
    if (withTimestamps) {
      const start = Math.max(0, item.time + offsetSeconds);
      txt += `[${formatTime(start, 'display')}] `;
    }
    txt += `${item.translatedText || item.text}\n`;
  }
  return txt;
}

/**
 * Generate bilingual plain text transcript
 */
export function generateBilingualTXT(items: MissEvanDanmakuItem[], withTimestamps = false, offsetSeconds = 0): string {
  let txt = '';
  for (const item of items) {
    if (withTimestamps) {
      const start = Math.max(0, item.time + offsetSeconds);
      txt += `[${formatTime(start, 'display')}]\n`;
    }
    txt += `CN: ${item.text}\n`;
    if (item.translatedText && item.translatedText !== item.text) {
      txt += `TR: ${item.translatedText}\n`;
    }
    txt += `\n`;
  }
  return txt;
}
