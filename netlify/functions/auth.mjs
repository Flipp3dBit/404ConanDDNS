import {
  clearSessionCookie,
  createSessionCookie,
  hasValidSession,
  json,
  safeEqual,
} from "./_session.mjs";

export default async (request) => {
  const pin = Netlify.env.get("STATUS_PIN") || "202403";
  const secret = Netlify.env.get("SESSION_SECRET");

  if (!pin || !secret) {
    return json({ error: "Die Server-Konfiguration ist noch nicht vollständig." }, 503);
  }

  if (request.method === "GET") {
    return json({ authenticated: hasValidSession(request, secret) });
  }

  if (request.method === "DELETE") {
    return json(
      { authenticated: false },
      200,
      { "set-cookie": clearSessionCookie() },
    );
  }

  if (request.method !== "POST") {
    return json({ error: "Methode nicht erlaubt." }, 405, { allow: "GET, POST, DELETE" });
  }

  let submittedPin = "";
  try {
    const body = await request.json();
    submittedPin = body.pin ?? "";
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }

  if (!safeEqual(submittedPin, pin)) {
    return json({ error: "Die PIN stimmt nicht." }, 401);
  }

  return json(
    { authenticated: true },
    200,
    { "set-cookie": createSessionCookie(secret) },
  );
};

