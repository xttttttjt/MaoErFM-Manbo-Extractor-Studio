import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import crypto from "crypto";
import { Transform } from "stream";
import { createRequire } from "module";

import { translateSubtitles, type SubtitleTargetLanguage, type SubtitleTranslationEngine } from "./src/server/translationService.ts";
import { decryptKilaManboUrl, decryptKilaManboAudioUrl, parseKilaManboLrcString } from "./src/server/kilamanboCrypto.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json, text/xml, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,vi;q=0.7",
};

const DEFAULT_EQUIP_ID = "42496766-ca02-11f1-823c-ac02504ffb48";

// 8 MB max per single HTTP response to avoid Cloud Run 32MB streaming limits
export const MAX_CHUNK_BYTES = 8 * 1024 * 1024;

let savedMissEvanCookie = process.env.MISSEVAN_COOKIE || "";

export function normalizeMissEvanCookie(rawCookie?: string): string {
  if (!rawCookie) return "";
  let cleaned = rawCookie.trim();
  if (!cleaned) return "";

  // Handle JSON cookie array exports (e.g., Cookie-Editor / EditThisCookie)
  if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        cleaned = parsed
          .filter((item) => item && typeof item.name === "string" && typeof item.value === "string")
          .map((item) => `${item.name.trim()}=${item.value.trim()}`)
          .join("; ");
      }
    } catch {
      // fall through
    }
  }

  // Strip leading "Cookie:" prefix and surrounding quotes
  cleaned = cleaned.replace(/^cookie\s*:\s*/i, "").replace(/^["']+|["']+$/g, "").trim();

  // Handle tab-separated DevTools Application -> Cookies row copy (e.g. "token\t<value>\t.missevan.com...")
  if (cleaned.includes("\t")) {
    const lines = cleaned.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
    const pairs: string[] = [];
    for (const line of lines) {
      const cols = line.split("\t").map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 2 && /^[A-Za-z0-9_-]+$/.test(cols[0])) {
        pairs.push(`${cols[0]}=${cols[1]}`);
      }
    }
    if (pairs.length > 0) {
      cleaned = pairs.join("; ");
    }
  }

  // Collapse any remaining newlines/control chars and non-ASCII characters (HTTP header safety)
  cleaned = cleaned
    .replace(/[\r\n\t]+/g, "; ")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();

  if (!cleaned) return "";

  // If user pasted the raw token value directly without "token=" (no '=' anywhere in the string)
  if (!cleaned.includes("=")) {
    cleaned = `token=${cleaned}`;
  }

  // Ensure consistent equip_id so MissEvan does not trigger limit_type=1 (concurrent device limit)
  if (!/\bequip_id\s*=/.test(cleaned)) {
    cleaned = `${cleaned}; equip_id=${DEFAULT_EQUIP_ID}`;
  }

  return cleaned;
}

function buildMissEvanHeaders(refererUrl: string, reqCookie?: string): Record<string, string> {
  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    Referer: refererUrl,
  };
  const normalized = normalizeMissEvanCookie(reqCookie || savedMissEvanCookie);
  if (normalized) {
    headers["Cookie"] = normalized;
  } else {
    headers["Cookie"] = `equip_id=${DEFAULT_EQUIP_ID}`;
  }
  return headers;
}

// API: Configure or check MissEvan VIP Cookie
app.get("/api/missevan/cookie", (_req, res) => {
  return res.json({
    hasCookie: Boolean(savedMissEvanCookie.trim()),
    cookie: savedMissEvanCookie,
  });
});

app.post("/api/missevan/cookie", (req, res) => {
  const raw = typeof req.body?.cookie === "string" ? req.body.cookie.trim() : "";
  savedMissEvanCookie = raw ? normalizeMissEvanCookie(raw) : "";
  return res.json({
    success: true,
    hasCookie: Boolean(savedMissEvanCookie),
    cookie: savedMissEvanCookie,
  });
});

let savedManboCookie = process.env.KILAMANBO_COOKIE || process.env.MANBO_TOKEN || "";

export function normalizeManboCookie(rawCookie?: string): string {
  if (!rawCookie) return "";
  let cleaned = rawCookie.trim();
  if (!cleaned) return "";

  // Handle JSON cookie array exports (e.g. Cookie-Editor)
  if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        cleaned = parsed
          .filter((item) => item && typeof item.name === "string" && typeof item.value === "string")
          .map((item) => `${item.name.trim()}=${item.value.trim()}`)
          .join("; ");
      }
    } catch {
      // ignore
    }
  }

  // Strip leading "Cookie:" prefix and quotes
  cleaned = cleaned.replace(/^cookie\s*:\s*/i, "").replace(/^["']+|["']+$/g, "").trim();

  // Handle tab-separated DevTools Application -> Cookies row copy
  if (cleaned.includes("\t")) {
    const lines = cleaned.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
    const pairs: string[] = [];
    for (const line of lines) {
      const cols = line.split("\t").map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 2 && /^[A-Za-z0-9_-]+$/.test(cols[0])) {
        pairs.push(`${cols[0]}=${cols[1]}`);
      }
    }
    if (pairs.length > 0) {
      cleaned = pairs.join("; ");
    }
  }

  cleaned = cleaned.replace(/[\r\n\t]+/g, "; ").replace(/[^\x20-\x7E]/g, "").trim();

  // If user pasted raw token without "authToken=" or "token="
  if (!cleaned.includes("=")) {
    cleaned = `authToken=${cleaned}`;
  }

  // Deduplicate and clean up empty cookie pairs like "authToken=; userId=;"
  // If a key has both an empty and non-empty value, the non-empty value must take precedence
  const pairs = cleaned.split(";").map((p) => p.trim()).filter(Boolean);
  const cookieMap = new Map<string, string>();
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx !== -1) {
      const key = pair.slice(0, eqIdx).trim();
      const val = pair.slice(eqIdx + 1).trim();
      if (!cookieMap.has(key) || (!cookieMap.get(key) && val)) {
        cookieMap.set(key, val);
      }
    }
  }

  const cleanedPairs: string[] = [];
  for (const [k, v] of cookieMap.entries()) {
    if (v) {
      cleanedPairs.push(`${k}=${v}`);
    }
  }

  return cleanedPairs.join("; ");
}

function buildManboHeaders(reqCookie?: string): Record<string, string> {
  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    Referer: "https://www.kilamanbo.world/manbo/pc/detail",
    Origin: "https://www.kilamanbo.world",
    Host: "www.kilamanbo.world",
    device: "pc",
    platform: "web",
    scene: "pc",
    uuid: DEFAULT_EQUIP_ID,
  };
  const normalized = normalizeManboCookie(reqCookie || savedManboCookie);
  if (normalized) {
    headers["Cookie"] = normalized;
    const tokenMatch = normalized.match(/\b(?:authToken|token)=([^;]+)/i);
    if (tokenMatch) {
      const tVal = tokenMatch[1].trim();
      headers["authToken"] = tVal;
      headers["token"] = tVal;
      headers["Authorization"] = `Bearer ${tVal}`;
    }
    const uidMatch = normalized.match(/\b(?:userId|uid)=([^;]+)/i);
    if (uidMatch) {
      headers["userId"] = uidMatch[1].trim();
      headers["uid"] = uidMatch[1].trim();
    }
    const devMatch = normalized.match(/\b(?:deviceId|device_id)=([^;]+)/i);
    if (devMatch) {
      headers["deviceId"] = devMatch[1].trim();
    }
  }
  return headers;
}

// In-memory cache for KilaManbo drama sets to preserve official LRC URLs and media metadata across endpoints
interface CachedManboDramaSet {
  dramaId: string;
  dramaTitle: string;
  setIdStr: string;
  setNo: number;
  setTitle: string;
  setName?: string;
  desc?: string;
  setPic?: string;
  duration?: number;
  setLrcUrl?: string;
  payType: number;
  price?: number;
  normalAudioUrl?: string;
  highAudioUrl?: string;
  superAudioUrl?: string;
}
const manboDramaSetCache = new Map<string, CachedManboDramaSet>();
const manboDramaCache = new Map<string, any>();

// API: Configure or check KilaManbo VIP Cookie / Token
app.get("/api/manbo/cookie", (_req, res) => {
  return res.json({
    hasCookie: Boolean(savedManboCookie.trim()),
    cookie: savedManboCookie,
  });
});

app.post("/api/manbo/cookie", (req, res) => {
  const raw = typeof req.body?.cookie === "string" ? req.body.cookie.trim() : "";
  savedManboCookie = raw ? normalizeManboCookie(raw) : "";
  return res.json({
    success: true,
    hasCookie: Boolean(savedManboCookie),
    cookie: savedManboCookie,
  });
});

// API: Decrypt any KilaManbo AES-128 audio stream string
app.post("/api/manbo/decrypt-stream", (req, res) => {
  const enc = typeof req.body?.encryptedUrl === "string" ? req.body.encryptedUrl.trim() : "";
  if (!enc) {
    return res.status(400).json({ error: "Missing encryptedUrl parameter" });
  }
  const decrypted = decryptKilaManboAudioUrl(enc);
  return res.json({
    success: Boolean(decrypted),
    decryptedUrl: decrypted,
  });
});

// API: Verify KilaManbo session token
app.get("/api/manbo/verify-auth", async (req, res) => {
  try {
    const reqCookie = typeof req.headers["x-manbo-cookie"] === "string" ? req.headers["x-manbo-cookie"] : undefined;
    const headers = buildManboHeaders(reqCookie);
    const testRes = await fetch("https://www.kilamanbo.world/web_manbo/dramaDetail?dramaId=2235647356781461610", {
      headers,
    });
    if (!testRes.ok) {
      return res.json({ valid: false, message: `Máy chủ KilaManbo phản hồi HTTP ${testRes.status}` });
    }
    const testJson = await testRes.json();
    return res.json({
      valid: testJson.code === 200,
      hasCredentials: Boolean(headers["authToken"] || headers["Cookie"]?.includes("=")),
      code: testJson.code,
      message: testJson.code === 200 ? "Kết nối KilaManbo thành công" : (testJson.msg || "Lỗi kiểm tra xác thực"),
    });
  } catch (err: any) {
    return res.status(500).json({ valid: false, error: err.message });
  }
});

