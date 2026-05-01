const User = require("../models/User");
const { sendAdminContactEmail } = require("../services/emailService");

const MAX_SUBJECT_LENGTH = 160;
const MAX_MESSAGE_LENGTH = 5000;

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function submitContactForm(req, res) {
  const name = sanitizeText(req.body?.name);
  const email = sanitizeText(req.body?.email).toLowerCase();
  const subject = sanitizeText(req.body?.subject);
  const message = sanitizeText(req.body?.message);

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (subject.length > MAX_SUBJECT_LENGTH) {
    return res.status(400).json({ error: "Subject is too long" });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: "Message is too long" });
  }

  const admins = await User.find({
    role: "admin",
    accountStatus: "active",
    email: { $exists: true, $ne: null },
  })
    .select("email")
    .lean();

  const recipients = admins
    .map((adminUser) => adminUser.email)
    .filter((adminEmail) => typeof adminEmail === "string" && adminEmail.trim() !== "");

  if (recipients.length === 0) {
    return res.status(503).json({ error: "No admin recipients configured" });
  }

  await sendAdminContactEmail({
    recipients,
    name,
    email,
    subject,
    message,
  });

  return res.status(200).json({ ok: true });
}

module.exports = {
  submitContactForm,
};
