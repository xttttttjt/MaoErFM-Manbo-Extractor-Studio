import { MissEvanDanmakuItem, UserStats, MissEvanOfficialSubtitleEntry } from '../types/missevan';

/**
 * Convert MissEvan decimal color value to standard Hex color string (#RRGGBB)
 */
export function decimalToHexColor(colorDec: number): string {
  if (isNaN(colorDec) || colorDec <= 0) return '#FFFFFF';
  const hex = colorDec.toString(16).padStart(6, '0');
  return `#${hex.toUpperCase()}`;
}

/**
 * Format seconds into HH:MM:SS.mmm or MM:SS.mmm
 */
export function formatTime(seconds: number, format: 'srt' | 'vtt' | 'lrc' | 'display' = 'display'): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  const centis = Math.floor((seconds % 1) * 100);

  const pad2 = (n: number) => n.toString().padStart(2, '0');
  const pad3 = (n: number) => n.toString().padStart(3, '0');

  switch (format) {
    case 'srt':
      return `${pad2(hrs)}:${pad2(mins)}:${pad2(secs)},${pad3(millis)}`;
    case 'vtt':
      return `${pad2(hrs)}:${pad2(mins)}:${pad2(secs)}.${pad3(millis)}`;
    case 'lrc':
      const totalMins = hrs * 60 + mins;
      return `${pad2(totalMins)}:${pad2(secs)}.${pad2(centis)}`;
    case 'display':
    default:
      if (hrs > 0) {
        return `${pad2(hrs)}:${pad2(mins)}:${pad2(secs)}`;
      }
      return `${pad2(mins)}:${pad2(secs)}`;
  }
}

/**
 * Parse MissEvan XML string containing danmaku tags:
 * <d p="time,mode,size,color,create_time,pool,user_hash,dmid">text</d>
 */
export function parseMissEvanXml(xmlContent: string, defaultDuration = 4.0): MissEvanDanmakuItem[] {
  if (!xmlContent || !xmlContent.includes('<d')) {
    return [];
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
  const dNodes = xmlDoc.getElementsByTagName('d');

  const items: MissEvanDanmakuItem[] = [];

  for (let i = 0; i < dNodes.length; i++) {
    const node = dNodes[i];
    const pAttr = node.getAttribute('p') || '';
    const rawText = node.textContent || '';
    const text = rawText.trim();

    if (!pAttr || !text) continue;

    // Attributes: time, mode, size, color, create_time, pool, uid, dmid
    const parts = pAttr.split(',');
    const time = parseFloat(parts[0]) || 0;
    const mode = parseInt(parts[1], 10) || 1;
    const size = parseInt(parts[2], 10) || 25;
    const color = parseInt(parts[3], 10) || 16777215;
    const createTime = parseInt(parts[4], 10) || 0;
    const pool = parseInt(parts[5], 10) || 0;
    const userId = parts[6] ? parts[6].trim() : 'anonymous';
    const dmId = parts[7] ? parts[7].trim() : `${i}`;

    items.push({
      id: dmId || `dm_${i}_${time}`,
      time: Math.max(0, Number(time.toFixed(2))),
      endTime: Math.max(0, Number((time + defaultDuration).toFixed(2))),
      mode,
      size,
      color,
      colorHex: decimalToHexColor(color),
      createTime,
      pool,
      userId,
      dmId,
      text,
    });
  }

  // Sort strictly by timestamp ascending
  items.sort((a, b) => a.time - b.time);

  return calculateSmartEndTimes(items, defaultDuration);
}

/**
 * Calculates optimal end times for subtitles so they don't overlap awkwardly
 */
export function calculateSmartEndTimes(
  items: MissEvanDanmakuItem[],
  defaultDuration = 4.0,
  minDuration = 1.5,
  maxDuration = 6.0
): MissEvanDanmakuItem[] {
  const result: MissEvanDanmakuItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const cur = items[i];
    const next = items[i + 1];

    // Estimate natural reading duration based on character count: ~0.18s per char + 1.2s base
    const naturalDuration = Math.min(
      maxDuration,
      Math.max(minDuration, 1.2 + cur.text.length * 0.18)
    );

    let endTime = cur.time + (defaultDuration || naturalDuration);

    if (next) {
      const gap = next.time - cur.time;
      if (gap > 0 && gap < naturalDuration + 0.1) {
        // Next line appears soon, end just before next subtitle
        endTime = Math.max(cur.time + minDuration, next.time - 0.05);
      }
    }

    result.push({
      ...cur,
      endTime: Number(endTime.toFixed(2)),
    });
  }

  return result;
}

/**
 * Identify spam / barrage filler comments (e.g. 11111, 2333, hhh, emoticons)
 */
