const crypto = require("crypto");

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
  user.emailVerificationToken = token;
  user.emailVerificationExpires = expiresAt;
  await user.save();
  await sendVerificationEmail(user.email, token);
  return token;
}

module.exports = {
  generateVerificationToken,
  sendVerificationEmail,
  sendVerificationEmailToUser,
};
