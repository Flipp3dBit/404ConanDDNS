const loginView = document.querySelector("#login-view");
const statusView = document.querySelector("#status-view");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const pinInput = document.querySelector("#pin");
const refreshButton = document.querySelector("#refresh");
const logoutButton = document.querySelector("#logout");
const copyButton = document.querySelector("#copy-address");

const fields = {
  badge: document.querySelector("#status-badge"),
  address: document.querySelector("#server-address"),
  ip: document.querySelector("#public-ip"),
  gamePort: document.querySelector("#game-port"),
  queryPort: document.querySelector("#query-port"),
  players: document.querySelector("#players"),
  map: document.querySelector("#map"),
  latency: document.querySelector("#latency"),
  message: document.querySelector("#status-message"),
  lastCheck: document.querySelector("#last-check"),
  copyNote: document.querySelector("#copy-note"),
  dnsSummary: document.querySelector("#dns-summary"),
  dnsResolvers: document.querySelector("#dns-resolvers"),
};

function showLogin() {
  statusView.hidden = true;
  loginView.hidden = false;
  pinInput.focus();
}

function showStatus() {
  loginView.hidden = true;
  statusView.hidden = false;
}

function setBadge(state, text) {
  fields.badge.className = `badge ${state}`;
  fields.badge.lastElementChild.textContent = text;
}

function formatCheckedAt(value) {
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

function renderDns(data) {
  const resolvers = data.dnsResolvers || [];
  fields.dnsSummary.className = `dns-summary ${data.dnsSynced ? "synced" : "pending"}`;
  fields.dnsSummary.textContent = data.dnsSynced ? "Überall gleich" : "Noch nicht überall gleich";
  fields.dnsResolvers.replaceChildren(...resolvers.map((resolver) => {
    const item = document.createElement("div");
    item.className = `resolver ${resolver.ok ? "ok" : "pending"}`;

    const name = document.createElement("span");
    name.className = "resolver-name";
    name.textContent = resolver.name;

    const address = document.createElement("strong");
    address.className = "resolver-address";
    address.textContent = resolver.address || "Noch kein A-Record";

    const ttl = document.createElement("span");
    ttl.className = "resolver-ttl";
    ttl.textContent = resolver.ttl == null ? "Keine Antwort" : `TTL ${resolver.ttl} s`;

    item.append(name, address, ttl);
    return item;
  }));
}

async function fetchStatus() {
  refreshButton.disabled = true;
  setBadge("checking", "Prüfe …");
  fields.message.className = "message";
  fields.message.textContent = "DynDNS und Query-Port werden geprüft.";

  try {
    const response = await fetch("/api/status", { credentials: "same-origin", cache: "no-store" });
    if (response.status === 401) {
      showLogin();
      return;
    }

    const data = await response.json();
    fields.address.textContent = `${data.host}:${data.gamePort}`;
    fields.ip.textContent = data.address || "Nicht aufgelöst";
    fields.gamePort.textContent = `${data.gamePort} / UDP`;
    fields.queryPort.textContent = `${data.queryPort} / UDP`;
    fields.players.textContent = data.server ? `${data.server.players} / ${data.server.maxPlayers}` : "—";
    fields.map.textContent = data.server?.map || "—";
    fields.latency.textContent = data.server ? `${data.server.latencyMs} ms` : "—";
    fields.lastCheck.textContent = `Geprüft um ${formatCheckedAt(data.checkedAt)}`;
    renderDns(data);

    if (data.online) {
      setBadge("online", "Online");
      fields.message.textContent = data.server?.name ? `${data.server.name} antwortet auf dem Query-Port.` : "Der Server antwortet auf dem Query-Port.";
    } else {
      setBadge("offline", "Nicht erreichbar");
      fields.message.className = "message error";
      fields.message.textContent = data.error || "Der Server hat nicht geantwortet.";
    }
  } catch {
    setBadge("offline", "Fehler");
    fields.message.className = "message error";
    fields.message.textContent = "Die Statusabfrage ist gerade nicht verfügbar.";
  } finally {
    refreshButton.disabled = false;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  loginError.hidden = true;

  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ pin: pinInput.value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Anmeldung fehlgeschlagen.");
    pinInput.value = "";
    showStatus();
    await fetchStatus();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
    pinInput.select();
  } finally {
    submitButton.disabled = false;
  }
});

refreshButton.addEventListener("click", fetchStatus);

logoutButton.addEventListener("click", async () => {
  await fetch("/api/auth", { method: "DELETE", credentials: "same-origin" });
  showLogin();
});

copyButton.addEventListener("click", async () => {
  const address = fields.address.textContent;
  if (!address || address === "—") return;
  try {
    await navigator.clipboard.writeText(address);
    fields.copyNote.textContent = "Adresse kopiert";
    setTimeout(() => { fields.copyNote.textContent = ""; }, 1800);
  } catch {
    fields.copyNote.textContent = "Kopieren nicht möglich";
  }
});

(async () => {
  try {
    const response = await fetch("/api/auth", { credentials: "same-origin", cache: "no-store" });
    const data = await response.json();
    if (data.authenticated) {
      showStatus();
      await fetchStatus();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
})();

