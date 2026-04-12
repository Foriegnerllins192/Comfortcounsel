const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const APP_URL = process.env.APP_URL || 'https://comfortcounsel.onrender.com';

/**
 * Send counselor pending approval email (sent after registration).
 */
const sendPendingApprovalEmail = async (name, email) => {
  await transporter.sendMail({
    from: `"Comfort Counsel" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Application Received – Comfort Counsel',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:2rem;border:1px solid #e5e7eb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:1.5rem;">
          <h1 style="color:#2E7D6B;margin:0">🌿 Comfort Counsel</h1>
        </div>
        <h2 style="color:#1f2937">Thank You for Applying, ${name}! 👋</h2>
        <p style="color:#4b5563;line-height:1.7">
          We have received your application to become a counselor on Comfort Counsel.
        </p>
        <p style="color:#4b5563;line-height:1.7">
          Our team is currently reviewing your credentials and information. We will notify you via email
          <strong>within 24-48 hours</strong> with a decision on your application.
        </p>
        <div style="background:#f3f4f6;border-left:4px solid #2E7D6B;padding:1rem;margin:1.5rem 0;border-radius:4px;">
          <p style="color:#4b5563;margin:0;line-height:1.7">
            <strong>What happens next?</strong><br/>
            Once approved, you'll be able to log in to your dashboard and start receiving session requests from clients.
          </p>
        </div>
        <p style="color:#4b5563;line-height:1.7">
          If you have any questions in the meantime, feel free to reach out to our support team.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0" />
        <p style="color:#9ca3af;font-size:.85rem;text-align:center">
          Best regards,<br/>
          <strong style="color:#2E7D6B">The Comfort Counsel Team</strong><br/>
          <a href="${APP_URL}" style="color:#2E7D6B">${APP_URL}</a>
        </p>
      </div>
    `
  });
};

/**
 * Send counselor approval email.
 */
const sendApprovalEmail = async (name, email) => {
  await transporter.sendMail({
    from: `"Comfort Counsel" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'You Have Been Approved as a Counselor – Comfort Counsel',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:2rem;border:1px solid #e5e7eb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:1.5rem;">
          <h1 style="color:#2E7D6B;margin:0">🌿 Comfort Counsel</h1>
        </div>
        <h2 style="color:#1f2937">Congratulations, ${name}! 🎉</h2>
        <p style="color:#4b5563;line-height:1.7">
          We are pleased to inform you that your application has been reviewed and
          <strong>you have been approved as a counselor</strong> on the Comfort Counsel platform.
        </p>
        <p style="color:#4b5563;line-height:1.7">
          You can now start receiving session requests and making a real difference in people's lives.
        </p>
        <div style="text-align:center;margin:2rem 0;">
          <a href="${APP_URL}/dashboard.html"
             style="background:#2E7D6B;color:#fff;padding:.85rem 2rem;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem;">
            Go to My Dashboard
          </a>
        </div>
        <p style="color:#4b5563;line-height:1.7">
          If you have any questions, feel free to reach out to our support team.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0" />
        <p style="color:#9ca3af;font-size:.85rem;text-align:center">
          Best regards,<br/>
          <strong style="color:#2E7D6B">The Comfort Counsel Team</strong><br/>
          <a href="${APP_URL}" style="color:#2E7D6B">${APP_URL}</a>
        </p>
      </div>
    `
  });
};

/**
 * Send counselor rejection email.
 */
const sendRejectionEmail = async (name, email) => {
  await transporter.sendMail({
    from: `"Comfort Counsel" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Application Update – Comfort Counsel',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:2rem;border:1px solid #e5e7eb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:1.5rem;">
          <h1 style="color:#2E7D6B;margin:0">🌿 Comfort Counsel</h1>
        </div>
        <h2 style="color:#1f2937">Hello, ${name}</h2>
        <p style="color:#4b5563;line-height:1.7">
          Thank you for applying to become a counselor on Comfort Counsel. After careful review,
          we regret to inform you that your application was <strong>not approved</strong> at this time.
        </p>
        <p style="color:#4b5563;line-height:1.7">
          This may be due to incomplete information or our current capacity. You are welcome to
          reapply in the future with updated credentials.
        </p>
        <p style="color:#4b5563;line-height:1.7">
          If you believe this is an error, please contact our support team.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0" />
        <p style="color:#9ca3af;font-size:.85rem;text-align:center">
          Best regards,<br/>
          <strong style="color:#2E7D6B">The Comfort Counsel Team</strong>
        </p>
      </div>
    `
  });
};

/**
 * Send password reset link email.
 */
const sendPasswordResetEmail = async (email, name, resetLink) => {
  await transporter.sendMail({
    from: `"Comfort Counsel" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Link – Comfort Counsel',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:2rem;border:1px solid #e5e7eb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:1.5rem;">
          <h1 style="color:#2E7D6B;margin:0">🌿 Comfort Counsel</h1>
        </div>
        <h2 style="color:#1f2937">Password Reset Request</h2>
        <p style="color:#4b5563;line-height:1.7">
          Hello ${name},
        </p>
        <p style="color:#4b5563;line-height:1.7">
          We received a request to reset your password. Click the button below to reset your password.
          <strong>This link expires in 15 minutes.</strong>
        </p>
        <div style="text-align:center;margin:2rem 0;">
          <a href="${resetLink}"
             style="background:#2E7D6B;color:#fff;padding:.85rem 2rem;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem;display:inline-block;">
            Reset Your Password
          </a>
        </div>
        <p style="color:#4b5563;line-height:1.7">
          Or copy and paste this link in your browser:
        </p>
        <p style="color:#2E7D6B;word-break:break-all;font-size:.9rem;">
          ${resetLink}
        </p>
        <p style="color:#4b5563;line-height:1.7">
          If you didn't request a password reset, you can safely ignore this email.
        </p>
        <p style="color:#4b5563;line-height:1.7">
          <strong>Never share this link with anyone.</strong>
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0" />
        <p style="color:#9ca3af;font-size:.85rem;text-align:center">
          Best regards,<br/>
          <strong style="color:#2E7D6B">The Comfort Counsel Team</strong><br/>
          <a href="${APP_URL}" style="color:#2E7D6B">${APP_URL}</a>
        </p>
      </div>
    `
  });
};

module.exports = { sendPendingApprovalEmail, sendApprovalEmail, sendRejectionEmail, sendPasswordResetEmail };
