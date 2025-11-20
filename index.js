// index.js
import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import twilio from "twilio";
import { google } from "googleapis";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// 🔹 TWILIO
// =========================
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// =========================
// 🔹 GOOGLE SHEETS
// =========================

const auth = new google.auth.GoogleAuth({
  credentials: {
    type: "service_account",
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.GOOGLE_CLIENT_EMAIL
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});


const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = "1jL4Q9E2p_hlc38Zwtyq2S5JUUlHPezvxUgoVGfW-_Ok";
const SHEET_NAME = "Registro_Invitados";

// =========================
// 🔹 MIDDLEWARE
// =========================
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));


// ======================================================
// 🟢 API: Confirmar asistencia (GUARDA → ENVÍA WHATSAPP)
// ======================================================
app.post("/api/confirmar", async (req, res) => {
  const { nombre, personas } = req.body;

  if (!nombre || !personas) {
    return res.status(400).json({ error: "Faltan datos." });
  }

  try {
    // 1️⃣ Guardar en Google Sheets
    const fecha = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:D`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[nombre, personas, "confirmado", fecha]],
      },
    });

    // 2️⃣ Enviar WhatsApp
    try {
      const msg = await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: process.env.HOST_PHONE_NUMBER,
        body: `✅ ${nombre} confirmó asistencia con ${personas} personas. 🎉`,
      });

      console.log("WhatsApp enviado:", msg.sid);

      res.json({
        mensaje: "Registro guardado y WhatsApp enviado.",
      });
    } catch (twilioError) {
      console.error("❌ Error enviando WhatsApp:", twilioError.message);

      res.json({
        mensaje: "Registro guardado, pero el WhatsApp no se pudo enviar.",
        whatsappError: true,
      });
    }

  } catch (error) {
    console.error("❌ Error Google Sheets:", error.message);
    res.status(500).json({ error: "Error guardando en Google Sheets." });
  }
});


// ======================================================
// ❌ API: No asistiré (GUARDA → ENVÍA WHATSAPP)
// ======================================================
app.post("/api/no-asistire", async (req, res) => {
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: "Falta el nombre." });
  }

  try {
    const fecha = new Date().toISOString();

    // 1️⃣ Guardar en Sheets
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:D`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[nombre, "-", "no_asiste", fecha]],
      },
    });

    // 2️⃣ Enviar WhatsApp
    try {
      const msg = await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: process.env.HOST_PHONE_NUMBER,
        body: `❌ ${nombre} no podrá asistir al evento.`,
      });

      console.log("Notificación enviada:", msg.sid);

      res.json({
        mensaje: "Registro guardado y mensaje enviado.",
      });

    } catch (twilioError) {
      console.error("❌ Error enviando WhatsApp:", twilioError.message);

      res.json({
        mensaje: "Registro guardado, pero el WhatsApp no se pudo enviar.",
        whatsappError: true,
      });
    }

  } catch (error) {
    console.error("❌ Error Google Sheets:", error.message);
    res.status(500).json({ error: "Error guardando en Google Sheets." });
  }
});


// 🔄 Ruta de prueba
app.get("/api/ping", (_, res) => {
  res.send("Servidor activo 🎉");
});


// Inicializar servidor (solo local)
app.listen(PORT, () =>
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`)
);