export function isSpamOrBarrage(text: string): boolean {
  if (!text) return true;
  const clean = text.trim();
  
  // Single character punctuation or symbols
  if (clean.length <= 1 && !/[\u4e00-\u9fa5a-zA-Z0-9]/.test(clean)) return true;

  // Repetitive numbers or letters (e.g., 11111, 23333, 6666, hhhhh, wwww, aaaa, ddd)
  if (/^(\d)\1{2,}$/.test(clean)) return true; // 111, 222
  if (/^23{2,}$/i.test(clean)) return true; // 233, 2333
  if (/^[hH]{3,}$/.test(clean)) return true; // hhh
  if (/^[wW]{3,}$/.test(clean)) return true; // www
  if (/^[6]{3,}$/.test(clean)) return true; // 666
  if (/^([a-zA-Z])\1{3,}$/.test(clean)) return true; // aaaa

  // Common danmaku reaction expressions
  const reactions = [
    '哈哈', '哈哈哈', '哈哈哈哈', '啊啊啊', '啊啊啊啊', '前排', '第一', '打卡',
    '盖被子', '心疼', '卧槽', '太甜了', '高能', '预警', '泪目', 'kya', 'kyaa',
    'awsl', 'xswl', '111', '222', '333', '666', '888', '999'
  ];
  if (reactions.includes(clean)) return true;

  return false;
}

/**
 * Group danmaku by User ID to find who contributed the subtitles
 */
export function analyzeUserContributions(items: MissEvanDanmakuItem[]): UserStats[] {
  const map = new Map<string, { count: number; mode4Count: number; firstTime: number; lastTime: number }>();

  for (const item of items) {
    const uid = item.userId;
    if (!map.has(uid)) {
      map.set(uid, {
        count: 0,
        mode4Count: 0,
        firstTime: item.time,
        lastTime: item.time,
      });
    }
    const stat = map.get(uid)!;
    stat.count += 1;
    if (item.mode === 4) stat.mode4Count += 1;
    stat.firstTime = Math.min(stat.firstTime, item.time);
    stat.lastTime = Math.max(stat.lastTime, item.time);
  }

  const list: UserStats[] = [];
  map.forEach((stat, userId) => {
    list.push({
      userId,
      count: stat.count,
      mode4Count: stat.mode4Count,
      firstTime: stat.firstTime,
      lastTime: stat.lastTime,
    });
  });

  // Sort by mode 4 count desc, then total count desc
  list.sort((a, b) => {
    if (b.mode4Count !== a.mode4Count) return b.mode4Count - a.mode4Count;
    return b.count - a.count;
  });

  return list;
}

/**
 * Parse MaoEr FM Official Subtitle JSON entries (from subtitle_url)
 * into standardized MissEvanDanmakuItem format
 */
export function parseMaoErOfficialSubtitles(
  entries: MissEvanOfficialSubtitleEntry[] | any[]
): MissEvanDanmakuItem[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const items: MissEvanDanmakuItem[] = [];

  for (let i = 0; i < entries.length; i++) {
    const raw = entries[i];
    if (!raw) continue;

    // MaoEr stores start_time and end_time in milliseconds
    const startTimeMs = typeof raw.start_time === 'number' ? raw.start_time : parseFloat(raw.start_time) || 0;
    const endTimeMs = typeof raw.end_time === 'number' ? raw.end_time : parseFloat(raw.end_time) || startTimeMs + 3000;
    
    const startSec = Math.max(0, Number((startTimeMs / 1000).toFixed(2)));
    const endSec = Math.max(startSec + 0.3, Number((endTimeMs / 1000).toFixed(2)));
    
    const role = (raw.role || '').trim();
    const content = (raw.content || '').trim();
    if (!content && !role) continue;

    // Full text with role prefix if specified (standard audio drama script style: Role: dialogue)
    const text = role ? `${role}：${content}` : content;
    const color = typeof raw.color === 'number' ? raw.color : 16777215;

    items.push({
      id: `official_sub_${i}_${startTimeMs}`,
      time: startSec,
      endTime: endSec,
      mode: 4, // bottom fixed subtitle
      size: 25,
      color,
      colorHex: decimalToHexColor(color),
      createTime: 0,
      pool: 0,
      userId: role || 'Official / 官方',
      dmId: `official_${i}`,
      text,
      role,
      isOfficialSubtitle: true,
    });
  }

  items.sort((a, b) => a.time - b.time);
  return items;
}

/**
 * Parse uploaded or pasted SRT, LRC, or JSON subtitle file
 */
