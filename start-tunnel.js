/**
 * start-tunnel.js
 * ──────────────────────────────────────────────────────────────────
 * Lance un tunnel public (localtunnel) sur le port 3001 (frontend).
 * Envoie l'URL publique au backend Flask (/api/config) pour que
 * la borne QR code utilise toujours la bonne URL.
 *
 * Usage : node start-tunnel.js
 */

const localtunnel = require("localtunnel");
const http = require("http");

const FRONTEND_PORT = 3001;
const BACKEND_URL = "http://localhost:5000";

(async () => {
  console.log("🔗 Démarrage du tunnel public localtunnel...\n");

  let tunnel;
  try {
    tunnel = await localtunnel({ port: FRONTEND_PORT });
  } catch (err) {
    console.error("❌ Impossible de créer le tunnel :", err.message);
    process.exit(1);
  }

  const publicUrl = tunnel.url;
  const mobileUrl = `${publicUrl}/#/mobile`;

  console.log("═══════════════════════════════════════════════════");
  console.log(`✅ Tunnel actif!`);
  console.log(`   URL publique : ${publicUrl}`);
  console.log(`   📱 Mobile    : ${mobileUrl}`);
  console.log("═══════════════════════════════════════════════════");
  console.log("   ➜ Le QR code de la borne est mis à jour automatiquement.");
  console.log("   ➜ Scannable depuis n'importe quel réseau (5G, 3G, WiFi).");
  console.log("   ➜ Appuyez Ctrl+C pour fermer le tunnel.\n");

  // ── Enregistrer l'URL dans le backend Flask ──────────────────────
  const postBody = JSON.stringify({ tunnel_url: publicUrl });
  const opts = {
    hostname: "localhost",
    port: 5000,
    path: "/api/config",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postBody),
    },
  };

  const req = http.request(opts, (res) => {
    let data = "";
    res.on("data", (chunk) => { data += chunk; });
    res.on("end", () => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.ok) {
          console.log(`✅ URL enregistrée dans le backend Flask.`);
          console.log(`   Le QR code de la borne affiche maintenant :`);
          console.log(`   ${mobileUrl}\n`);
        }
      } catch (_) {}
    });
  });

  req.on("error", (err) => {
    console.warn("⚠️  Backend Flask non disponible, réessayez après avoir démarré le backend.");
    console.warn(`   Erreur : ${err.message}`);
  });

  req.write(postBody);
  req.end();

  // ── Gestion des erreurs tunnel ───────────────────────────────────
  tunnel.on("error", (err) => {
    console.error("\n❌ Erreur tunnel :", err.message);
  });

  tunnel.on("close", () => {
    console.log("\n🔌 Tunnel fermé.");
  });

  // ── Garder le processus vivant ───────────────────────────────────
  process.on("SIGINT", async () => {
    console.log("\n🛑 Fermeture du tunnel...");
    await tunnel.close();
    process.exit(0);
  });
})();