// API: Resolve KilaManbo URL or Drama ID
app.get("/api/manbo/resolve", async (req, res) => {
  try {
    const inputUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
    if (!inputUrl) {
      return res.status(400).json({ error: "Vui lòng nhập link phim hoặc ID phim KilaManbo" });
    }

    const decryptedParams = await decryptKilaManboUrl(inputUrl);
    const dramaId = decryptedParams.dramaId;
    if (!dramaId) {
      return res.status(400).json({ error: "Không thể nhận diện dramaId từ đường dẫn KilaManbo này" });
    }

    const reqCookie = typeof req.headers["x-manbo-cookie"] === "string" ? req.headers["x-manbo-cookie"] : undefined;
    const headers = buildManboHeaders(reqCookie);

    const dramaRes = await fetch(`https://www.kilamanbo.world/web_manbo/dramaDetail?dramaId=${encodeURIComponent(dramaId)}`, {
      headers,
    });

    if (!dramaRes.ok) {
      return res.status(dramaRes.status).json({
        error: `Không thể kết nối đến máy chủ KilaManbo (HTTP ${dramaRes.status})`,
      });
    }

    const dramaJson = await dramaRes.json();
    if (dramaJson.code !== 200 || !dramaJson.data) {
      return res.status(404).json({
        error: dramaJson.msg || "Không tìm thấy thông tin bộ kịch này trên KilaManbo",
      });
    }

    const dramaData = dramaJson.data;
    manboDramaCache.set(String(dramaId), dramaData);

    // Decrypt audio URLs for each episode in setRespList if available and store in cache
    if (Array.isArray(dramaData.setRespList)) {
      dramaData.setRespList = dramaData.setRespList.map((ep: any) => {
        const audioResp = ep.setAudioResp;
        let decNormal = "";
        let decHigh = "";
        let decSuper = "";

        if (audioResp) {
          if (audioResp.normalQualityResp?.audioUrl) {
            decNormal = decryptKilaManboAudioUrl(audioResp.normalQualityResp.audioUrl);
            audioResp.normalQualityResp.decryptedAudioUrl = decNormal;
          }
          if (audioResp.highQualityResp?.audioUrl) {
            decHigh = decryptKilaManboAudioUrl(audioResp.highQualityResp.audioUrl);
            audioResp.highQualityResp.decryptedAudioUrl = decHigh;
          }
          if (audioResp.superQualityResp?.audioUrl) {
            decSuper = decryptKilaManboAudioUrl(audioResp.superQualityResp.audioUrl);
            audioResp.superQualityResp.decryptedAudioUrl = decSuper;
          }
        }

        const cleanLrc = typeof ep.setLrcUrl === "string" ? ep.setLrcUrl.trim() : "";
        if (cleanLrc) {
          ep.setLrcUrl = cleanLrc.startsWith("//") ? `https:${cleanLrc}` : cleanLrc;
        }

        if (ep.setIdStr) {
          manboDramaSetCache.set(String(ep.setIdStr), {
            dramaId: String(dramaId),
            dramaTitle: String(dramaData.title || "KilaManbo"),
            setIdStr: String(ep.setIdStr),
            setNo: Number(ep.setNo || 0),
            setTitle: String(ep.setTitle || ep.setName || `Tập ${ep.setNo || 1}`),
            setName: ep.setName,
            desc: ep.desc,
            setPic: ep.setPic || dramaData.coverPic,
            duration: Number(ep.duration || 0),
            setLrcUrl: ep.setLrcUrl || "",
            payType: Number(ep.payType ?? 0),
            price: Number(ep.price || 0),
            normalAudioUrl: decNormal,
            highAudioUrl: decHigh,
            superAudioUrl: decSuper,
          });
        }
        return ep;
      });
    }

    return res.json({
      success: true,
      decryptedParams,
      dramaId,
      drama: dramaData,
    });
  } catch (err: any) {
    console.error("KilaManbo resolve error:", err);
    return res.status(500).json({
      error: err.message || "Lỗi xử lý đường dẫn KilaManbo",
    });
  }
});

// API: Get KilaManbo Episode Details & Decrypted Audio Stream
app.get("/api/manbo/episode", async (req, res) => {
  try {
    const dramaSetId = typeof req.query.dramaSetId === "string" ? req.query.dramaSetId.trim() : "";
    let dramaId = typeof req.query.dramaId === "string" ? req.query.dramaId.trim() : "";
    if (!dramaSetId) {
      return res.status(400).json({ error: "dramaSetId không được để trống" });
    }

    const cachedSet = manboDramaSetCache.get(dramaSetId);
    if (!dramaId && cachedSet?.dramaId) {
      dramaId = cachedSet.dramaId;
    }

    const reqCookie = typeof req.headers["x-manbo-cookie"] === "string" ? req.headers["x-manbo-cookie"] : undefined;
    const headers = buildManboHeaders(reqCookie);

    const epUrl = `https://www.kilamanbo.world/web_manbo/dramaSetDetail?dramaSetId=${encodeURIComponent(dramaSetId)}${
      dramaId ? `&dramaId=${encodeURIComponent(dramaId)}` : ""
    }`;
    const epRes = await fetch(epUrl, { headers });

    if (!epRes.ok) {
      return res.status(epRes.status).json({
        error: `Không thể kết nối đến máy chủ KilaManbo (HTTP ${epRes.status})`,
      });
    }

    const epJson = await epRes.json();
    let resolvedLrc = cachedSet?.setLrcUrl || (typeof req.query.lrcUrl === "string" ? req.query.lrcUrl.trim() : "");
    if (resolvedLrc.startsWith("//")) resolvedLrc = `https:${resolvedLrc}`;

    // If episode requires VIP/Payment authorization (code 105), utilize dramaId to extract official metadata, LRC, and audio
    if (epJson.code === 105) {
      let fullEpData: any = null;
      let decAudio = "";

      // Check if we can find this episode in cached drama or fetch dramaDetail with dramaId
      if (dramaId) {
        let dramaObj = manboDramaCache.get(dramaId);
        if (!dramaObj) {
          try {
            const dRes = await fetch(`https://www.kilamanbo.world/web_manbo/dramaDetail?dramaId=${encodeURIComponent(dramaId)}`, { headers });
            if (dRes.ok) {
              const dJson = await dRes.json();
              if (dJson.code === 200 && dJson.data) {
                dramaObj = dJson.data;
                manboDramaCache.set(dramaId, dramaObj);
              }
            }
          } catch (dErr) {
            console.warn("Fallback dramaDetail fetch warning:", dErr);
          }
        }

        if (dramaObj?.setRespList) {
          const match = dramaObj.setRespList.find((e: any) => String(e.setIdStr || e.setId) === dramaSetId);
          if (match) {
            fullEpData = match;
            if (match.setLrcUrl) {
              resolvedLrc = match.setLrcUrl.startsWith("//") ? `https:${match.setLrcUrl}` : match.setLrcUrl;
            }
            if (match.setAudioResp) {
              const a = match.setAudioResp;
              const enc = a.superQualityResp?.audioUrl || a.highQualityResp?.audioUrl || a.normalQualityResp?.audioUrl;
              if (enc) {
                decAudio = decryptKilaManboAudioUrl(enc);
              }
            }
          }
        }
      }

      if (!decAudio && cachedSet) {
        decAudio = cachedSet.superAudioUrl || cachedSet.highAudioUrl || cachedSet.normalAudioUrl || "";
      }

      const hasAudio = Boolean(decAudio);

      return res.json({
        success: true,
        isPaid: true,
        isLocked: !hasAudio,
        dramaId,
        episode: {
          setIdStr: dramaSetId,
          setTitle: fullEpData?.setTitle || fullEpData?.setName || cachedSet?.setTitle || "Tập VIP",
          setName: fullEpData?.setName || cachedSet?.setName,
          desc: fullEpData?.desc || cachedSet?.desc || "",
          setPic: fullEpData?.setPic || cachedSet?.setPic || "",
          duration: fullEpData?.duration || cachedSet?.duration || 0,
          payType: 1,
          price: fullEpData?.price || cachedSet?.price || 0,
          setLrcUrl: resolvedLrc,
          setAudioResp: fullEpData?.setAudioResp,
        },
        audioUrl: decAudio,
        setLrcUrl: resolvedLrc,
        message: hasAudio
          ? `Đã trích xuất thành công luồng âm thanh và phụ đề chính thức (.LRC) qua Drama ID (${dramaId}).`
          : `Phụ đề chính thức (.LRC) đã được trích xuất thành công qua Drama ID (${dramaId}).`,
        error: null,
      });
    }

    if (epJson.code !== 200 || !epJson.data) {
      return res.status(404).json({
        error: epJson.msg || "Không tìm thấy thông tin tập kịch này trên KilaManbo",
      });
    }

    const epData = epJson.data;
    const audioResp = epData.setAudioResp;
    let normalUrl = "";
    let highUrl = "";
    let superUrl = "";

    if (audioResp) {
      if (audioResp.normalQualityResp?.audioUrl) {
        normalUrl = decryptKilaManboAudioUrl(audioResp.normalQualityResp.audioUrl);
        audioResp.normalQualityResp.decryptedAudioUrl = normalUrl;
      }
      if (audioResp.highQualityResp?.audioUrl) {
        highUrl = decryptKilaManboAudioUrl(audioResp.highQualityResp.audioUrl);
        audioResp.highQualityResp.decryptedAudioUrl = highUrl;
      }
      if (audioResp.superQualityResp?.audioUrl) {
        superUrl = decryptKilaManboAudioUrl(audioResp.superQualityResp.audioUrl);
        audioResp.superQualityResp.decryptedAudioUrl = superUrl;
      }
    }

    const bestAudioUrl = superUrl || highUrl || normalUrl || "";
    const isPaid = epData.payType === 1 && epData.isBuy !== 1 && epData.vipFree !== 1;
    let finalLrc = epData.setLrcUrl ? epData.setLrcUrl.trim() : resolvedLrc;
    if (finalLrc.startsWith("//")) finalLrc = `https:${finalLrc}`;

    return res.json({
      success: true,
      dramaId,
      episode: epData,
      isPaid,
      audioUrl: bestAudioUrl,
      setLrcUrl: finalLrc,
    });
  } catch (err: any) {
    console.error("KilaManbo episode error:", err);
    return res.status(500).json({
      error: err.message || "Lỗi tải thông tin tập KilaManbo",
    });
  }
});

