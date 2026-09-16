const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function sendMail({ to, subject, html }) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
}

const sendResetPasswordEmail = (to, resetUrl) =>
  sendMail({
    to,
    subject: 'Reset your Swiftener password',
    html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Click here to reset your password</a>. This link expires in 1 hour.</p><p>If you didn't request this, ignore this email.</p>`,
  });

const sendVerifyEmail = (to, verifyUrl) =>
  sendMail({
    to,
    subject: 'Verify your Swiftener account',
    html: `<p>Welcome to Swiftener! <a href="${verifyUrl}">Click here to verify your email</a>.</p>`,
  });

const sendInviteEmail = (to, inviteUrl, inviterName) =>
  sendMail({
    to,
    subject: `${inviterName} invited you to Swiftener`,
    html: `<p>${inviterName} thinks you'd like Swiftener. <a href="${inviteUrl}">Join here</a>.</p>`,
  });

const sendNewsletterVerifyEmail = (to, verifyUrl) =>
  sendMail({
    to,
    subject: 'Confirm your Swiftener newsletter subscription',
    html: `<p><a href="${verifyUrl}">Click here to confirm</a> your subscription to the Swiftener newsletter.</p>`,
  });

const sendNewNotificationEmail = (to, message, link) =>
  sendMail({
    to,
    subject: 'New activity on Swiftener',
    html: `<p>${message}</p>${link ? `<p><a href="${link}">View</a></p>` : ''}`,
  });

module.exports = {
  sendMail,
  sendResetPasswordEmail,
  sendVerifyEmail,
  sendInviteEmail,
  sendNewsletterVerifyEmail,
  sendNewNotificationEmail,
};
