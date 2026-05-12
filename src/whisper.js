const OpenAI = require("openai");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function transcribeAudio(fileId) {
  // 1. Get file path from Telegram
  const infoRes = await axios.get(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
  );
  const filePath = infoRes.data.result.file_path;

  // 2. Download the audio file
  const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
  const fileRes = await axios.get(fileUrl, { responseType: "arraybuffer" });

  // 3. Save temporarily to disk
  const tmpPath = path.join("/tmp", `audio_${Date.now()}.ogg`);
  fs.writeFileSync(tmpPath, fileRes.data);

  // 4. Transcribe with Whisper
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(tmpPath),
    model: "whisper-1",
    language: "es",
  });

  // 5. Clean up
  fs.unlinkSync(tmpPath);

  return transcription.text;
}

module.exports = { transcribeAudio };