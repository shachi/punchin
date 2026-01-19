// attendance-deno/src/lib/jwt.ts
import type { JWTPayload, SessionUser } from "../types.ts";

const JWT_SECRET = Deno.env.get("JWT_SECRET") || "your-secret-key-change-in-production";
const JWT_EXPIRY = 60 * 60 * 24 * 7; // 7日間（秒）

// テキストエンコーダー
const encoder = new TextEncoder();

// Base64URL エンコード
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Base64URL デコード
function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// HMAC-SHA256署名を生成
async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data)
  );
  return base64UrlEncode(new Uint8Array(signature));
}

// JWTトークンを生成
export async function createToken(user: SessionUser): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const payload: JWTPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY,
  };

  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(`${headerB64}.${payloadB64}`);

  return `${headerB64}.${payloadB64}.${signature}`;
}

// JWTトークンを検証
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // 署名を検証
    const expectedSignature = await sign(`${headerB64}.${payloadB64}`);
    if (signatureB64 !== expectedSignature) {
      return null;
    }

    // ペイロードをデコード
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload: JWTPayload = JSON.parse(payloadJson);

    // 有効期限をチェック
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// セッションユーザーを取得
export function getSessionUser(payload: JWTPayload): SessionUser {
  return {
    id: payload.id,
    email: payload.email,
    name: payload.name,
    isAdmin: payload.isAdmin,
  };
}
