import crypto from "node:crypto";

const COOKIE_NAME = "conan_session";
const SESSION_AGE_SECONDS = 60 * 60 * 12;

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionCookie(secret) {
  const payload = encode(JSON.stringify({ expires: Date.now() + SESSION_AGE_SECONDS * 1000 }));
  const value = `${payload}.${sign(payload, secret)}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_AGE_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function hasValidSession(request, secret) {
  if (!secret) return false;

  const cookies = request.headers.get("cookie") || "";
  const value = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);

  if (!value) return false;
  const [payload, suppliedSignature] = value.split(".");
  if (!payload || !suppliedSignature) return false;

  const expectedSignature = sign(payload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isFinite(session.expires) && session.expires > Date.now();
  } catch {
    return false;
  }
}

export function safeEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

