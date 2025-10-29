import nodemailer from 'nodemailer'

function createTransporter() {
  const host = process.env.EMAIL_HOST // напр. smtpout.secureserver.net / smtp.gmail.com / smtp.dpoczta.pl
  const port = Number(process.env.EMAIL_PORT || 587)
  const user = process.env.EMAIL_USER // полный e-mail отправителя
  const pass = process.env.EMAIL_PASS // пароль или App Password
  const from = process.env.EMAIL_FROM || user // подпись отправителя

  if (!host || !user || !pass) {
    throw new Error(
      `[Mailer] EMAIL_HOST/EMAIL_USER/EMAIL_PASS not set. host=${
        host || '-'
      } user=${user || '-'} passLen=${pass ? pass.length : 0}`,
    )
  }

  const secure = port === 465 // 465 => SMTPS, 587/25 => STARTTLS

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })

  return { transporter, from }
}

export async function sendMail({ to, subject, html, text }) {
  const { transporter, from } = createTransporter()
  return transporter.sendMail({
    from,
    to,
    subject,
    html: html || '',
    text: text || '',
  })
}
