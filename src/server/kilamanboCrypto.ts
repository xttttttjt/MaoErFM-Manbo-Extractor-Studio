import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// KilaManbo Audio Stream AES-128-CBC Decryption Keys
const MANBO_AES_KEY = Buffer.from("nxm0v5l8f2rnn98b", "utf8");
const MANBO_AES_IV = Buffer.from("n8z4eqx05s397glk", "utf8");

let uxinInstance: any = null;

function getUxinCryptoInstance() {
  if (uxinInstance) return uxinInstance;

  try {
    const scriptPath = path.resolve(__dirname, "uxinCrypto.min.js");
    if (fs.existsSync(scriptPath)) {
      const scriptContent = fs.readFileSync(scriptPath, "utf8");
      const context: any = {
        window: {},
        location: { hostname: "www.kilamanbo.world" },
        console,
        setTimeout: () => {},
      };
      const exp: any = {};
      const mod: any = { exports: exp };
      const fn = new Function("window", "location", "console", "setTimeout", "exports", "module", scriptContent);
      fn(context.window, context.location, console, () => {}, exp, mod);
      const UxinCryptoClass = mod.exports || context.window.uxinSecurityUrlCrypto;
      if (typeof UxinCryptoClass === "function") {
        uxinInstance = new UxinCryptoClass({ enableSignatureVerification: false });
        return uxinInstance;
      }
    }
  } catch (err) {
    console.error("Failed to initialize local uxinCrypto instance:", err);
  }
  return null;
}

export interface DecryptedUrlResult {
  dramaId: string;
  collectId?: string;
  sign?: string;
}

/**
 * Decrypts any KilaManbo link (encrypted _specific_parameter or direct id)
 */
export async function decryptKilaManboUrl(inputUrl: string): Promise<DecryptedUrlResult> {
  const trimmed = inputUrl.trim();
  if (!trimmed) {
    throw new Error("KilaManbo URL or ID cannot be empty.");
  }

  // Pure numeric ID check
  if (/^\d+$/.test(trimmed)) {
    return { dramaId: trimmed };
  }

  let formattedUrl = trimmed;
  if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
    if (formattedUrl.includes("_specific_parameter=")) {
      formattedUrl = "https://www.kilamanbo.world/manbo/pc/detail?" + formattedUrl;
    } else if (formattedUrl.length > 30 && !formattedUrl.includes("=")) {
      formattedUrl = "https://www.kilamanbo.world/manbo/pc/detail?_specific_parameter=" + formattedUrl;
    } else {
      formattedUrl = "https://www.kilamanbo.world/manbo/pc/detail?" + formattedUrl;
    }
  }

  try {
    const parsed = new URL(formattedUrl);
    // If it already has plaintext dramaId or id without encrypted parameter
    if (!parsed.searchParams.has("_specific_parameter")) {
      const dramaId = parsed.searchParams.get("dramaId") || parsed.searchParams.get("id");
      if (dramaId) {
        return {
          dramaId,
          collectId: parsed.searchParams.get("collectId") || undefined,
        };
      }
    }

    const uxin = getUxinCryptoInstance();
    if (uxin) {
      const decrypted = await uxin.handleUrl(formattedUrl);
      const dramaId = String(decrypted.id || decrypted.dramaId || "").trim();
      if (dramaId) {
        return {
          dramaId,
          collectId: decrypted.collectId ? String(decrypted.collectId) : undefined,
          sign: decrypted.sign ? String(decrypted.sign) : undefined,
        };
      }
    }
  } catch (err: any) {
    console.warn("Uxin decryption fallback warning:", err?.message);
  }

  // Fallback regex scan for digits
  const idMatch = trimmed.match(/(?:id|dramaId|collectId)=(\d+)/) || trimmed.match(/(\d{15,22})/);
  if (idMatch) {
    return { dramaId: idMatch[1] };
  }

  throw new Error("Không thể giải mã liên kết KilaManbo. Vui lòng kiểm tra lại URL hoặc nhập trực tiếp ID kịch.");
}

/**
 * Decrypts AES-128-CBC encrypted audioUrl from KilaManbo episode
 */
export function decryptKilaManboAudioUrl(encryptedBase64?: string): string {
  if (!encryptedBase64) return "";
  const trimmed = encryptedBase64.trim();
  if (!trimmed) return "";

  // If already a plaintext http/https link
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  try {
    const decipher = crypto.createDecipheriv("aes-128-cbc", MANBO_AES_KEY, MANBO_AES_IV);
    let decrypted = decipher.update(trimmed, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted.trim();
  } catch (err) {
    console.warn("KilaManbo audio decryption error:", err);
    return "";
  }
}

/**
 * Parses official KilaManbo LRC script into normalized subtitle items
 */
export function parseKilaManboLrcString(lrcContent: string): any[] {
  if (!lrcContent) return [];
  const lines = lrcContent.split(/\r?\n/).filter(Boolean);
  const items: any[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^\[(\d{2,}):(\d{2}(?:\.\d+)?)\](.*)/);
    if (!match) continue;

    const mins = parseFloat(match[1]);
    const secs = parseFloat(match[2]);
    const content = match[3].trim();
    if (!content) continue;

    const time = Number((mins * 60 + secs).toFixed(2));
    let role = "官方台词";
    let text = content;

    // Check for character name before colon: "周其琛：高度200" or "航空兵: 来了来了"
    const colonMatch = content.match(/^([^：:\n]{1,16})[：:](.*)/);
    if (colonMatch) {
      role = colonMatch[1].trim();
      text = colonMatch[2].trim();
    } else if (content.startsWith("【") && content.endsWith("】")) {
      role = "音效 / 场景";
    }

    items.push({
      id: `manbo_sub_${i}_${Math.round(time * 100)}`,
      time,
      time_s: Math.floor(time),
      endTime: Number((time + 3.0).toFixed(2)),
      mode: 4,
      size: 25,
      color: 3462041, // Emerald green
      colorHex: "#34D399",
      createTime: 0,
      pool: 0,
      userId: role,
      dmId: `sub_${i}`,
      text: text || content,
      role,
      isOfficialSubtitle: true,
    });
  }

  // Calculate smart end times based on line lengths and next line gaps
  for (let i = 0; i < items.length; i++) {
    const cur = items[i];
    const next = items[i + 1];
    const naturalDur = Math.min(6.5, Math.max(1.8, 1.2 + cur.text.length * 0.18));
    let endTime = cur.time + naturalDur;
    if (next) {
      const gap = next.time - cur.time;
      if (gap > 0 && gap < naturalDur + 0.1) {
        endTime = Math.max(cur.time + 1.2, next.time - 0.05);
      }
    }
    cur.endTime = Number(endTime.toFixed(2));
  }

  items.sort((a, b) => a.time - b.time);
  return items;
}
