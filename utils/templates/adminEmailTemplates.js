import { renderItemsTable } from './itemsTable.js'
import { escapeHtml, sanitizeHeaderValue, sanitizeUrl } from './escapeHtml.js'

export function adminEmailPL({ name, phone, items, orderId }) {
  const itemsTable = renderItemsTable(items)
  const safeName = escapeHtml(name)
  const safePhone = escapeHtml(phone)
  const safeOrderId = escapeHtml(orderId)
  return {
    subject: `Nowe zamówienie #${sanitizeHeaderValue(orderId)} — Tashiko PL`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;padding:20px">
        <h2 style="margin:0 0 10px;color:#121212">Nowe zamówienie na stronie Tashiko PL</h2>
        <div style="background:#FFF7ED;border:1px solid #FDE68A;border-radius:8px;padding:14px;margin:16px 0">
          <p style="margin:0;color:#303637"><b>Numer zamówienia:</b> ${safeOrderId}</p>
          <p style="margin:6px 0 0;color:#303637"><b>Klient:</b> ${safeName}</p>
          <p style="margin:6px 0 0;color:#303637"><b>Telefon:</b> ${safePhone}</p>
        </div>

        <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:8px">
          <thead>
            <tr style="background:#FFB303;color:#121212">
              <th style="text-align:left;padding:10px">Zdjęcie</th>
              <th style="text-align:left;padding:10px">Produkt</th>
              <th style="text-align:left;padding:10px">Kod produktu</th>
              <th style="text-align:left;padding:10px">Cena</th>
              <th style="text-align:left;padding:10px">Ilość</th>
            </tr>
          </thead>
          <tbody>${itemsTable}</tbody>
        </table>

        <p style="margin:18px 0 0;color:#303637"><b>Uwaga:</b> to automatyczna wiadomość. Nie zapomnij przetworzyć zamówienia.</p>
      </div>
    `,
    text: `Nowe zamówienie #${orderId}. Klient: ${name}, telefon: ${phone}.`,
  }
}

export function vinAdminEmailPL({
  requestId,
  phone,
  vin,
  text,
  photo,
  userId,
}) {
  const brand = 'Tashiko PL'
  const primary = '#BB170E'
  const bg = '#121212'
  const card = '#303637'
  const gray = '#ADB6B8'
  const white = '#FFFFFF'

  const safePhone = escapeHtml(phone)
  const safeVin = escapeHtml(vin)
  const safeUserId = escapeHtml(userId)
  const safeText = escapeHtml(text)
  const safePhotoUrl = sanitizeUrl(photo)

  const subject = `Nowe zapytanie VIN #${sanitizeHeaderValue(requestId)} — ${brand}`
  const html = `
  <div style="background:${bg};padding:24px;font-family:Arial,Helvetica,sans-serif;color:${white}">
    <div style="max-width:680px;margin:0 auto;background:${card};border-radius:10px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid ${primary}">
        <h1 style="margin:0;font-size:18px;color:${white}">
          Nowe zapytanie VIN <span style="color:${primary}">#${escapeHtml(requestId)}</span>
        </h1>
        <p style="margin:6px 0 0;color:${gray};font-size:13px">${brand} — powiadomienie administracyjne</p>
      </div>

      <div style="padding:20px 24px">
        <table style="width:100%;border-collapse:collapse;color:${white};font-size:14px">
          <tr>
            <td style="padding:8px 0;color:${gray};width:160px">Telefon</td>
            <td style="padding:8px 0">${safePhone}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:${gray}">VIN</td>
            <td style="padding:8px 0"><strong>${safeVin || '—'}</strong></td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:${gray}">Użytkownik (ID)</td>
            <td style="padding:8px 0">${safeUserId || '—'}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:${gray};vertical-align:top">Wiadomość</td>
            <td style="padding:8px 0;white-space:pre-wrap">${safeText || '—'}</td>
          </tr>
          ${
            safePhotoUrl
              ? `
          <tr>
            <td style="padding:8px 0;color:${gray};vertical-align:top">Zdjęcie</td>
            <td style="padding:8px 0">
              <a href="${escapeHtml(safePhotoUrl)}" style="color:${primary};text-decoration:none">Otwórz zdjęcie</a>
            </td>
          </tr>`
              : ''
          }
        </table>
      </div>

      <div style="padding:16px 24px;border-top:1px solid ${primary};color:${gray};font-size:12px">
        To jest automatyczna wiadomość. Odpowiedz do klienta zgodnie z procesem obsługi zgłoszeń.
      </div>
    </div>
  </div>`

  const textPlain = `Nowe zapytanie VIN #${requestId}
Telefon: ${phone || '-'}
VIN: ${vin || '-'}
Użytkownik (ID): ${userId || '-'}
Wiadomość: ${text || '-'}
Zdjęcie: ${safePhotoUrl || '-'}`

  return { subject, html, textPlain }
}

export function contactAdminEmail({ phone, message, page }) {
  const brand = 'Tashiko PL'
  const primary = '#BB170E'
  const bg = '#121212'
  const card = '#303637'
  const gray = '#ADB6B8'
  const white = '#FFFFFF'

  const safePhone = escapeHtml(phone)
  const safeMessage = escapeHtml(message)
  const safePageUrl = sanitizeUrl(page)

  const subject = `Nowa wiadomość kontaktowa — ${brand}`

  const html = `
  <div style="background:${bg};padding:24px;font-family:Arial,Helvetica,sans-serif;color:${white}">
    <div style="max-width:680px;margin:0 auto;background:${card};border-radius:10px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid ${primary}">
        <h1 style="margin:0;font-size:18px;color:${white}">Wiadomość kontaktowa</h1>
        <p style="margin:6px 0 0;color:${gray};font-size:13px">${brand} — powiadomienie administracyjne</p>
      </div>

      <div style="padding:20px 24px">
        <table style="width:100%;border-collapse:collapse;color:${white};font-size:14px">
          <tr>
            <td style="padding:8px 0;color:${gray};width:160px">Telefon</td>
            <td style="padding:8px 0"><strong>${safePhone}</strong></td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:${gray};vertical-align:top">Wiadomość</td>
            <td style="padding:8px 0;white-space:pre-wrap">${safeMessage}</td>
          </tr>
          ${
            safePageUrl
              ? `<tr>
                  <td style="padding:8px 0;color:${gray};vertical-align:top">Strona</td>
                  <td style="padding:8px 0">
                    <a href="${escapeHtml(safePageUrl)}" style="color:${primary};text-decoration:none">${escapeHtml(safePageUrl)}</a>
                  </td>
                </tr>`
              : ''
          }
        </table>
      </div>

      <div style="padding:16px 24px;border-top:1px solid ${primary};color:${gray};font-size:12px">
        To jest automatyczna wiadomość z formularza kontaktowego.
      </div>
    </div>
  </div>
  `

  const textPlain = `Nowa wiadomość kontaktowa — ${brand}
Telefon: ${phone}
Wiadomość: ${message}
Strona: ${safePageUrl || '-'}`

  return { subject, html, textPlain }
}