// API: Get KilaManbo Official Subtitles (LRC) & Community Danmaku
app.get("/api/manbo/subtitles", async (req, res) => {
  try {
    const dramaSetId = typeof req.query.dramaSetId === "string" ? req.query.dramaSetId.trim() : "";
    let dramaId = typeof req.query.dramaId === "string" ? req.query.dramaId.trim() : "";
    let lrcUrl = typeof req.query.lrcUrl === "string" ? req.query.lrcUrl.trim() : "";

    const cached = dramaSetId ? manboDramaSetCache.get(dramaSetId) : undefined;
    if (!dramaId && cached?.dramaId) {
      dramaId = cached.dramaId;
    }

    if (!lrcUrl && dramaSetId) {
      if (cached && cached.setLrcUrl) {
        lrcUrl = cached.setLrcUrl;
      } else if (dramaId) {
        let dramaObj = manboDramaCache.get(dramaId);
        if (!dramaObj) {
          try {
            const reqCookie = typeof req.headers["x-manbo-cookie"] === "string" ? req.headers["x-manbo-cookie"] : undefined;
            const headers = buildManboHeaders(reqCookie);
            const dRes = await fetch(`https://www.kilamanbo.world/web_manbo/dramaDetail?dramaId=${encodeURIComponent(dramaId)}`, { headers });
            if (dRes.ok) {
              const dJson = await dRes.json();
              if (dJson.code === 200 && dJson.data) {
                dramaObj = dJson.data;
                manboDramaCache.set(dramaId, dramaObj);
              }
            }
          } catch (e) {
            console.warn("Fallback dramaDetail fetch in subtitles:", e);
          }
        }
        if (dramaObj?.setRespList) {
          const match = dramaObj.setRespList.find((e: any) => String(e.setIdStr || e.setId) === dramaSetId);
          if (match?.setLrcUrl) {
            lrcUrl = match.setLrcUrl;
          }
        }
      }
    }

    if (lrcUrl.startsWith("//")) {
      lrcUrl = `https:${lrcUrl}`;
    }

    let officialItems: any[] = [];
    let rawLrc = "";

    // 1. Fetch official LRC if URL provided
    if (lrcUrl && (lrcUrl.startsWith("http://") || lrcUrl.startsWith("https://"))) {
      try {
        const lrcRes = await fetch(lrcUrl, {
          headers: {
            "User-Agent": DEFAULT_HEADERS["User-Agent"],
            Referer: "https://www.kilamanbo.world/",
          },
        });
        if (lrcRes.ok) {
          rawLrc = await lrcRes.text();
          officialItems = parseKilaManboLrcString(rawLrc);
        }
      } catch (lrcErr) {
        console.warn("Failed to fetch KilaManbo LRC:", lrcErr);
      }
    }

    // 2. Fetch danmaku timeline if dramaSetId provided
    let danmakuItems: any[] = [];
    if (dramaSetId) {
      const reqCookie = typeof req.headers["x-manbo-cookie"] === "string" ? req.headers["x-manbo-cookie"] : undefined;
      const headers = buildManboHeaders(reqCookie);
      let rawList: any[] = [];

      try {
        const dmkRes = await fetch(`https://www.kilamanbo.world/web_manbo/danmakuList?dramaSetId=${encodeURIComponent(dramaSetId)}`, { headers });
        if (dmkRes.ok) {
          const dmkJson = await dmkRes.json();
          if (dmkJson.code === 200 && typeof dmkJson.data === "string" && dmkJson.data.startsWith("http")) {
            const cdnRes = await fetch(dmkJson.data);
            if (cdnRes.ok) {
              const cdnJson = await cdnRes.json();
              if (Array.isArray(cdnJson?.danmakuList)) rawList = cdnJson.danmakuList;
              else if (Array.isArray(cdnJson)) rawList = cdnJson;
            }
          }
        }
      } catch (cdnErr) {
        console.warn("KilaManbo CDN danmaku error:", cdnErr);
      }

      if (rawList.length === 0) {
        try {
          const pgRes = await fetch(
            `https://www.kilamanbo.world/web_manbo/getDanmaKuPgList?dramaSetId=${encodeURIComponent(dramaSetId)}&pageSize=500&pageNo=1`,
            { headers }
          );
          if (pgRes.ok) {
            const pgJson = await pgRes.json();
            if (pgJson.code === 200 && Array.isArray(pgJson.data?.list)) rawList = pgJson.data.list;
          }
        } catch (pgErr) {
          console.warn("KilaManbo getDanmaKuPgList fallback error:", pgErr);
        }
      }

      danmakuItems = rawList.map((item, idx) => {
        const rawTime = typeof item.relativeTime === "number" ? item.relativeTime : 0;
        const timeInSec = rawTime > 1000 ? rawTime / 1000 : rawTime;
        const rawContent = String(item.content || "").trim();

        // Check if item contains speaker role pattern: "周其琛：高度200" or "航空兵: 来了" or "【音效】"
        let role = "Đạn mạc";
        let text = rawContent;
        let isDialogue = false;

        const colonMatch = rawContent.match(/^([^：:\n]{1,16})[：:](.*)/);
        if (colonMatch) {
          role = colonMatch[1].trim();
          text = colonMatch[2].trim();
          isDialogue = true;
        } else if (rawContent.startsWith("【") && rawContent.endsWith("】")) {
          role = "音效 / 场景";
          isDialogue = true;
        }

        const isMode4 = isDialogue || item.styleId === 3 || item.styleId === 1;

        return {
          id: String(item.danmakuId || `dmk_${idx + 1}`),
          time: Number(timeInSec.toFixed(2)),
          endTime: Number((timeInSec + 3.0).toFixed(2)),
          time_s: Math.floor(timeInSec),
          mode: isMode4 ? 4 : 1,
          size: 25,
          color: item.color ? Number(item.color) : 16777215,
          colorHex: item.color ? `#${Number(item.color).toString(16).padStart(6, "0")}` : "#FFFFFF",
          createTime: item.createTime || 0,
          pool: 0,
          userId: String(item.eid || item.userId || "danmaku"),
          dmId: String(item.danmakuId || idx + 1),
          text: text || rawContent,
          role,
          isOfficialSubtitle: false,
          danmakuSource: item.danmakuSource,
          eid: item.eid,
        };
      }).filter(it => it.text.length > 0);

      danmakuItems.sort((a, b) => a.time - b.time);
    }

    return res.json({
      success: true,
      hasOfficialLrc: officialItems.length > 0,
      officialCount: officialItems.length,
      danmakuCount: danmakuItems.length,
      officialSubtitles: officialItems,
      danmakuItems,
      rawLrc,
    });
  } catch (err: any) {
    console.error("KilaManbo subtitles error:", err);
    return res.status(500).json({ error: err.message || "Lỗi tải phụ đề KilaManbo" });
  }
});

// API: Get KilaManbo Danmaku / Subtitle Timeline
app.get("/api/manbo/danmaku", async (req, res) => {
  try {
    const dramaSetId = typeof req.query.dramaSetId === "string" ? req.query.dramaSetId.trim() : "";
    if (!dramaSetId) {
      return res.status(400).json({ error: "dramaSetId không được để trống" });
    }

    const reqCookie = typeof req.headers["x-manbo-cookie"] === "string" ? req.headers["x-manbo-cookie"] : undefined;
    const headers = buildManboHeaders(reqCookie);

    let rawList: any[] = [];

    // Step A: Attempt fast CDN JSON dump via danmakuList
    try {
      const dmkRes = await fetch(`https://www.kilamanbo.world/web_manbo/danmakuList?dramaSetId=${encodeURIComponent(dramaSetId)}`, {
        headers,
      });
      if (dmkRes.ok) {
        const dmkJson = await dmkRes.json();
        if (dmkJson.code === 200 && typeof dmkJson.data === "string" && dmkJson.data.startsWith("http")) {
          const cdnRes = await fetch(dmkJson.data);
          if (cdnRes.ok) {
            const cdnJson = await cdnRes.json();
            if (Array.isArray(cdnJson?.danmakuList)) {
              rawList = cdnJson.danmakuList;
            } else if (Array.isArray(cdnJson)) {
              rawList = cdnJson;
            }
          }
        }
      }
    } catch (cdnErr) {
      console.warn("KilaManbo CDN danmaku error:", cdnErr);
    }

    // Step B: Fallback to getDanmaKuPgList if CDN dump was empty
    if (rawList.length === 0) {
      try {
        const pgRes = await fetch(
          `https://www.kilamanbo.world/web_manbo/getDanmaKuPgList?dramaSetId=${encodeURIComponent(dramaSetId)}&pageSize=500&pageNo=1`,
          { headers }
        );
        if (pgRes.ok) {
          const pgJson = await pgRes.json();
          if (pgJson.code === 200 && Array.isArray(pgJson.data?.list)) {
            rawList = pgJson.data.list;
          }
        }
      } catch (pgErr) {
        console.warn("KilaManbo getDanmaKuPgList fallback error:", pgErr);
      }
    }

    // Normalize items into standard subtitle schema
    const normalized = rawList.map((item, idx) => {
      const rawTime = typeof item.relativeTime === "number" ? item.relativeTime : 0;
      // If time is in milliseconds (greater than 1000) or seconds
      const timeInSec = rawTime > 1000 ? rawTime / 1000 : rawTime;
      const isOfficial = item.danmakuSource === 1;

      return {
        id: String(item.danmakuId || idx + 1),
        time_s: Math.floor(timeInSec),
        time_ms: Math.round(timeInSec * 1000),
        text: String(item.content || "").trim(),
        role: isOfficial ? "Kịch bản / Lời thoại" : "Đạn mạc",
        mode: isOfficial ? "official" : "danmaku",
        color: item.color ? `#${Number(item.color).toString(16).padStart(6, "0")}` : "#FFFFFF",
      };
    }).filter(it => it.text.length > 0);

    // Sort chronologically
    normalized.sort((a, b) => a.time_ms - b.time_ms);

    return res.json({
      success: true,
      count: normalized.length,
      data: normalized,
    });
  } catch (err: any) {
    console.error("KilaManbo danmaku error:", err);
    return res.status(500).json({
      error: err.message || "Lỗi tải đạn mạc KilaManbo",
    });
  }
});

