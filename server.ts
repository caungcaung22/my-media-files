/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload limits for handling file/image base64 transfers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy initialisation helper for Gemini API client to prevent startup failure if key is missing
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// --- API Endpoints for Proxying Gemini Commands ---

// 1. Text-To-Speech (TTS) Proxy using gemini-3.1-flash-tts-preview
app.post("/api/gemini/tts", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" }, // Options: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(444).json({ error: "No audio data received from Gemini" });
    }

    res.json({ audio: base64Audio });
  } catch (e: any) {
    console.error("TTS Endpoint Error:", e);
    res.status(500).json({ error: e.message || "Failed to generate TTS speech" });
  }
});

// 2. Scan Document (Image, PDF, Excel snapshot analysis & structured extraction)
app.post("/api/gemini/scan-doc", async (req, res) => {
  try {
    const { fileData, mimeType, prompt, sheetSnippet } = req.body;
    const ai = getGemini();

    let contentsParts: any[] = [{ text: prompt }];

    if (fileData) {
      contentsParts.push({
        inlineData: {
          data: fileData,
          mimeType: mimeType || "image/jpeg",
        },
      });
    }

    if (sheetSnippet) {
      contentsParts.push({
        text: "Snippet contents of spreadsheet data: \n" + sheetSnippet,
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: contentsParts },
      config: {
        responseMimeType: "application/json",
      },
    });

    res.json({ text: response.text });
  } catch (e: any) {
    console.error("Document Scanning Error:", e);
    res.status(500).json({ error: e.message || "Failed to scan and extract document content" });
  }
});

// 3. Analyze Ledger (Price anomalies, discrepancy reports)
app.post("/api/gemini/analyze-ledger", async (req, res) => {
  try {
    const { tabType, data, referencePrices } = req.body;
    if (!tabType || !data) {
      return res.status(400).json({ error: "tabType and data are required" });
    }

    const prompt = `Analyze "${tabType}" data: ${JSON.stringify(data)}. 
Find any wrong price allocations, potential typos, or odd transactions. 
Use this reference pricing database from our data collections as a guideline: ${JSON.stringify(referencePrices || [])}. 
Reply shortly in Burmese bullet points. Highlight any items that cost significantly more than the reference.`;

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ text: response.text });
  } catch (e: any) {
    console.error("Ledger Analysis Error:", e);
    res.status(500).json({ error: e.message || "Failed to analyze ledger content" });
  }
});

// 4. Generate Audit Report
app.post("/api/gemini/audit-report", async (req, res) => {
  try {
    const { extractedQuo, discrepancies, mathErrors } = req.body;
    if (!extractedQuo) {
      return res.status(400).json({ error: "extractedQuo is required" });
    }

    const prompt = `You are a professional expert auditor in Myanmar. I am providing you a parsed quotation from a file.
Total Items: ${extractedQuo.length}.
1. Master Price Discrepancies: ${JSON.stringify(discrepancies || [])}
2. Calculation Errors (Qty * Price != Total): ${JSON.stringify(mathErrors || [])}
3. Raw Quotation Data (Sample): ${JSON.stringify(extractedQuo.slice(0, 20))}

Please perform a FULL audit of this quotation file.
- Highlight the calculation errors clearly.
- Check for missing fields or suspicious entries (e.g., zero quantity, unusually high prices, missing units).
- Identify typos or formatting issues in descriptions.
- Summarize the master price discrepancies compared to our database.

Write a highly detailed, professional audit report in Burmese using bullet points. Structure it clearly into these sections:
၁။ တွက်ချက်မှု အမှားများ (Calculation & Math Errors)
၂။ စျေးနှုန်း ကွာဟချက်များ (Master Price Discrepancies)
၃။ စာလုံးပေါင်းနှင့် အထွေထွေ စစ်ဆေးချက် (Typos & General Findings)`;

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ text: response.text });
  } catch (e: any) {
    console.error("Audit Report Error:", e);
    res.status(500).json({ error: e.message || "Failed to generate AI Audit report" });
  }
});

// 5. Build/Compress Project Schedule
app.post("/api/gemini/schedule", async (req, res) => {
  try {
    const { action, currentSchedule, fileData, mimeType, prompt } = req.body;
    const ai = getGemini();

    let response;
    if (action === "compress") {
      const compressPrompt = `You are an expert interior design and construction project manager. 
Here is the current project schedule: 
${JSON.stringify(currentSchedule)}

Please compress this schedule to the shortest possible realistic timeframe. 
CRITICAL INSTRUCTIONS: 
1. Maximize concurrent overlapping of tasks as much as realistically possible.
2. Reduce durations of individual phases where reasonable.
3. ABSOLUTELY EXCLUDE SUNDAYS AND MYANMAR PUBLIC HOLIDAYS. 
4. Keep the exact same phase "name"s. Only change the "start" and "end" dates.

Return ONLY a valid JSON object. Do not output markdown formatting. Format strictly:
{
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "schedulePhases": [
    { "name": "Phase Name", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }
  ]
}`;
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: compressPrompt,
        config: {
          responseMimeType: "application/json",
        },
      });
    } else {
      // Auto-schedule from file/prompt
      let parts: any[] = [{ text: prompt }];
      if (fileData) {
        parts.push({
          inlineData: {
            data: fileData,
            mimeType: mimeType || "application/pdf",
          },
        });
      }

      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
        },
      });
    }

    res.json({ text: response.text });
  } catch (e: any) {
    console.error("Schedule Planning Error:", e);
    res.status(500).json({ error: e.message || "Failed to plan/compress schedule" });
  }
});

// --- Integrate Vite Middlewares ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in Development Mode (Vite Middleware)...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in Production Mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));

    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server bound and running on http://localhost:${PORT}`);
  });
}

startServer();
