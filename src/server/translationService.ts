import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({});

export type SubtitleTargetLanguage = "vi" | "en" | "es";

export interface TranslateItemInput {
  id: string;
  text: string;
  role?: string;
}

export interface TranslateItemOutput {
  id: string;
  original: string;
  translated: string;
  role?: string;
  translatedRole?: string;
  engine?: "gemini" | "neural_fast";
}

const LANGUAGE_LABELS: Record<SubtitleTargetLanguage, { name: string; nativeName: string; code: string; instructions: string }> = {
  vi: {
    name: "Vietnamese",
    nativeName: "Tiếng Việt",
    code: "vi",
    instructions: `Dịch sang tiếng Việt tự nhiên, mượt mà, giàu cảm xúc, đúng phong cách kịch truyền thanh / phim ảnh điện ảnh.
- QUAN TRỌNG: Dịch CẢ nội dung câu thoại ("translated") VÀ tên vai/role ("translatedRole") sang tiếng Việt chuẩn xác.
- Tên nhân vật Trung Quốc: Dùng âm Hán Việt chuẩn xác (ví dụ: 周其琛 -> Chu Kỳ Sâm, 郎峰 -> Lang Phong, 沈括 -> Thẩm Quát, 盛望 -> Thịnh Vọng, 江添 -> Giang Thiêm, 严峫 -> Nghiêm Tà, 江停 -> Giang Đình, 费渡 -> Phí Độ, 骆闻舟 -> Lạc Văn Chu, 顾飞 -> Cố Phi, 蒋丞 -> Tưởng Thừa).
- Các thuật ngữ kịch truyền thanh:
  * 官方台词 -> Lời thoại chính thức
  * 音效/场景 hoặc 音效 / 场景 -> Âm thanh / Bối cảnh
  * 音效 -> Hiệu ứng âm thanh
  * 旁白 -> Lời dẫn
  * 报幕 -> Giới thiệu tập
  * 本集SC表请右滑界面查看 -> Vui lòng vuốt sang phải để xem danh sách SC (Staff & Cast) của tập này
- Giữ nguyên các dấu ngoặc vuông hoặc ngoặc đặc biệt như 【...】 khi chứa chỉ dẫn bối cảnh hoặc âm thanh.
- Đại từ nhân xưng linh hoạt, tự nhiên theo quan hệ và cảm xúc của nhân vật (anh - em, cậu - tớ, tôi - anh, hắn - tôi).`,
  },
  en: {
    name: "English",
    nativeName: "English",
    code: "en",
    instructions: `Translate into natural, idiomatic, spoken English suitable for subtitle synchronization in audio dramas/films.
- IMPORTANT: Translate BOTH dialogue text ("translated") AND role names ("translatedRole").
- Character names should be transcribed in standard Pinyin with capitalized names (e.g., Zhou Qichen, Lang Feng, Sheng Wang, Jiang Tian).
- Audio drama terms:
  * 官方台词 -> Official Subtitles
  * 音效/场景 -> SFX / Scene
  * 音效 -> Sound Effect
  * 旁白 -> Narrator
  * 报幕 -> Episode Intro
  * 本集SC表请右滑界面查看 -> Please swipe right to view this episode's Staff & Cast list
- Retain character voice, emotional intensity, colloquial realism, and dramatic tension.
- Keep dialogue concise and punchy for subtitle reading speed.`,
  },
  es: {
    name: "Spanish",
    nativeName: "Español",
    code: "es",
    instructions: `Traduce a un español natural, fluido y dramático, adecuado para subtítulos de audiodramas y series.
- IMPORTANTE: Traduce TANTO el diálogo ("translated") COMO el nombre del rol ("translatedRole").
- Los nombres propios chinos deben transcribirse en Pinyin estándar (ej. Zhou Qichen, Lang Feng).
- Términos de audiodrama:
  * 官方台词 -> Diálogo oficial
  * 音效/场景 -> Efectos / Escena
  * 旁白 -> Narrador
  * 报幕 -> Presentación del episodio
- Utiliza un registro conversacional acorde a las relaciones y emociones de los personajes.`,
  },
};

/**
 * Common Sino-Vietnamese name and role dictionary to polish and guarantee translations in Vietnamese
 */
