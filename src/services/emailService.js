let transporter = null;

try {
  const nodemailer = require("nodemailer");
  const hasSmtp =
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    (process.env.SMTP_USER || process.env.SMTP_SECURE === "true");

  if (hasSmtp) {
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465 || process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });
  }
} catch (err) {
  console.warn("Nodemailer not installed. Run: npm install nodemailer");
}

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

async function sendAdminNewReportEmail({
  recipients,
  reportId,
  reportedFloraId,
  category,
  reason,
  reportedByUsername,
}) {
  if (!Array.isArray(recipients) || recipients.length === 0) return;
  if (!transporter) {
    console.warn(
      "[Email] SMTP not configured. Admin new-report notification skipped."
    );
    return;
  }

  const adminUrl = `${FRONTEND_URL}/admin?tab=Reports`;
  const subject = `SPORA admin alert: new report ${reportId}`;
  const text = [
    "A new report was submitted in SPORA.",
    "",
    `Report ID: ${reportId}`,
    `Flora ID: ${reportedFloraId}`,
    `Category: ${category || "other"}`,
    `Reason: ${reason || "n/a"}`,
    `Reported by: ${reportedByUsername || "unknown"}`,
    "",
    `Open Admin Panel: ${adminUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
      <h2>New SPORA report submitted</h2>
      <p>A new report requires moderation review.</p>
      <ul>
        <li><strong>Report ID:</strong> ${reportId}</li>
        <li><strong>Flora ID:</strong> ${reportedFloraId}</li>
        <li><strong>Category:</strong> ${category || "other"}</li>
        <li><strong>Reason:</strong> ${reason || "n/a"}</li>
        <li><strong>Reported by:</strong> ${reportedByUsername || "unknown"}</li>
      </ul>
      <p style="margin-top: 20px;">
        <a href="${adminUrl}" style="display: inline-block; padding: 12px 20px; background: #262626; color: #bbf451; text-decoration: none; font-weight: bold; border-radius: 4px;">
          Open Admin Panel
        </a>
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "SPORA <noreply@spora.app>",
    to: recipients.join(","),
    subject,
    text,
    html,
  });
}

async function sendAdminContactEmail({
  recipients,
  name,
  email,
  subject,
  message,
}) {
  if (!Array.isArray(recipients) || recipients.length === 0) return;
  if (!transporter) {
    console.warn(
      "[Email] SMTP not configured. Admin contact notification skipped."
    );
    return;
  }

  const adminSubject = `[SPORA Contact] ${subject}`;
  const text = [
    "New contact form submission received.",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Subject: ${subject}`,
    "",
    "Message:",
    message,
  ].join("\n");

  const html = `
    <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto;">
      <h2>New SPORA contact message</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong></p>
      <div style="padding: 12px; background: #f5f5f5; border: 1px solid #ddd; white-space: pre-wrap;">
        ${message}
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "SPORA <noreply@spora.app>",
    to: recipients.join(","),
    replyTo: email,
    subject: adminSubject,
    text,
    html,
  });
}

module.exports = {
  sendAdminNewReportEmail,
  sendAdminContactEmail,
};
