import dns from "node:dns/promises";
import dgram from "node:dgram";
import { hasValidSession, json } from "./_session.mjs";

const DNS_RESOLVERS = [
  { id: "cloudflare", name: "Cloudflare", url: "https://cloudflare-dns.com/dns-query" },
  { id: "google", name: "Google", url: "https://dns.google/resolve" },
  { id: "adguard", name: "AdGuard", url: "https://dns.adguard-dns.com/resolve" },
];

const A2S_INFO_REQUEST = Buffer.concat([
  Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]),
  Buffer.from("Source Engine Query\0", "ascii"),
]);

function readCString(buffer, cursor) {
  const end = buffer.indexOf(0, cursor.offset);
  if (end === -1) throw new Error("Ungültige Query-Antwort");
  const value = buffer.toString("utf8", cursor.offset, end);
  cursor.offset = end + 1;
  return value;
}

function parseA2sInfo(message) {
  if (message.length < 7 || message.readInt32LE(0) !== -1 || message[4] !== 0x49) {
    throw new Error("Unbekannte Query-Antwort");
  }

  const cursor = { offset: 6 };
  const name = readCString(message, cursor);
  const map = readCString(message, cursor);
  readCString(message, cursor); // folder
  readCString(message, cursor); // game
  cursor.offset += 2; // app id

  if (cursor.offset + 3 > message.length) throw new Error("Unvollständige Query-Antwort");
  const players = message[cursor.offset++];
  const maxPlayers = message[cursor.offset++];
  const bots = message[cursor.offset++];

  return { name, map, players, maxPlayers, bots };
}

function queryServer(host, port, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    let settled = false;
    const startedAt = Date.now();

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      error ? reject(error) : resolve(result);
    };

    const timer = setTimeout(() => finish(new Error("Zeitüberschreitung")), timeoutMs);
    socket.once("error", (error) => finish(error));
    socket.once("message", (message) => {
      try {
        finish(null, { ...parseA2sInfo(message), latencyMs: Date.now() - startedAt });
      } catch (error) {
        finish(error);
      }
    });
    socket.send(A2S_INFO_REQUEST, port, host, (error) => {
      if (error) finish(error);
    });
  });
}

async function queryDnsResolver(resolver, host) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const url = new URL(resolver.url);
    url.searchParams.set("name", host);
    url.searchParams.set("type", "A");
    const response = await fetch(url, {
      headers: { accept: "application/dns-json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Resolver nicht erreichbar");
    const payload = await response.json();
    const answers = (payload.Answer || []).filter((answer) => answer.type === 1);
    return {
      id: resolver.id,
      name: resolver.name,
      address: answers.at(-1)?.data || null,
      ttl: answers.length ? Math.min(...answers.map((answer) => answer.TTL)) : null,
      ok: answers.length > 0,
    };
  } catch {
    return { id: resolver.id, name: resolver.name, address: null, ttl: null, ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

export default async (request) => {
  if (request.method !== "GET") {
    return json({ error: "Methode nicht erlaubt." }, 405, { allow: "GET" });
  }

  const secret = Netlify.env.get("SESSION_SECRET");
  if (!hasValidSession(request, secret)) {
    return json({ error: "Nicht angemeldet." }, 401);
  }

  const host = Netlify.env.get("SERVER_HOST") || "lab.404gnf.de";
  const gamePort = Number(Netlify.env.get("GAME_PORT") || 20010);
  const queryPort = Number(Netlify.env.get("QUERY_PORT") || 20011);
  const checkedAt = new Date().toISOString();

  const dnsResolvers = await Promise.all(DNS_RESOLVERS.map((resolver) => queryDnsResolver(resolver, host)));
  const resolvedAddresses = dnsResolvers.filter((resolver) => resolver.address).map((resolver) => resolver.address);
  const dnsSynced = resolvedAddresses.length === DNS_RESOLVERS.length && new Set(resolvedAddresses).size === 1;

  let address = null;
  let dnsError = null;
  try {
    address = (await dns.lookup(host, { family: 4 })).address;
  } catch {
    dnsError = "Der DynDNS-Name konnte nicht aufgelöst werden.";
  }

  if (!address) {
    return json({ online: false, host, address, gamePort, queryPort, checkedAt, dnsResolvers, dnsSynced, error: dnsError });
  }

  try {
    const server = await queryServer(address, queryPort);
    return json({ online: true, host, address, gamePort, queryPort, checkedAt, dnsResolvers, dnsSynced, server });
  } catch {
    return json({
      online: false,
      host,
      address,
      gamePort,
      queryPort,
      checkedAt,
      dnsResolvers,
      dnsSynced,
      error: "Keine Antwort vom Conan-Query-Port erhalten.",
    });
  }
};