const VI_ROLE_DICTIONARY: Record<string, string> = {
  "官方台词": "Lời thoại chính thức",
  "音效/场景": "Âm thanh / Bối cảnh",
  "音效 / 场景": "Âm thanh / Bối cảnh",
  "音效": "Hiệu ứng âm thanh",
  "场景": "Bối cảnh",
  "旁白": "Lời dẫn",
  "报幕": "Giới thiệu tập",
  "报幕/提示": "Thông báo",
  "周其琛": "Chu Kỳ Sâm",
  "郎峰": "Lang Phong",
  "沈括": "Thẩm Quát",
  "盛望": "Thịnh Vọng",
  "江添": "Giang Thiêm",
  "严峫": "Nghiêm Tà",
  "江停": "Giang Đình",
  "费渡": "Phí Độ",
  "骆闻舟": "Lạc Văn Chu",
  "顾飞": "Cố Phi",
  "蒋丞": "Tưởng Thừa",
  "顾昀": "Cố Quân",
  "长庚": "Trường Canh",
  "谢怜": "Tạ Liên",
  "花城": "Hoa Thành",
  "魏无羡": "Ngụy Vô Tiện",
  "蓝忘机": "Lam Vong Cơ",
  "白敬亭": "Bạch Kính Đình",
  "制作组": "Ban sản xuất",
  "配音组": "Đội lồng tiếng",
  "原著": "Nguyên tác",
  "策划": "Kế hoạch",
  "编剧": "Biên kịch",
  "导演": "Đạo diễn",
  "后期": "Hậu kỳ",
  "美工": "Thiết kế mỹ thuật",
  "画师": "Họa sĩ",
  "题字": "Đề từ",
  "字幕": "Phụ đề",
};

const EN_ROLE_DICTIONARY: Record<string, string> = {
  "官方台词": "Official Subtitles",
  "音效/场景": "SFX / Scene",
  "音效 / 场景": "SFX / Scene",
  "音效": "Sound Effect",
  "场景": "Scene",
  "旁白": "Narrator",
  "报幕": "Episode Intro",
  "周其琛": "Zhou Qichen",
  "郎峰": "Lang Feng",
  "沈括": "Shen Kuo",
  "盛望": "Sheng Wang",
  "江添": "Jiang Tian",
};

const VI_COMMON_PHRASES: Array<[RegExp, string]> = [
  [/本集\s*SC\s*表请右滑界面查看/gi, "Vui lòng vuốt sang phải để xem danh sách SC (Staff & Cast) của tập này"],
  [/请右滑界面查看/gi, "Vui lòng vuốt sang phải để xem"],
  [/SC\s*表/gi, "Bảng SC (Staff & Cast)"],
  [/Chu Kỳ Thần/gi, "Chu Kỳ Sâm"],
  [/Zhou Qichen/gi, "Chu Kỳ Sâm"],
  [/Lãng Phong/gi, "Lang Phong"],
  [/Lang Feng/gi, "Lang Phong"],
  [/Shen Kuo/gi, "Thẩm Quát"],
  [/Sheng Wang/gi, "Thịnh Vọng"],
  [/Jiang Tian/gi, "Giang Thiêm"],
  [/Tháp điều khiển:/gi, "Đài chỉ huy:"],
  [/Tháp:/gi, "Đài chỉ huy / Tháp không lưu:"],
];

export function polishVietnameseDialogue(text: string): string {
  let polished = text;
  for (const [pattern, replacement] of VI_COMMON_PHRASES) {
    polished = polished.replace(pattern, replacement);
  }
  return polished;
}

/**
 * Checks if a string contains Chinese characters
 */
function containsChinese(str: string): boolean {
  return /[\u4e00-\u9fa5]/.test(str);
}

/**
 * Translates a role name using local dictionary or fallback
 */
