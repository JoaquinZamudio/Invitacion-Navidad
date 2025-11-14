// index.js
import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import twilio from "twilio";
import cron from "node-cron";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// 📁 Archivo de confirmaciones
const dataPath = path.join(__dirname, "data", "confirmaciones.json");

// Leer confirmaciones
function loadData() {
  try {
    const content = fs.readFileSync(dataPath, "utf8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// Guardar confirmaciones
function saveData(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// 🟢 Confirmar asistencia
// ✅ Confirmar asistencia
app.post("/api/confirmar", async (req, res) => {
  const { nombre, personas } = req.body;
  if (!nombre || !personas) {
    return res.status(400).json({ error: "Faltan datos de nombre o personas." });
  }

  try {
    // 🟢 Enviar WhatsApp a la anfitriona
    const msg = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: process.env.HOST_PHONE_NUMBER,
      body: `✅ ${nombre} confirmó asistencia (${personas} persona${personas > 1 ? "s" : ""}). 🎉`
    });

    console.log("✅ Mensaje Twilio SID:", msg.sid);
    res.json({ mensaje: "Confirmación enviada correctamente." });
  } catch (err) {
    console.error("❌ Error al enviar WhatsApp:", err.message);
    res.status(500).json({ error: "No se pudo enviar el mensaje de WhatsApp." });
  }
});

// ❌ No podré asistir
app.post("/api/no-asistire", async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: "Falta el nombre." });

  try {
    const msg = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: process.env.HOST_PHONE_NUMBER,
      body: `❌ ${nombre} no podrá asistir al evento. 😢`
    });

    console.log("✅ Notificación enviada:", msg.sid);
    res.json({ mensaje: "Notificación enviada correctamente." });
  } catch (err) {
    console.error("❌ Error al enviar WhatsApp:", err.message);
    res.status(500).json({ error: "No se pudo enviar el mensaje de WhatsApp." });
  }
});

// 🕒 Reporte semanal (lunes 9am)
cron.schedule("0 9 * * 1", async () => {
  const data = loadData();
  const confirmados = data.filter((x) => x.status === "confirmado");

  const total = confirmados.length;
  const lista = confirmados.map((x) => `• ${x.nombre} (${x.personas})`).join("\n");

  const mensaje = `📊 *Reporte semanal de invitados confirmados*\n\nTotal: ${total}\n${lista || "Nadie ha confirmado aún."}`;

  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: process.env.HOST_PHONE_NUMBER,
      body: mensaje,
    });
    console.log("✅ Reporte semanal enviado por WhatsApp.");
  } catch (error) {
    console.error("❌ Error enviando reporte:", error);
  }
});

// 🔄 Ruta de prueba
app.get("/api/ping", (_, res) => {
  res.send("Servidor activo 🎉");
});

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));