// API: Get KilaManbo Audio Stream Info (Size, Duration, Accessibility)
app.get("/api/manbo/audio-info", async (req, res) => {
  const targetUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
  const title = typeof req.query.title === "string" ? req.query.title.trim() : "kilamanbo_audio";

  if (!targetUrl || (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))) {
    return res.status(400).json({ error: "URL luồng âm thanh không hợp lệ" });
  }

  try {
    const upstreamHeaders: Record<string, string> = {
      ...DEFAULT_HEADERS,
      Referer: "https://www.kilamanbo.world/",
      Origin: "https://www.kilamanbo.world",
    };

    const headRes = await fetch(targetUrl, {
      method: "HEAD",
      headers: upstreamHeaders,
    });

    const lenStr = headRes.headers.get("content-length");
    const contentLength = lenStr ? parseInt(lenStr, 10) : null;

    return res.json({
      success: true,
      title,
      format: "mp4",
      contentLength,
      url: targetUrl,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Không thể lấy thông tin file âm thanh" });
  }
});

// API: Proxy KilaManbo audio stream with Range support and 8MB chunking for Cloud Run stability
app.get("/api/manbo/audio-proxy", async (req, res) => {
  const targetUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
  const title = typeof req.query.title === "string" ? req.query.title.trim() : "kilamanbo_audio";
  const isDownload = req.query.download === "1" || req.query.download === "true";

  if (!targetUrl || (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))) {
    return res.status(400).json({ error: "URL luồng âm thanh không hợp lệ" });
  }

  try {
    const upstreamHeaders: Record<string, string> = {
      ...DEFAULT_HEADERS,
      Referer: "https://www.kilamanbo.world/",
      Origin: "https://www.kilamanbo.world",
    };

    const safeTitle = encodeURIComponent(title.replace(/[\\/:*?"<>|]/g, "_")).replace(/%20/g, "+");
    const asciiFallback = title.replace(/[^\x20-\x7E]/g, "_").slice(0, 80).trim() || "kilamanbo_audio";
    const disposition = isDownload
      ? `attachment; filename="${asciiFallback}.mp4"; filename*=UTF-8''${safeTitle}.mp4`
      : `inline; filename="${asciiFallback}.mp4"`;

    res.setHeader("Content-Disposition", disposition);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Range, Content-Length, Content-Disposition, Accept-Ranges"
    );

    // Support chunked ranges (start/end query params or Range header)
    let rangeStart: number | null = null;
    let rangeEnd: number | null = null;
    let isExplicitRange = false;

    if (typeof req.query.start === "string") {
      const s = parseInt(req.query.start, 10);
      if (!isNaN(s) && s >= 0) {
        rangeStart = s;
        isExplicitRange = true;
        if (typeof req.query.end === "string") {
          const e = parseInt(req.query.end, 10);
          if (!isNaN(e) && e >= s) rangeEnd = e;
        }
      }
    } else if (typeof req.headers.range === "string") {
      const m = req.headers.range.match(/bytes=(\d+)-(\d*)/);
      if (m) {
        rangeStart = parseInt(m[1], 10);
        isExplicitRange = true;
        if (m[2]) {
          rangeEnd = parseInt(m[2], 10);
        }
      }
    }

    if (rangeStart !== null) {
      if (rangeEnd === null || rangeEnd - rangeStart + 1 > MAX_CHUNK_BYTES) {
        rangeEnd = rangeStart + MAX_CHUNK_BYTES - 1;
      }
      upstreamHeaders["Range"] = `bytes=${rangeStart}-${rangeEnd}`;
    }

    const upstreamRes = await fetch(targetUrl, { headers: upstreamHeaders });
    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return res.status(upstreamRes.status).json({
        error: `Không thể kết nối đến máy chủ CDN KilaManbo (HTTP ${upstreamRes.status})`,
      });
    }

    if (upstreamRes.status === 206 || isExplicitRange) {
      res.status(206);
      const contentRange = upstreamRes.headers.get("content-range");
      if (contentRange) {
        res.setHeader("Content-Range", contentRange);
      }
    } else {
      res.status(upstreamRes.status);
    }

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    if (upstreamRes.body) {
      const { Readable } = await import("stream");
      // @ts-ignore
      Readable.fromWeb(upstreamRes.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Lỗi phát luồng âm thanh KilaManbo" });
    }
  }
});

// API: Subtitle Translation Tool (Vietnamese / English / Spanish) powered by Gemini AI or Google Translate
app.post("/api/subtitles/translate", async (req, res) => {
  try {
    const { items, targetLang, dramaContext, engine } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Danh sách phụ đề cần dịch không được để trống (items array required)." });
    }

    const validLangs: SubtitleTargetLanguage[] = ["vi", "en", "es"];
    const lang = (targetLang || "vi").toLowerCase() as SubtitleTargetLanguage;
    if (!validLangs.includes(lang)) {
      return res.status(400).json({ error: "Ngôn ngữ đích không hợp lệ. Hỗ trợ: 'vi', 'en', 'es'." });
    }

    const selectedEngine: SubtitleTranslationEngine = engine === "google" ? "google" : "gemini";

    // Limit maximum lines per call to 600 for safe bounds
    const safeItems = items.slice(0, 600).map((it, idx) => ({
      id: String(it.id || idx + 1),
      text: String(it.text || "").trim(),
      role: it.role ? String(it.role).trim() : undefined,
    })).filter(it => it.text.length > 0);

    if (safeItems.length === 0) {
      return res.json({ success: true, targetLang: lang, engine: selectedEngine, count: 0, data: [] });
    }

    const translated = await translateSubtitles(safeItems, lang, dramaContext, selectedEngine);

    return res.json({
      success: true,
      targetLang: lang,
      engine: selectedEngine,
      count: translated.length,
      data: translated,
    });
  } catch (err: any) {
    console.error("Subtitle translation error:", err);
    return res.status(500).json({
      error: err.message || "Không thể dịch phụ đề. Vui lòng thử lại sau.",
    });
  }
});

// API: Fetch sound metadata
app.get("/api/missevan/sound/:id", async (req, res) => {
  const soundId = req.params.id;
  if (!soundId || !/^\d+$/.test(soundId)) {
    return res.status(400).json({ error: "Sound ID không hợp lệ. Phải là dãy số nguyên." });
  }

  try {
    const reqCookie = typeof req.headers["x-missevan-cookie"] === "string" ? req.headers["x-missevan-cookie"] : undefined;
    const url = `https://www.missevan.com/sound/getsound?soundid=${soundId}`;
    const response = await fetch(url, {
      headers: buildMissEvanHeaders(`https://www.missevan.com/sound/player?id=${soundId}`, reqCookie),
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Không thể kết nối đến máy chủ MissEvan (HTTP ${response.status})`,
      });
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return res.json(data);
    } catch {
      return res.status(502).json({
        error: "Máy chủ MissEvan trả về phản hồi không hợp lệ hoặc yêu cầu xác thực captcha.",
        raw: text.slice(0, 300),
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Lỗi máy chủ nội bộ khi tải thông tin âm thanh" });
  }
});

// API: Fetch Danmaku XML
app.get("/api/missevan/danmaku/:id", async (req, res) => {
  const soundId = req.params.id;
  if (!soundId || !/^\d+$/.test(soundId)) {
    return res.status(400).json({ error: "Sound ID không hợp lệ" });
  }

  try {
    const reqCookie = typeof req.headers["x-missevan-cookie"] === "string" ? req.headers["x-missevan-cookie"] : undefined;
    const url = `https://www.missevan.com/sound/getdm?soundid=${soundId}`;
    const response = await fetch(url, {
      headers: buildMissEvanHeaders(`https://www.missevan.com/sound/player?id=${soundId}`, reqCookie),
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Không thể tải đạn mạc/phụ đề từ MissEvan (HTTP ${response.status})`,
      });
    }

    const xml = await response.text();
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.send(xml);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Lỗi khi tải đạn mạc" });
  }
});

// API: Fetch Official Subtitles (MaoEr FM official bottom subtitles JSON)
app.get("/api/missevan/subtitle/:id", async (req, res) => {
  const soundId = req.params.id;
  if (!soundId || !/^\d+$/.test(soundId)) {
    return res.status(400).json({ error: "Sound ID không hợp lệ" });
  }

  try {
    const reqCookie = typeof req.headers["x-missevan-cookie"] === "string" ? req.headers["x-missevan-cookie"] : undefined;
    const url = `https://www.missevan.com/sound/getsound?soundid=${soundId}`;
    const response = await fetch(url, {
      headers: buildMissEvanHeaders(`https://www.missevan.com/sound/player?id=${soundId}`, reqCookie),
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Không thể kết nối đến máy chủ MissEvan (HTTP ${response.status})`,
      });
    }

    const data = await response.json();
    const sound = data?.info?.sound;
    if (!sound) {
      return res.status(404).json({ error: "Không tìm thấy thông tin âm thanh trên MissEvan" });
    }

    const isPaid = sound.need_pay === 1 || sound.pay_type === 2;
    const hasOfficialNotice = typeof sound.intro === "string" && (sound.intro.includes("字幕") || sound.intro.includes("SRT"));

    if (sound.subtitle_url && typeof sound.subtitle_url === "string") {
      let cleanUrl = sound.subtitle_url.trim();
      if (cleanUrl.startsWith("//")) {
        cleanUrl = `https:${cleanUrl}`;
      }
      try {
        const subRes = await fetch(cleanUrl, {
          headers: {
            ...DEFAULT_HEADERS,
            Referer: `https://www.missevan.com/sound/player?id=${soundId}`,
          },
        });

        if (subRes.ok) {
          const subData = await subRes.json();
          return res.json({
            success: true,
            isOfficial: true,
            subtitle_url: cleanUrl,
            soundId,
            title: sound.soundstr,
            isPaid,
            data: subData,
          });
        }
      } catch (subErr: any) {
        console.error("Failed to fetch subtitle JSON from CDN:", subErr);
      }
    }

    return res.json({
      success: false,
      isOfficial: false,
      isPaid,
      needPay: sound.need_pay === 1,
      price: sound.price || 0,
      hasOfficialSubNotice: hasOfficialNotice,
      soundId,
      title: sound.soundstr,
      error: isPaid
        ? "Tập này là tập VIP trả phí trên MissEvan. MissEvan yêu cầu Cookie tài khoản đã mua tập này để tải phụ đề chính thức (Official Subtitles). Nếu bạn chưa cài Cookie, hãy nhập Cookie MissEvan hoặc xem đạn mạc bình luận thường."
        : "Không tìm thấy phụ đề chính thức riêng biệt cho tập này. Bạn có thể sử dụng phụ đề từ đạn mạc (Danmaku).",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Lỗi khi tải phụ đề chính thức" });
  }
});

// API: Proxy or fetch arbitrary MaoEr subtitle URL
app.post("/api/missevan/subtitle/proxy", async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Thiếu URL phụ đề" });
  }

  let cleanUrl = url.trim();
  if (cleanUrl.startsWith("//")) {
    cleanUrl = `https:${cleanUrl}`;
  }

  try {
    const parsed = new URL(cleanUrl);
    if (!parsed.hostname.includes("missevan.com") && !parsed.hostname.includes("maoercdn.com")) {
      return res.status(400).json({ error: "Chỉ hỗ trợ URL từ máy chủ MissEvan hoặc MaoEr CDN" });
    }

    const subRes = await fetch(cleanUrl, {
      headers: DEFAULT_HEADERS,
    });

    if (!subRes.ok) {
      return res.status(subRes.status).json({ error: `Không thể tải file phụ đề từ CDN (HTTP ${subRes.status})` });
    }

    const text = await subRes.text();
    try {
      const json = JSON.parse(text);
      return res.json({ success: true, data: json });
    } catch {
      return res.send(text);
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Lỗi khi proxy phụ đề" });
  }
});

// Helper to enrich drama episodes with individual cover images from getdramasounds
async function enrichDramaEpisodesWithCovers(dramaData: any, dramaId: string | number, reqCookie?: string) {
  if (!dramaData || !dramaData.info || !dramaData.info.episodes) return dramaData;

  try {
    const soundsUrl = `https://www.missevan.com/dramaapi/getdramasounds?drama_id=${dramaId}`;
    const soundsRes = await fetch(soundsUrl, {
      headers: buildMissEvanHeaders(`https://www.missevan.com/drama/${dramaId}`, reqCookie),
    });

    if (soundsRes.ok) {
      const soundsJson = await soundsRes.json();
      const soundList = Object.values(soundsJson?.info || {});
      const soundMap = new Map<string, any>();
      for (const item of soundList as any[]) {
        if (item && item.id) {
          soundMap.set(String(item.id), item);
        }
      }

      const mergeCovers = (epList: any[]) => {
        if (!Array.isArray(epList)) return;
        for (const ep of epList) {
          const match = soundMap.get(String(ep.sound_id));
          if (match) {
            if (match.front_cover) ep.front_cover = match.front_cover;
            if (match.cover_image) ep.cover_image = match.cover_image;
            if (!ep.soundstr && match.soundstr) ep.soundstr = match.soundstr;
          }
        }
      };

      mergeCovers(dramaData.info.episodes.episode);
      mergeCovers(dramaData.info.episodes.ft);
      mergeCovers(dramaData.info.episodes.music);
    }
  } catch (err) {
    // Non-fatal if getdramasounds fails
    console.warn("Failed to enrich drama episodes with covers:", err);
  }

  return dramaData;
}

// API: Download or proxy cover image
app.get("/api/missevan/cover/download", async (req, res) => {
  const rawUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
  let rawFilename = typeof req.query.filename === "string" ? req.query.filename.trim() : "cover.jpg";
  if (!rawUrl) {
    return res.status(400).json({ error: "Thiếu URL ảnh bìa" });
  }

  let targetUrl = rawUrl;
  if (targetUrl.startsWith("//")) {
    targetUrl = `https:${targetUrl}`;
  } else if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = targetUrl.startsWith("/")
      ? `https://static.maoercdn.com${targetUrl}`
      : `https://static.maoercdn.com/covers/${targetUrl}`;
  }

  try {
    const parsed = new URL(targetUrl);
    if (!parsed.hostname.includes("missevan.com") && !parsed.hostname.includes("maoercdn.com")) {
      return res.status(400).json({ error: "Chỉ hỗ trợ tải ảnh từ MissEvan hoặc MaoEr CDN" });
    }

    const cdnHeaders: Record<string, string> = {
      ...DEFAULT_HEADERS,
      Referer: "https://www.missevan.com/",
    };

    // Candidates in priority order (HD uncompressed first, then thumbnail fallback)
    const candidates: string[] = [];
    if (targetUrl.includes("/coversmini/")) {
      candidates.push(targetUrl.replace("/coversmini/", "/covers/"));
      candidates.push(targetUrl);
    } else if (targetUrl.includes("/mosaic/")) {
      candidates.push(targetUrl.replace("/mosaic/", "/covers/"));
      candidates.push(targetUrl);
    } else if (targetUrl.includes("/covers/")) {
      candidates.push(targetUrl);
      candidates.push(targetUrl.replace("/covers/", "/coversmini/"));
    } else {
      candidates.push(targetUrl);
    }

    let imgRes: Response | null = null;
    let imgBuffer: Buffer | null = null;

    for (const url of candidates) {
      try {
        const fetchRes = await fetch(url, { headers: cdnHeaders });
        if (fetchRes.ok) {
          const buf = Buffer.from(await fetchRes.arrayBuffer());
          // Verify it is not an HTML error or empty response
          if (buf.length > 32 && buf[0] !== 0x3c && buf[0] !== 0x7b) {
            imgRes = fetchRes;
            imgBuffer = buf;
            break;
          }
        }
      } catch {
        // try next candidate
      }
    }

    if (!imgBuffer || imgBuffer.length === 0) {
      return res.status(404).json({ error: "Không thể tải dữ liệu ảnh bìa hợp lệ từ máy chủ MissEvan" });
    }

    // Inspect magic bytes to determine true image format
    let detectedMime = "image/jpeg";
    let detectedExt = "jpg";

    if (
      imgBuffer.length >= 8 &&
      imgBuffer[0] === 0x89 &&
      imgBuffer[1] === 0x50 &&
      imgBuffer[2] === 0x4e &&
      imgBuffer[3] === 0x47
    ) {
      detectedMime = "image/png";
      detectedExt = "png";
    } else if (imgBuffer.length >= 3 && imgBuffer[0] === 0xff && imgBuffer[1] === 0xd8 && imgBuffer[2] === 0xff) {
      detectedMime = "image/jpeg";
      detectedExt = "jpg";
    } else if (
      imgBuffer.length >= 12 &&
      imgBuffer[0] === 0x52 &&
      imgBuffer[1] === 0x49 &&
      imgBuffer[2] === 0x46 &&
      imgBuffer[3] === 0x46 &&
      imgBuffer[8] === 0x57 &&
      imgBuffer[9] === 0x45 &&
      imgBuffer[10] === 0x42 &&
      imgBuffer[11] === 0x50
    ) {
      detectedMime = "image/webp";
      detectedExt = "webp";
    } else if (imgBuffer.length >= 4 && imgBuffer[0] === 0x47 && imgBuffer[1] === 0x49 && imgBuffer[2] === 0x46 && imgBuffer[3] === 0x38) {
      detectedMime = "image/gif";
      detectedExt = "gif";
    }

    // Ensure the filename extension strictly matches the actual image format
    // (Prevents Windows Photo Viewer error: "It looks like we don't support this file format")
    let finalFilename = rawFilename;
    const extRegex = /\.(jpe?g|png|webp|gif|bmp)$/i;
    if (extRegex.test(finalFilename)) {
      finalFilename = finalFilename.replace(extRegex, `.${detectedExt}`);
    } else {
      finalFilename = `${finalFilename}.${detectedExt}`;
    }

    const safeAscii = finalFilename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "");

    res.setHeader("Content-Type", detectedMime);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(finalFilename)}`
    );
    res.setHeader("Content-Length", imgBuffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(imgBuffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Lỗi khi tải ảnh bìa" });
  }
});

// API: Fetch Drama / Series Info & Episodes list
app.get("/api/missevan/drama/:id", async (req, res) => {
  const dramaId = req.params.id;
  if (!dramaId || !/^\d+$/.test(dramaId)) {
    return res.status(400).json({ error: "Invalid Drama ID. Must be a numeric string." });
  }

  try {
    const reqCookie = typeof req.headers["x-missevan-cookie"] === "string" ? req.headers["x-missevan-cookie"] : undefined;
    const url = `https://www.missevan.com/dramaapi/getdrama?drama_id=${dramaId}`;
    const response = await fetch(url, {
      headers: buildMissEvanHeaders(`https://www.missevan.com/drama/${dramaId}`, reqCookie),
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch drama from MissEvan (HTTP ${response.status})`,
      });
    }

    const data = await response.json();
    const enriched = await enrichDramaEpisodesWithCovers(data, dramaId, reqCookie);
    return res.json(enriched);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch drama information" });
  }
});

// API: Fetch Drama / Series Info by Sound ID
app.get("/api/missevan/drama/by-sound/:soundId", async (req, res) => {
  const soundId = req.params.soundId;
  if (!soundId || !/^\d+$/.test(soundId)) {
    return res.status(400).json({ error: "Invalid Sound ID." });
  }

  try {
    const reqCookie = typeof req.headers["x-missevan-cookie"] === "string" ? req.headers["x-missevan-cookie"] : undefined;
    const url = `https://www.missevan.com/dramaapi/getdramabysound?sound_id=${soundId}`;
    const response = await fetch(url, {
      headers: buildMissEvanHeaders(`https://www.missevan.com/sound/player?id=${soundId}`, reqCookie),
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to query drama for sound ${soundId} (HTTP ${response.status})`,
      });
    }

    const data = await response.json();
    const dramaId = data?.info?.drama?.id;
    if (dramaId) {
      const enriched = await enrichDramaEpisodesWithCovers(data, dramaId, reqCookie);
      return res.json(enriched);
    }
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to find drama for this sound" });
  }
});

const requireCjs = createRequire(import.meta.url);
let drmSdkPromise: Promise<any> | null = null;
let cachedDrmCert: ArrayBuffer | null = null;
const drmKeyCache = new Map<string, { key: Buffer; iv: Buffer }>();

async function getDrmKeyAndIv(bilidrmUri: string): Promise<{ key: Buffer; iv: Buffer }> {
  const kid = bilidrmUri.replace("uri:bili://", "").trim();
  const cached = drmKeyCache.get(kid);
  if (cached) return cached;

  if (!drmSdkPromise) {
    const BiliDRMSDKModuleFactory = requireCjs("./src/server/biliDrmSdk.cjs");
    drmSdkPromise = BiliDRMSDKModuleFactory();
  }
  const sdk = await drmSdkPromise;

  if (!cachedDrmCert) {
    const certRes = await fetch("https://bvc-drm.bilivideo.com/cer/bilidrm_pub.key");
    cachedDrmCert = await certRes.arrayBuffer();
  }

  const aesKey = crypto.randomBytes(16).toString("base64");
  const spcRes = sdk.biliDRMGenSPC(kid, aesKey, cachedDrmCert);
  const licRes = await fetch("https://bvc-drm.bilivideo.com/bilidrm", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ spc: spcRes.spc }),
  }).then((r) => r.json());

  const ckcBytes = new Uint8Array(Buffer.from(licRes.ckc, "base64"));
  const parsed = sdk.biliDRMParseCKC(ckcBytes, aesKey);
  const result = {
    key: Buffer.from(Buffer.from(parsed.key).toString("ascii"), "base64"),
    iv: Buffer.from(Buffer.from(parsed.iv).toString("ascii"), "base64"),
  };
  drmKeyCache.set(kid, result);
  return result;
}

function createCbcsDecryptStream(key: Buffer, iv: Buffer): Transform {
  let buffer = Buffer.alloc(0);
  let pendingSampleSizes: number[] = [];

  function processBox(box: Buffer): Buffer {
    const size = box.readUInt32BE(0);
    const type = box.subarray(4, 8).toString("ascii");

    if (type === "moov") {
      for (let i = 8; i <= size - 8; i++) {
        const subType = box.subarray(i + 4, i + 8).toString("ascii");
        if (subType === "enca") {
          box.write("mp4a", i + 4, 4, "ascii");
        } else if (subType === "sinf") {
          const sinfSize = box.readUInt32BE(i);
          if (sinfSize >= 8 && i + sinfSize <= size) {
            box.write("free", i + 4, 4, "ascii");
            box.fill(0, i + 8, i + sinfSize);
            i += sinfSize - 1;
          }
        }
      }
    } else if (type === "moof") {
      pendingSampleSizes = [];
      let mpos = 8;
      while (mpos + 8 <= size) {
        const msize = box.readUInt32BE(mpos);
        const mtype = box.subarray(mpos + 4, mpos + 8).toString("ascii");
        if (msize < 8 || mpos + msize > size) break;
        if (mtype === "traf") {
          let tpos = mpos + 8;
          const trafEnd = mpos + msize;
          let defaultSampleSize = 0;
          while (tpos + 8 <= trafEnd) {
            const tsize = box.readUInt32BE(tpos);
            const ttype = box.subarray(tpos + 4, tpos + 8).toString("ascii");
            if (tsize < 8 || tpos + tsize > trafEnd) break;
            if (ttype === "tfhd") {
              const tfFlags = box.readUInt32BE(tpos + 8) & 0xffffff;
              let c = tpos + 16;
              if (tfFlags & 0x01) c += 8;
              if (tfFlags & 0x02) c += 4;
              if (tfFlags & 0x08) c += 4;
              if (tfFlags & 0x10) defaultSampleSize = box.readUInt32BE(c);
            } else if (ttype === "trun") {
              const flags = box.readUInt32BE(tpos + 8) & 0xffffff;
              const sampleCount = box.readUInt32BE(tpos + 12);
              let cursor = tpos + 16;
              if (flags & 0x01) cursor += 4;
              if (flags & 0x04) cursor += 4;
              for (let s = 0; s < sampleCount; s++) {
                if (flags & 0x100) cursor += 4;
                const sampleSize = flags & 0x200 ? box.readUInt32BE(cursor) : defaultSampleSize;
                if (flags & 0x200) cursor += 4;
                if (flags & 0x400) cursor += 4;
                if (flags & 0x800) cursor += 4;
                pendingSampleSizes.push(sampleSize);
              }
            } else if (["saiz", "saio", "senc"].includes(ttype)) {
              box.write("free", tpos + 4, 4, "ascii");
              box.fill(0, tpos + 8, tpos + tsize);
            }
            tpos += tsize;
          }
        }
        mpos += msize;
      }
    } else if (type === "mdat" && pendingSampleSizes.length > 0) {
      let samplePos = 8;
      for (const sampleSize of pendingSampleSizes) {
        if (sampleSize > 0 && samplePos + sampleSize <= size) {
          const encLen = Math.floor(sampleSize / 16) * 16;
          if (encLen > 0) {
            const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
            decipher.setAutoPadding(false);
            const dec = Buffer.concat([
              decipher.update(box.subarray(samplePos, samplePos + encLen)),
              decipher.final(),
            ]);
            dec.copy(box, samplePos);
          }
        }
        samplePos += sampleSize;
      }
      pendingSampleSizes = [];
    }
    return box;
  }

  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 8) {
        const boxSize = buffer.readUInt32BE(0);
        if (boxSize < 8 || buffer.length < boxSize) break;
        const box = Buffer.from(buffer.subarray(0, boxSize));
        buffer = buffer.subarray(boxSize);
        this.push(processBox(box));
      }
      cb();
    },
    flush(cb) {
      if (buffer.length > 0) this.push(buffer);
      cb();
    },
  });
}

export interface AudioTrackOption {
  id: number | string;
  bandwidth: number;
  bitrateKbps: number;
  label: string;
  size?: number | null;
  codecs?: string;
  streamUrl: string;
  bilidrmUri?: string | null;
}

export interface ResolvedAudioSource {
  title: string;
  streamUrl: string | null;
  format: string;
  contentLength?: number | null;
  bilidrmUri?: string | null;
  isPaid?: boolean;
  price?: number;
  bitrateKbps?: number;
  qualityLabel?: string;
  availableTracks?: AudioTrackOption[];
  expiresAt: number;
}

const resolvedAudioCache = new Map<string, ResolvedAudioSource>();

// Helper: Resolve direct audio stream for a given sound ID (extracts highest bitrate / master track)
async function resolveAudioSource(
  soundId: string,
  reqCookie?: string,
  qualityPref?: string
): Promise<ResolvedAudioSource> {
  const effectiveCookie = normalizeMissEvanCookie(reqCookie || savedMissEvanCookie);
  const normalizedPref = (qualityPref || "highest").toLowerCase();
  const cacheKey = `${soundId}::${effectiveCookie}::${normalizedPref}`;
  const cached = resolvedAudioCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() && cached.streamUrl) {
    return cached;
  }

  const url = `https://www.missevan.com/sound/getsound?soundid=${soundId}`;
  const headers = buildMissEvanHeaders(`https://www.missevan.com/sound/player?id=${soundId}`, reqCookie);
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Không thể kết nối đến máy chủ MissEvan (HTTP ${response.status})`);
  }

  const data = await response.json();
  const sound = data?.info?.sound;
  if (!sound) {
    throw new Error("Không tìm thấy thông tin âm thanh trên MissEvan");
  }

  const title = sound.soundstr || `sound_${soundId}`;
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const durationSec = typeof sound.duration === "number" && sound.duration > 0 ? sound.duration : 0;

  // Priority 1: dash.audio (contains direct CDN .m4s ISO MP4/M4A streams, exact file sizes & multi-bitrate tracks)
  if (Array.isArray(sound.dash?.audio) && sound.dash.audio.length > 0) {
    const validTracks: AudioTrackOption[] = [];
    for (const a of sound.dash.audio) {
      if (a && typeof a.base_url === "string" && a.base_url.startsWith("http")) {
        let kbps = 0;
        if (typeof a.bandwidth === "number" && a.bandwidth > 0) {
          kbps = Math.round(a.bandwidth / 1000);
        } else if (typeof a.size === "number" && a.size > 0 && durationSec > 0) {
          kbps = Math.round((a.size * 8) / (durationSec * 1000));
        } else if (typeof a.id === "number") {
          kbps = a.id === 64 ? 328 : a.id;
        }

        const isOriginal =
          (typeof a.base_url === "string" && a.base_url.includes("-original")) ||
          a.id === 64 ||
          kbps >= 300;
        const label = isOriginal
          ? `${kbps} kbps (Bản Gốc / Master)`
          : kbps >= 128
          ? `${kbps} kbps (Tiêu chuẩn)`
          : `${kbps} kbps`;

        validTracks.push({
          id: a.id,
          bandwidth: a.bandwidth || (kbps * 1000),
          bitrateKbps: kbps,
          label,
          size: typeof a.size === "number" ? a.size : null,
          codecs: a.codecs,
          streamUrl: a.base_url,
          bilidrmUri: typeof a.bilidrm_uri === "string" ? a.bilidrm_uri : null,
        });
      }
    }

    if (validTracks.length > 0) {
      // Sort tracks: highest bandwidth first, then largest size first
      validTracks.sort((t1, t2) => (t2.bandwidth - t1.bandwidth) || ((t2.size || 0) - (t1.size || 0)));

      let chosenTrack: AudioTrackOption;
      if (normalizedPref === "128" || normalizedPref === "standard") {
        chosenTrack = validTracks.find((t) => t.bitrateKbps <= 160) || validTracks[validTracks.length - 1];
      } else {
        // Default to HIGHEST available quality (e.g. 413 kbps / 328 kbps original studio stream)
        chosenTrack = validTracks[0];
      }

      const resObj: ResolvedAudioSource = {
        title,
        streamUrl: chosenTrack.streamUrl,
        format: "m4a",
        bitrateKbps: chosenTrack.bitrateKbps,
        qualityLabel: chosenTrack.label,
        availableTracks: validTracks,
        contentLength: chosenTrack.size,
        bilidrmUri: chosenTrack.bilidrmUri,
        isPaid: false,
        expiresAt,
      };
      resolvedAudioCache.set(cacheKey, resObj);
      return resObj;
    }
  }

  // Priority 2: videourl (standard high-res direct media)
  if (sound.videourl && typeof sound.videourl === "string" && sound.videourl.startsWith("http")) {
    const resObj: ResolvedAudioSource = {
      title,
      streamUrl: sound.videourl,
      format: "m4a",
      bitrateKbps: 320,
      qualityLabel: "320 kbps (High Quality)",
      isPaid: false,
      expiresAt,
    };
    resolvedAudioCache.set(cacheKey, resObj);
    return resObj;
  }

  // Priority 3: candidate audio urls
  // Notice: In MissEvan, sound.soundurl points to original high-quality stream (or master HLS mapping to -original.m4s),
  // whereas soundurl_128 is specifically downsampled to 128kbps.
  const candidateUrl =
    normalizedPref === "128" || normalizedPref === "standard"
      ? sound.soundurl_128 || sound.soundurl || sound.soundurl_64
      : sound.soundurl || sound.soundurl_320 || sound.soundurl_128 || sound.soundurl_64;

  if (!candidateUrl) {
    return {
      title,
      streamUrl: null,
      format: "m4a",
      isPaid: true,
      price: sound.price || 0,
      expiresAt,
    };
  }

  // Check if HLS playlist (.m3u8)
  if (candidateUrl.includes(".m3u8")) {
    const m3u8Res = await fetch(candidateUrl, { headers });

    if (m3u8Res.ok) {
      let text = await m3u8Res.text();

      // If master multi-variant playlist, choose highest bandwidth sub-playlist
      if (text.includes("#EXT-X-STREAM-INF")) {
        const lines = text.split("\n");
        let highestVariantUrl = "";
        let maxBw = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith("#EXT-X-STREAM-INF")) {
            const bwMatch = line.match(/BANDWIDTH=(\d+)/);
            const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;
            const next = (lines[i + 1] || "").trim();
            if (next && !next.startsWith("#")) {
              if (bw >= maxBw || !highestVariantUrl) {
                maxBw = bw;
                highestVariantUrl = next.startsWith("http")
                  ? next
                  : new URL(next, candidateUrl).toString();
              }
            }
          }
        }
        if (highestVariantUrl) {
          const subRes = await fetch(highestVariantUrl, { headers });
          if (subRes.ok) text = await subRes.text();
        }
      }

      // Bento4 / MaoEr CDN mp4-dash container
      const mapMatch = text.match(/#EXT-X-MAP:URI="([^"]+)"/);
      if (mapMatch && mapMatch[1]) {
        const keyMatch = text.match(/URI="uri:skd:\/\/([^"]+)"/);
        const streamUrl = mapMatch[1];
        const isOrig = streamUrl.includes("-original") || candidateUrl.includes("quality_id=64");
        const bitrateKbps = isOrig ? 328 : 128;
        const resObj: ResolvedAudioSource = {
          title,
          streamUrl,
          format: "m4a",
          bitrateKbps,
          qualityLabel: isOrig ? `${bitrateKbps} kbps (Bản Gốc / Master)` : `${bitrateKbps} kbps`,
          bilidrmUri: keyMatch && keyMatch[1] ? `uri:bili://${keyMatch[1]}` : null,
          isPaid: false,
          expiresAt,
        };
        resolvedAudioCache.set(cacheKey, resObj);
        return resObj;
      }

      // If plain segments are present without MAP
      const lines = text.split("\n");
      const segmentLine = lines.find(
        (l) => l.trim().startsWith("http") || l.trim().endsWith(".ts") || l.trim().endsWith(".m4s")
      );
      if (segmentLine) {
        const segUrl = segmentLine.trim().startsWith("http")
          ? segmentLine.trim()
          : new URL(segmentLine.trim(), candidateUrl).toString();
        const resObj: ResolvedAudioSource = {
          title,
          streamUrl: segUrl,
          format: "m4a",
          bitrateKbps: 320,
          qualityLabel: "320 kbps (High Quality)",
          isPaid: false,
          expiresAt,
        };
        resolvedAudioCache.set(cacheKey, resObj);
        return resObj;
      }
    }
  }

  const format = candidateUrl.includes(".mp3") ? "mp3" : "m4a";
  const resObj: ResolvedAudioSource = {
    title,
    streamUrl: candidateUrl,
    format,
    bitrateKbps: 320,
    qualityLabel: "320 kbps (High Quality)",
    isPaid: false,
    expiresAt,
  };
  resolvedAudioCache.set(cacheKey, resObj);
  return resObj;
}

// API: Get audio file info (size, direct URL, title, VIP status, bitrate)
app.get("/api/missevan/audio/:id/info", async (req, res) => {
  const soundId = req.params.id;
  if (!soundId || !/^\d+$/.test(soundId)) {
    return res.status(400).json({ error: "Sound ID không hợp lệ" });
  }

  try {
    const reqCookie = typeof req.headers["x-missevan-cookie"] === "string" ? req.headers["x-missevan-cookie"] : undefined;
    const qualityPref = typeof req.query.quality === "string" ? req.query.quality : undefined;
    const audioInfo = await resolveAudioSource(soundId, reqCookie, qualityPref);

    if (audioInfo.isPaid || !audioInfo.streamUrl) {
      return res.status(200).json({
        success: false,
        isPaid: true,
        soundId,
        title: audioInfo.title,
        format: "m4a",
        price: audioInfo.price || 0,
        error: "Tập VIP trả phí trên MissEvan — Cần nhập Cookie tài khoản đã mua để tải audio (Phụ đề vẫn tải miễn phí)",
      });
    }

    let contentLength: number | null = audioInfo.contentLength ?? null;

    if (!contentLength) {
      try {
        const headRes = await fetch(audioInfo.streamUrl, {
          method: "HEAD",
          headers: buildMissEvanHeaders(`https://www.missevan.com/sound/player?id=${soundId}`, reqCookie),
        });
        const len = headRes.headers.get("content-length");
        if (len) contentLength = parseInt(len, 10);
      } catch {
        // Non-fatal if HEAD fails
      }
    }

    return res.json({
      success: true,
      isPaid: false,
      soundId,
      title: audioInfo.title,
      format: audioInfo.format,
      bitrateKbps: audioInfo.bitrateKbps,
      qualityLabel: audioInfo.qualityLabel,
      availableTracks: audioInfo.availableTracks,
      contentLength,
      downloadUrl: `/api/missevan/audio/${soundId}/download${qualityPref ? `?quality=${qualityPref}` : ""}`,
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      soundId,
      error: err.message || "Không thể lấy thông tin file âm thanh",
    });
  }
});

interface DecryptedStreamEntry {
  cacheKey: string;
  totalBytes: number;
  buffer: Buffer;
  writtenBytes: number;
  done: boolean;
  error: Error | null;
  waiters: Array<() => void>;
  lastAccessed: number;
}

let activeDecryptedEntry: DecryptedStreamEntry | null = null;

async function getDecryptedAudioRange(
  soundId: string,
  audioInfo: ResolvedAudioSource,
  reqCookie: string | undefined,
  start: number,
  end: number
): Promise<{ slice: Buffer; start: number; end: number; totalBytes: number }> {
  const entryKey = `${soundId}::${audioInfo.streamUrl || audioInfo.bilidrmUri || ""}`;

  if (
    !activeDecryptedEntry ||
    activeDecryptedEntry.cacheKey !== entryKey ||
    activeDecryptedEntry.error ||
    Date.now() - activeDecryptedEntry.lastAccessed > 3 * 60 * 1000
  ) {
    const { key, iv } = await getDrmKeyAndIv(audioInfo.bilidrmUri!);
    const upstreamHeaders = buildMissEvanHeaders(
      `https://www.missevan.com/sound/player?id=${soundId}`,
      reqCookie
    );
    const upstreamRes = await fetch(audioInfo.streamUrl!, { headers: upstreamHeaders });
    if (!upstreamRes.ok || !upstreamRes.body) {
      throw new Error(`Không thể tải luồng âm thanh từ CDN (HTTP ${upstreamRes.status})`);
    }

    const upstreamLen = parseInt(upstreamRes.headers.get("content-length") || "0", 10);
    const expectedTotal = upstreamLen || audioInfo.contentLength || 0;
    const initialCap = expectedTotal > 0 ? expectedTotal : 64 * 1024 * 1024;

    const entry: DecryptedStreamEntry = {
      cacheKey: entryKey,
      totalBytes: expectedTotal,
      buffer: Buffer.allocUnsafe(initialCap),
      writtenBytes: 0,
      done: false,
      error: null,
      waiters: [],
      lastAccessed: Date.now(),
    };
    activeDecryptedEntry = entry;

    const { Readable } = await import("stream");
    const nodeStream = Readable.fromWeb(upstreamRes.body as any);
    const decryptStream = createCbcsDecryptStream(key, iv);

    const notifyWaiters = () => {
      const list = entry.waiters.splice(0);
      for (const fn of list) fn();
    };

    decryptStream.on("data", (chunk: Buffer) => {
      if (entry.writtenBytes + chunk.length > entry.buffer.length) {
        const nextBuf = Buffer.allocUnsafe(Math.max(entry.buffer.length * 2, entry.writtenBytes + chunk.length));
        entry.buffer.copy(nextBuf, 0, 0, entry.writtenBytes);
        entry.buffer = nextBuf;
      }
      chunk.copy(entry.buffer, entry.writtenBytes);
      entry.writtenBytes += chunk.length;
      notifyWaiters();
    });

    decryptStream.on("end", () => {
      entry.totalBytes = entry.writtenBytes;
      entry.done = true;
      notifyWaiters();
    });

    decryptStream.on("error", (err: Error) => {
      entry.error = err;
      entry.done = true;
      notifyWaiters();
    });

    nodeStream.on("error", (err: Error) => {
      entry.error = err;
      entry.done = true;
      notifyWaiters();
    });

    nodeStream.pipe(decryptStream);
  }

  const entry = activeDecryptedEntry!;
  entry.lastAccessed = Date.now();

  const targetEnd = entry.totalBytes > 0 ? Math.min(end, entry.totalBytes - 1) : end;
  while (!entry.done && entry.writtenBytes <= targetEnd) {
    await new Promise<void>((resolve) => {
      entry.waiters.push(resolve);
    });
  }

  if (entry.error && entry.writtenBytes <= start) {
    throw entry.error;
  }

  const finalTotal = entry.totalBytes || entry.writtenBytes;
  if (start >= finalTotal) {
    return {
      slice: Buffer.alloc(0),
      start,
      end: Math.max(0, finalTotal - 1),
      totalBytes: finalTotal,
    };
  }

  const actualEnd = Math.min(targetEnd, entry.writtenBytes - 1);
  const slice = entry.buffer.subarray(start, actualEnd + 1);
  return { slice, start, end: actualEnd, totalBytes: finalTotal };
}

// API: Download or Stream Audio File (Supports 8MB chunked/range transfers for Cloud Run compatibility)
app.get("/api/missevan/audio/:id/download", async (req, res) => {
  const soundId = req.params.id;
  if (!soundId || !/^\d+$/.test(soundId)) {
    return res.status(400).json({ error: "Sound ID không hợp lệ" });
  }

  try {
    const reqCookie =
      (typeof req.query.cookie === "string" ? req.query.cookie : undefined) ||
      (typeof req.headers["x-missevan-cookie"] === "string" ? req.headers["x-missevan-cookie"] : undefined);
    const qualityPref = typeof req.query.quality === "string" ? req.query.quality : undefined;

    const audioInfo = await resolveAudioSource(soundId, reqCookie, qualityPref);

    if (audioInfo.isPaid || !audioInfo.streamUrl) {
      return res.status(403).json({
        success: false,
        isPaid: true,
        error: "Tập này yêu cầu tài khoản VIP / đã mua trên MissEvan. Vui lòng nhập Cookie MissEvan để tải âm thanh.",
      });
    }

    const customName = typeof req.query.customName === "string" ? req.query.customName : null;
    const baseName = customName || audioInfo.title || `MissEvan_${soundId}`;
    const safeTitle = baseName.replace(/[\\/:*?"<>|]/g, "_").slice(0, 100).trim();
    const extension = audioInfo.format === "mp3" ? "mp3" : "m4a";
    const filename = `${safeTitle}.${extension}`;
    const contentType = extension === "mp3" ? "audio/mpeg" : "audio/mp4";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Range, Content-Length, Content-Disposition, Accept-Ranges"
    );

    const isAttachment = req.query.stream !== "true" && typeof req.query.start !== "string";
    if (isAttachment) {
      const asciiFallback = safeTitle.replace(/[^\x20-\x7E]/g, "_") + `.${extension}`;
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
      );
    }

    // Parse byte range from query (?start=X&end=Y) or Range header (bytes=X-Y)
    let rangeStart: number | null = null;
    let rangeEnd: number | null = null;
    let isExplicitRange = false;

    if (typeof req.query.start === "string") {
      const s = parseInt(req.query.start, 10);
      if (!isNaN(s) && s >= 0) {
        rangeStart = s;
        isExplicitRange = true;
        if (typeof req.query.end === "string") {
          const e = parseInt(req.query.end, 10);
          if (!isNaN(e) && e >= s) rangeEnd = e;
        }
      }
    } else if (typeof req.headers.range === "string") {
      const m = req.headers.range.match(/bytes=(\d+)-(\d*)/);
      if (m) {
        rangeStart = parseInt(m[1], 10);
        isExplicitRange = true;
        if (m[2]) {
          rangeEnd = parseInt(m[2], 10);
        }
      }
    }

    // If streaming or total size > MAX_CHUNK_BYTES, ensure we cap each response to MAX_CHUNK_BYTES
    if (rangeStart !== null) {
      if (rangeEnd === null || rangeEnd - rangeStart + 1 > MAX_CHUNK_BYTES) {
        rangeEnd = rangeStart + MAX_CHUNK_BYTES - 1;
      }
      if (audioInfo.contentLength && rangeEnd >= audioInfo.contentLength) {
        rangeEnd = audioInfo.contentLength - 1;
      }
    } else if (audioInfo.contentLength && audioInfo.contentLength > MAX_CHUNK_BYTES) {
      // Even if a request arrives without Range for a >8MB file, cap to first 8MB chunk
      rangeStart = 0;
      rangeEnd = MAX_CHUNK_BYTES - 1;
      isExplicitRange = true;
    }

    const needsDrmDecryption = Boolean(audioInfo.bilidrmUri);

    if (needsDrmDecryption && audioInfo.bilidrmUri) {
      const startByte = rangeStart ?? 0;
      const endByte = rangeEnd ?? startByte + MAX_CHUNK_BYTES - 1;
      const { slice, start, end, totalBytes } = await getDecryptedAudioRange(
        soundId,
        audioInfo,
        reqCookie,
        startByte,
        endByte
      );

      if (isExplicitRange || slice.length < totalBytes) {
        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${totalBytes}`);
      }
      res.setHeader("Content-Length", String(slice.length));
      return res.end(slice);
    }

    // Non-DRM stream: forward capped Range to upstream CDN
    const upstreamHeaders = buildMissEvanHeaders(
      `https://www.missevan.com/sound/player?id=${soundId}`,
      reqCookie
    );

    if (rangeStart !== null && rangeEnd !== null) {
      upstreamHeaders["Range"] = `bytes=${rangeStart}-${rangeEnd}`;
    }

    const upstreamRes = await fetch(audioInfo.streamUrl, {
      headers: upstreamHeaders,
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return res.status(upstreamRes.status).json({
        error: `Không thể tải dữ liệu âm thanh từ CDN (HTTP ${upstreamRes.status})`,
      });
    }

    if (upstreamRes.status === 206) {
      res.status(206);
      const contentRange = upstreamRes.headers.get("content-range");
      if (contentRange) res.setHeader("Content-Range", contentRange);
    }

    const upstreamLen = upstreamRes.headers.get("content-length");
    if (upstreamLen) {
      res.setHeader("Content-Length", upstreamLen);
    }

    if (!upstreamRes.body) {
      return res.end();
    }

    const { Readable } = await import("stream");
    const nodeStream = Readable.fromWeb(upstreamRes.body as any);

    nodeStream.on("error", () => {
      if (!res.headersSent) {
        res.status(500).json({ error: "Lỗi luồng tải âm thanh" });
      }
    });

    nodeStream.pipe(res);
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(400).json({ error: err.message || "Không thể tải file âm thanh" });
    }
  }
});

// Setup Vite middleware in dev or static files in prod
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(port, () => {
    console.log(`Server listening on port ${port} (mode: ${isProd ? "production" : "development"})`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
