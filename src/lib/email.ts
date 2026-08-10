import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendOtpEmail(
  to: string,
  otp: string,
  type: "REGISTRATION" | "PASSWORD_RESET"
) {
  const subject =
    type === "REGISTRATION"
      ? "Split-It — Verify your email"
      : "Split-It — Reset your password";

  const heading =
    type === "REGISTRATION"
      ? "Verify your email address"
      : "Reset your password";

  const message =
    type === "REGISTRATION"
      ? "Use the code below to complete your registration on Split-It."
      : "Use the code below to reset your password on Split-It.";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #059669; font-size: 24px; margin: 0;">Split-It</h1>
      </div>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px; text-align: center;">
        <h2 style="color: #18181b; font-size: 20px; margin: 0 0 8px;">${heading}</h2>
        <p style="color: #71717a; font-size: 14px; margin: 0 0 24px;">${message}</p>
        <div style="background: #18181b; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: 8px; padding: 16px 24px; border-radius: 12px; display: inline-block;">
          ${otp}
        </div>
        <p style="color: #a1a1aa; font-size: 12px; margin: 24px 0 0;">
          This code expires in <strong>10 minutes</strong>. Don't share it with anyone.
        </p>
      </div>
      <p style="color: #a1a1aa; font-size: 11px; text-align: center; margin-top: 24px;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Split-It" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

export function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}