function translateRoleName(role: string | undefined, targetLang: SubtitleTargetLanguage): string | undefined {
  if (!role || !role.trim()) return undefined;
  const cleanRole = role.trim();

  if (targetLang === "vi") {
    if (VI_ROLE_DICTIONARY[cleanRole]) return VI_ROLE_DICTIONARY[cleanRole];
    // Check if role contains known entries
    for (const [zh, vi] of Object.entries(VI_ROLE_DICTIONARY)) {
      if (cleanRole.includes(zh)) {
        return cleanRole.replace(zh, vi);
      }
    }
  } else if (targetLang === "en") {
    if (EN_ROLE_DICTIONARY[cleanRole]) return EN_ROLE_DICTIONARY[cleanRole];
  }

  return cleanRole;
}

/**
 * High-reliability fallback translation engine using MyMemory API
 */
async function translateFastEngine(
  text: string,
  targetLang: SubtitleTargetLanguage
): Promise<string> {
  if (!text || !text.trim()) return text;

  // Check known common audio drama phrases first
  if (targetLang === "vi") {
    if (text.includes("本集SC表请右滑界面查看")) {
      return "Vui lòng vuốt sang phải để xem danh sách SC (Staff & Cast) của tập này";
    }
  }

  const langCode = targetLang === "vi" ? "vi" : targetLang === "es" ? "es" : "en";
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=zh-CN|${langCode}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const translated = data?.responseData?.translatedText;
      if (translated && typeof translated === "string" && translated.trim()) {
        let result = translated.trim();
        if (targetLang === "vi") {
          result = polishVietnameseDialogue(result);
        }
        return result;
      }
    }
  } catch (err: any) {
    console.warn("MyMemory translation fallback failed:", err?.message || err);
  }

  // If MyMemory failed and target is Vietnamese, apply audio drama glossary
  if (targetLang === "vi") {
    return polishVietnameseDialogue(text);
  }

  return text;
}

/**
 * Attempts Gemini translation with model failover and realistic timeouts
 */
