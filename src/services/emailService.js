const crypto = require("crypto");
const { hashVerificationToken } = require("../lib/verificationToken");

let transporter = null;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

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

function generateVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function sendVerificationEmail(email, token) {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || "SPORA <noreply@spora.app>",
    to: email,
    subject: "Verify your SPORA account",
    text: `Welcome to SPORA!\n\nPlease verify your email by clicking this link:\n${verifyUrl}\n\nThe link expires in 24 hours.\n\nIf you did not create an account, you can ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Welcome to SPORA</h2>
        <p>Please verify your email by clicking the button below:</p>
        <p style="margin: 24px 0;">
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #262626; color: #bbf451; text-decoration: none; font-weight: bold; border-radius: 4px;">
            Verify email
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">The link expires in 24 hours.</p>
        <p style="color: #666; font-size: 14px;">If you did not create an account, you can ignore this email.</p>
      </div>
    `,
  };

  if (!transporter) {
    console.warn(
      "[Email] SMTP not configured. Verification link (for dev):",
      verifyUrl
    );
    return;
  }

  await transporter.sendMail(mailOptions);
}

async function sendVerificationEmailToUser(user) {
  const token = generateVerificationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);
  user.emailVerificationToken = hashVerificationToken(token);
  user.emailVerificationExpires = expiresAt;
  await user.save();
  await sendVerificationEmail(user.email, token);
  return token;
}

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

module.exports = {
  generateVerificationToken,
  sendVerificationEmail,
  sendVerificationEmailToUser,
  sendAdminNewReportEmail,
};