export function parseSrtOrLrc(content: string): MissEvanDanmakuItem[] {
  if (!content) return [];
  const trimmed = content.trim();

  // Try JSON first
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : (parsed.data || parsed.subtitles || []);
      if (Array.isArray(list) && list.length > 0) {
        if ('start_time' in list[0] || 'content' in list[0]) {
          return parseMaoErOfficialSubtitles(list);
        }
        if ('time' in list[0] && 'text' in list[0]) {
          return list.map((item: any, i: number) => ({
            id: item.id || `custom_${i}`,
            time: Math.max(0, Number(item.time) || 0),
            endTime: Math.max(0, Number(item.endTime) || (Number(item.time) + 3)),
            mode: item.mode || 4,
            size: item.size || 25,
            color: item.color || 16777215,
            colorHex: item.colorHex || decimalToHexColor(item.color || 16777215),
            createTime: item.createTime || 0,
            pool: 0,
            userId: item.userId || item.role || 'Custom',
            dmId: `${i}`,
            text: String(item.text || ''),
            role: item.role || '',
            isOfficialSubtitle: true,
          }));
        }
      }
    } catch {
      // Not JSON, continue to SRT/LRC
    }
  }

  // Try SRT
  if (trimmed.includes('-->')) {
    const blocks = trimmed.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(/\n\s*\n/);
    const items: MissEvanDanmakuItem[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i].trim();
      if (!block) continue;
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      const arrowLine = lines.find((l) => l.includes('-->'));
      if (!arrowLine) continue;

      const [startStr, endStr] = arrowLine.split('-->').map((s) => s.trim());
      const parseTimestamp = (tStr: string) => {
        const parts = tStr.replace(',', '.').split(':');
        if (parts.length === 3) {
          return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
        }
        if (parts.length === 2) {
          return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
        }
        return parseFloat(tStr) || 0;
      };

      const start = parseTimestamp(startStr);
      const end = parseTimestamp(endStr);
      const textLines = lines.filter((l) => !l.includes('-->') && !/^\d+$/.test(l));
      const text = textLines.join('\n');
      if (!text) continue;

      items.push({
        id: `srt_${i}_${start}`,
        time: Number(start.toFixed(2)),
        endTime: Number(Math.max(start + 0.5, end).toFixed(2)),
        mode: 4,
        size: 25,
        color: 16777215,
        colorHex: '#FFFFFF',
        createTime: 0,
        pool: 0,
        userId: 'Imported SRT',
        dmId: `srt_${i}`,
        text,
        isOfficialSubtitle: true,
      });
    }

    if (items.length > 0) return items;
  }

  // Try LRC
  const lrcMatches = [...trimmed.matchAll(/\[(\d{2,}):(\d{2}(?:\.\d+)?)\](.*)/g)];
  if (lrcMatches.length > 0) {
    const items: MissEvanDanmakuItem[] = [];
    for (let i = 0; i < lrcMatches.length; i++) {
      const m = lrcMatches[i];
      const mins = parseFloat(m[1]);
      const secs = parseFloat(m[2]);
      const text = m[3].trim();
      const time = Number((mins * 60 + secs).toFixed(2));
      if (!text) continue;

      items.push({
        id: `lrc_${i}_${time}`,
        time,
        endTime: time + 3.0,
        mode: 4,
        size: 25,
        color: 16777215,
        colorHex: '#FFFFFF',
        createTime: 0,
        pool: 0,
        userId: 'Imported LRC',
        dmId: `lrc_${i}`,
        text,
        isOfficialSubtitle: true,
      });
    }

    return calculateSmartEndTimes(items);
  }

  return [];
}

/**
 * Parses KilaManbo official LRC script with character role detection and smart timing
 */
export function parseKilaManboLrc(lrcContent: string): MissEvanDanmakuItem[] {
  if (!lrcContent) return [];
  const lines = lrcContent.split(/\r?\n/).filter(Boolean);
  const items: MissEvanDanmakuItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^\[(\d{2,}):(\d{2}(?:\.\d+)?)\](.*)/);
    if (!match) continue;

    const mins = parseFloat(match[1]);
    const secs = parseFloat(match[2]);
    const content = match[3].trim();
    if (!content) continue;

    const time = Number((mins * 60 + secs).toFixed(2));
    let role = '官方台词';
    let text = content;

    const colonMatch = content.match(/^([^：:\n]{1,16})[：:](.*)/);
    if (colonMatch) {
      role = colonMatch[1].trim();
      text = colonMatch[2].trim();
    } else if (content.startsWith('【') && content.endsWith('】')) {
      role = '音效 / 场景';
    }

    items.push({
      id: `manbo_sub_${i}_${Math.round(time * 100)}`,
      time,
      endTime: Number((time + 3.0).toFixed(2)),
      mode: 4,
      size: 25,
      color: 3462041,
      colorHex: '#34D399',
      createTime: 0,
      pool: 0,
      userId: role,
      dmId: `sub_${i}`,
      text: text || content,
      role,
      isOfficialSubtitle: true,
    });
  }

  return calculateSmartEndTimes(items);
}

/**
 * Client-safe alias for parseKilaManboLrc
 */
export const parseKilaManboLrcString = parseKilaManboLrc;
