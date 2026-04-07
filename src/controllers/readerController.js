const Flora = require("../models/Flora");


async function postReaderTts(req, res) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (!apiKey || !voiceId) {
    return res.status(503).json({ error: "Text-to-speech is not configured on this server" });
  }

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

  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

  const rawSpeed = req.body?.speed;
  let speed = 1;
  if (typeof rawSpeed === "number" && Number.isFinite(rawSpeed)) {
    speed = rawSpeed;
  } else if (typeof rawSpeed === "string" && rawSpeed.trim() !== "") {
    const n = parseFloat(rawSpeed);
    if (Number.isFinite(n)) speed = n;
  }
  
  speed = Math.min(1.35, Math.max(0.65, speed));

  let elRes;
  try {
    elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: toRead,
          model_id: modelId,
          voice_settings: { speed },
        }),
      }
    );
  } catch (err) {
    console.error("ElevenLabs TTS fetch error:", err?.message || err);
    return res.status(502).json({ error: "Voice service unreachable" });
  }

  if (!elRes.ok) {
    const errBody = await elRes.text();
    console.error("ElevenLabs TTS error:", elRes.status, errBody.slice(0, 500));
    return res.status(502).json({ error: "Voice generation failed" });
  }

  const arrayBuffer = await elRes.arrayBuffer();
  const contentType = elRes.headers.get("content-type") || "audio/mpeg";
  res.setHeader("Content-Type", contentType);
  res.send(Buffer.from(arrayBuffer));
}

module.exports = { postReaderTts };
