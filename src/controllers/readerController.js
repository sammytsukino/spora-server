const Flora = require("../models/Flora");

let voiceEnginePromise;

async function getVoiceEngine() {
  if (!voiceEnginePromise) {
    voiceEnginePromise = import("voipi").then(({ VoiPi }) => {
      return new VoiPi({
        providers: ["edge-tts", "google-tts", "piper"],
      });
    });
  }

  return voiceEnginePromise;
}

function contentTypeForAudioExt(ext) {
  switch ((ext || "").toLowerCase()) {
    case ".wav":
      return "audio/wav";
    case ".aiff":
    case ".aif":
      return "audio/aiff";
    case ".mp3":
    default:
      return "audio/mpeg";
  }
}

async function postReaderTts(req, res) {

  const floraId = req.body?.floraId;
  if (!floraId || typeof floraId !== "string") {
    return res.status(400).json({ error: "Missing Flora ID" });
  }

  const flora = await Flora.findOne({
    _id: floraId,
    isHidden: { $ne: true },
    isDeleted: { $ne: true },
  }).lean();

  if (!flora) {
    return res.status(404).json({ error: "Flora not found" });
  }

  const title = (flora.title || "").trim();
  const bodyText = (flora.text || "").trim();
  if (!title && !bodyText) {
    return res.status(400).json({ error: "No text to read" });
  }

  let toRead = title && bodyText ? `${title}. ${bodyText}` : bodyText || title;
  const MAX_CHARS = 6000;
  if (toRead.length > MAX_CHARS) {
    toRead = `${toRead.slice(0, MAX_CHARS)}…`;
  }

  const rawSpeed = req.body?.speed;
  let speed = 1;
  if (typeof rawSpeed === "number" && Number.isFinite(rawSpeed)) {
    speed = rawSpeed;
  } else if (typeof rawSpeed === "string" && rawSpeed.trim() !== "") {
    const parsedSpeed = parseFloat(rawSpeed);
    if (Number.isFinite(parsedSpeed)) speed = parsedSpeed;
  }
  
  speed = Math.min(1.35, Math.max(0.65, speed));

  try {
    const voice = await getVoiceEngine();
    const audio = await voice.toAudio(toRead, { rate: speed });

    res.setHeader("Content-Type", contentTypeForAudioExt(audio.ext));
    res.send(audio.data);
  } catch (err) {
    console.error("VoiPi TTS error:", err?.message || err);
    return res.status(502).json({ error: "Voice generation failed" });
  }
}

module.exports = { postReaderTts };
