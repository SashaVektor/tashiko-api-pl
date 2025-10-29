export function renderItemsTable(items) {
  return (items || [])
    .map(
      (item) => `
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px">
            <img src="${item.imageLink}" alt="item" width="60" style="border-radius:6px" />
          </td>
          <td style="padding:10px;color:#111827">${item.name}</td>
          <td style="padding:10px;color:#111827">${item.price} zł</td>
          <td style="padding:10px;color:#111827">${item.quantity}</td>
        </tr>`,
    )
    .join('')
}

export function customerEmailPL({ name, phone, items, orderId }) {
  const itemsTable = renderItemsTable(items)
  return {
    subject: `Dziękujemy za zamówienie, ${name}!`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;padding:20px">
        <h2 style="margin:0 0 10px;color:#121212">Tashiko PL — potwierdzenie zamówienia</h2>
        <p style="margin:0 0 12px;color:#5F6B6D">Otrzymaliśmy Twoje zamówienie i wkrótce się z Tobą skontaktujemy.</p>

        <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:14px;margin:16px 0">
          <p style="margin:0;color:#303637"><b>Numer zamówienia:</b> ${orderId}</p>
          <p style="margin:6px 0 0;color:#303637"><b>Imię:</b> ${name}</p>
          <p style="margin:6px 0 0;color:#303637"><b>Telefon:</b> ${phone}</p>
        </div>

        <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:8px">
          <thead>
            <tr style="background:#AEBEFA;color:#121212">
              <th style="text-align:left;padding:10px">Zdjęcie</th>
              <th style="text-align:left;padding:10px">Produkt</th>
              <th style="text-align:left;padding:10px">Cena</th>
              <th style="text-align:left;padding:10px">Ilość</th>
            </tr>
          </thead>
          <tbody>${itemsTable}</tbody>
        </table>

        <p style="margin:18px 0 0;color:#5F6B6D">Jeśli masz pytania, po prostu odpowiedz na tę wiadomość.</p>
        <p style="margin:4px 0 0;color:#ADB6B8;font-size:12px">© Tashiko PL</p>
      </div>
    `,
    text: `Dziękujemy za zamówienie, ${name}! Numer zamówienia: ${orderId}. Skontaktujemy się wkrótce.`,
  }
}

export function adminEmailPL({ name, phone, items, orderId }) {
  const itemsTable = renderItemsTable(items)
  return {
    subject: `Nowe zamówienie #${orderId} — Tashiko PL`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;padding:20px">
        <h2 style="margin:0 0 10px;color:#121212">Nowe zamówienie na stronie Tashiko PL</h2>
        <div style="background:#FFF7ED;border:1px solid #FDE68A;border-radius:8px;padding:14px;margin:16px 0">
          <p style="margin:0;color:#303637"><b>Numer zamówienia:</b> ${orderId}</p>
          <p style="margin:6px 0 0;color:#303637"><b>Klient:</b> ${name}</p>
          <p style="margin:6px 0 0;color:#303637"><b>Telefon:</b> ${phone}</p>
        </div>

        <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:8px">
          <thead>
            <tr style="background:#FFB303;color:#121212">
              <th style="text-align:left;padding:10px">Zdjęcie</th>
              <th style="text-align:left;padding:10px">Produkt</th>
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

  const safe = (s = '') =>
    String(s || '')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  const subject = `Nowe zapytanie VIN #${requestId} — ${brand}`
  const html = `
  <div style="background:${bg};padding:24px;font-family:Arial,Helvetica,sans-serif;color:${white}">
    <div style="max-width:680px;margin:0 auto;background:${card};border-radius:10px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid ${primary}">
        <h1 style="margin:0;font-size:18px;color:${white}">
          Nowe zapytanie VIN <span style="color:${primary}">#${requestId}</span>
        </h1>
        <p style="margin:6px 0 0;color:${gray};font-size:13px">${brand} — powiadomienie administracyjne</p>
      </div>

      <div style="padding:20px 24px">
        <table style="width:100%;border-collapse:collapse;color:${white};font-size:14px">
          <tr>
            <td style="padding:8px 0;color:${gray};width:160px">Telefon</td>
            <td style="padding:8px 0">${safe(phone)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:${gray}">VIN</td>
            <td style="padding:8px 0"><strong>${safe(vin) || '—'}</strong></td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:${gray}">Użytkownik (ID)</td>
            <td style="padding:8px 0">${safe(userId) || '—'}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:${gray};vertical-align:top">Wiadomość</td>
            <td style="padding:8px 0;white-space:pre-wrap">${
              safe(text) || '—'
            }</td>
          </tr>
          ${
            photo
              ? `
          <tr>
            <td style="padding:8px 0;color:${gray};vertical-align:top">Zdjęcie</td>
            <td style="padding:8px 0">
              <a href="${safe(
                photo,
              )}" style="color:${primary};text-decoration:none">Otwórz zdjęcie</a>
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
Zdjęcie: ${photo || '-'}`

  return { subject, html, textPlain }
}