async function tryGeminiTranslation(
  items: TranslateItemInput[],
  targetLang: SubtitleTargetLanguage,
  dramaContext?: string
): Promise<Map<string, { translated: string; translatedRole?: string }> | null> {
  const langConfig = LANGUAGE_LABELS[targetLang] || LANGUAGE_LABELS.vi;
  // Fast, high-throughput models in order of latency and response reliability
  const modelCandidates = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
  ];

  const systemInstruction = `You are an elite, highly acclaimed audio drama (广播剧) and cinematic subtitle translator.
Your goal is to translate Chinese audio drama subtitle lines into ${langConfig.name} (${langConfig.nativeName}).

CRITICAL INSTRUCTIONS:
${langConfig.instructions}
${dramaContext ? `CONTEXT OF THIS AUDIO DRAMA: ${dramaContext}` : ""}

FORMAT RULES:
1. Return a JSON array where each object has:
   - "id": exactly the matching input id
   - "translated": the translated subtitle dialogue into ${langConfig.name}
   - "translatedRole": the translated character/role name into ${langConfig.name} (e.g. 官方台词 -> Lời thoại chính thức, 音效/场景 -> Âm thanh / Bối cảnh, 周其琛 -> Chu Kỳ Sâm, 郎峰 -> Lang Phong)
2. Translate EVERY single item in the input array. Do NOT skip any line.
3. Keep the translation faithful to character emotions, breath, hesitation, and subtext.
4. Output MUST NOT leave Chinese characters untranslated in the "translated" or "translatedRole" fields.`;

  const userPrompt = JSON.stringify(
    items.map((i) => ({
      id: i.id,
      role: i.role || "",
      text: i.text,
    }))
  );

  for (const model of modelCandidates) {
    try {
      const timeoutMs = model.includes("3.8") ? 25000 : 15000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini translation timeout (${model})`)), timeoutMs)
      );

      const generateConfig: any = {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              translated: { type: Type.STRING },
              translatedRole: { type: Type.STRING },
            },
            required: ["id", "translated"],
          },
        },
      };

      if (model.includes("3.8")) {
        generateConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      const generatePromise = ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [{ text: `Translate the following dialogue lines into ${langConfig.name}:\n${userPrompt}` }],
          },
        ],
        config: generateConfig,
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const text = response.text?.trim() || "[]";
      const parsed = JSON.parse(text);

      if (Array.isArray(parsed) && parsed.length > 0) {
        const parsedMap = new Map<string, { translated: string; translatedRole?: string }>();
        for (const p of parsed) {
          if (p && typeof p.id === "string") {
            let trText = (p.translated || "").trim();
            let trRole = (p.translatedRole || "").trim();

            if (targetLang === "vi") {
              trText = polishVietnameseDialogue(trText);
              if (trRole) {
                trRole = translateRoleName(trRole, "vi") || trRole;
              }
            }

            parsedMap.set(p.id, {
              translated: trText,
              translatedRole: trRole || undefined,
            });
          }
        }
        return parsedMap;
      }
    } catch (err: any) {
      console.warn(`Gemini model ${model} attempt failed:`, err?.status || err?.message || err);
      // If 503 spike, wait 400ms before trying next candidate
      if (err?.status === 503) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  return null;
}

/**
 * Translates a batch of subtitle lines with automatic multi-tiered fallback
 */
async function translateChunk(
  items: TranslateItemInput[],
  targetLang: SubtitleTargetLanguage,
  dramaContext?: string
): Promise<TranslateItemOutput[]> {
  // 1. Try Gemini first
  const geminiMap = await tryGeminiTranslation(items, targetLang, dramaContext);

  if (geminiMap && geminiMap.size > 0) {
    const outputs: TranslateItemOutput[] = [];
    for (const item of items) {
      const found = geminiMap.get(item.id);
      let translatedStr = found?.translated;
      let translatedRole = found?.translatedRole || translateRoleName(item.role, targetLang);

      // Check if translation is valid and actually translated (does not still contain raw Chinese)
      const needsFallback =
        !translatedStr ||
        translatedStr.trim().length === 0 ||
        (containsChinese(item.text) && containsChinese(translatedStr));

      if (needsFallback) {
        try {
          const fallbackText = await translateFastEngine(item.text, targetLang);
          translatedStr = fallbackText;
        } catch {
          translatedStr = targetLang === "vi" ? polishVietnameseDialogue(item.text) : item.text;
        }
      }

      outputs.push({
        id: item.id,
        original: item.text,
        translated: targetLang === "vi" ? polishVietnameseDialogue(translatedStr || item.text) : (translatedStr || item.text),
        role: item.role,
        translatedRole,
        engine: "gemini",
      });
    }
    return outputs;
  }

  // 2. High-reliability fast fallback translation engine (MyMemory + Local glossary)
  console.log("Switching to secondary high-reliability translation engine for chunk of", items.length, "lines");
  const outputs: TranslateItemOutput[] = [];
  const CONCURRENCY = 4;

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const translatedRole = translateRoleName(item.role, targetLang);
        try {
          const translated = await translateFastEngine(item.text, targetLang);
          return {
            id: item.id,
            original: item.text,
            translated: targetLang === "vi" ? polishVietnameseDialogue(translated) : translated,
            role: item.role,
            translatedRole,
            engine: "neural_fast" as const,
          };
        } catch {
          return {
            id: item.id,
            original: item.text,
            translated: targetLang === "vi" ? polishVietnameseDialogue(item.text) : item.text,
            role: item.role,
            translatedRole,
            engine: "neural_fast" as const,
          };
        }
      })
    );
    outputs.push(...batchResults);
    // Small delay between fallback batches to stay well within public rate limits
    if (i + CONCURRENCY < items.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return outputs;
}

/**
 * Main translation dispatcher that chunks subtitle sets and returns translated lines
 */
export async function translateSubtitles(
  items: TranslateItemInput[],
  targetLang: SubtitleTargetLanguage,
  dramaContext?: string,
  onProgress?: (processed: number, total: number) => void
): Promise<TranslateItemOutput[]> {
  if (!items || items.length === 0) return [];

  // Optimal batch size for ultra-fast, high-reliability response
  const BATCH_SIZE = 15;
  const chunks: TranslateItemInput[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    chunks.push(items.slice(i, i + BATCH_SIZE));
  }

  const results: TranslateItemOutput[] = [];
  let processed = 0;

  for (const chunk of chunks) {
    const chunkResults = await translateChunk(chunk, targetLang, dramaContext);
    results.push(...chunkResults);
    processed += chunk.length;
    if (onProgress) {
      onProgress(processed, items.length);
    }
  }

  return results;
}
