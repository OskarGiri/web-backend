const nodemailer = require("nodemailer");

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  FROM_EMAIL,
} = process.env;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  secure: Number(SMTP_PORT) === 465,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

function buildOtpEmailTemplate(otp) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
      <h2 style="margin: 0 0 12px;">Password Reset OTP</h2>
      <p style="margin: 0 0 12px;">Use the OTP below to reset your password.</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; margin: 12px 0;">${otp}</p>
      <p style="margin: 0 0 8px;">This OTP expires in 10 minutes.</p>
      <p style="margin: 0;">If you did not request this, you can ignore this email.</p>
    </div>
  `;
}

async function sendMail({ to, subject, html, text }) {
  const from = FROM_EMAIL || SMTP_USER;
  if (!from) {
    throw new Error("Mailer not configured: missing FROM_EMAIL/SMTP_USER");
  }

  return transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
  });
}

module.exports = {
  sendMail,
  buildOtpEmailTemplate,
};
