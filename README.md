# Conan Serverstatus

Kleine, PIN-geschützte Netlify-Seite für den Conan-Exiles-Enhanced-Server unter `lab.404gnf.de`.

## Auf Netlify veröffentlichen

1. Diesen Ordner als eigenes Git-Repository verwenden oder in Netlify als **Base directory** `conan-status-site` eintragen.
2. In Netlify unter **Project configuration → Environment variables** folgende Werte anlegen:
   - `STATUS_PIN`: optional; ohne Eintrag wird `202403` verwendet
   - `SESSION_SECRET`: ein langer zufälliger Wert (mindestens 32 Zeichen)
   - `SERVER_HOST`: `lab.404gnf.de`
   - `GAME_PORT`: `20010`
   - `QUERY_PORT`: `20011`
3. Deploy auslösen. Ein Build-Befehl ist nicht nötig; Publish-Verzeichnis und Functions sind in `netlify.toml` eingetragen.

Für `SESSION_SECRET` lässt sich lokal ein geeigneter Wert erzeugen:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

## DNS-Hinweis

`lab.404gnf.de` muss weiterhin auf die öffentliche IP des Conan-Servers zeigen. Die Statusseite sollte die von Netlify bereitgestellte Adresse oder einen eigenen Namen wie `status.404gnf.de` verwenden. Derselbe Hostname kann nicht gleichzeitig auf Netlify und den Spielserver zeigen.

## Router / Firewall

Der Router muss UDP `20010` an den Gameport und UDP `20011` an den Queryport des Conan-Servers weiterleiten. Die Seite fragt den A-Record bei Cloudflare, Google und AdGuard ab und zeigt, ob alle bereits dieselbe IP liefern. Anschließend verwendet der Query-Check Steam A2S_INFO einschließlich des modernen Challenge-Handshakes auf Port `20011`. Bei erfolgreicher Antwort zeigt die Seite Servername, Karte, Spielerzahl und Antwortzeit.

Die angezeigte Direct-Connect-Adresse verwendet immer die aufgelöste öffentliche IP mit dem Gameport, also `IP:20010`. Der Button **Enhanced starten** öffnet Steam-App `440900` mit `+connect IP:20010`. Falls der Browser externe Steam-Links blockiert oder Enhanced den Startparameter nicht übernimmt, kann die Adresse angeklickt und anschließend im Direct-Connect-Dialog von Conan Exiles Enhanced eingefügt werden.

## Lokal testen

`.env.example` als `.env` kopieren, Werte eintragen und anschließend (die Netlify CLI wird dabei bei Bedarf über `npx` geladen):

```powershell
npm run dev
```
