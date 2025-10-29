// utils/templates/welcome-pl.js

// Paleta z Twojego Tailwinda
const colors = {
  lightBlue: '#AEBEFA',
  red: '#BB170E',
  orange: '#FFB303', // w Twojej palecie było "orage" — tu traktujemy jako orange
  darkGray: '#303637',
  mediumGray: '#5F6B6D',
  lightGray: '#ADB6B8',
  background: '#121212',
}

/**
 * Powitalny e-mail dla sklepu Tashiko PL
 * @param {{ name?: string }} params
 * @returns {{ subject: string, html: string, text: string }}
 */
export function welcomeEmailPL({ name = '' }) {
  const brand = 'Tashiko PL'
  const siteUrl = 'https://tashiko.pl' // jeśli inny, podmień tutaj

  const safeName = name?.trim() ? name.trim() : 'Kliencie'

  const subject = `Witamy w ${brand} — Twoje konto zostało utworzone`
  const preheader = `Dziękujemy za rejestrację w ${brand}. Sprawdź, jak szybciej znaleźć odpowiednie części do swojego auta.`

  // Wersja tekstowa (fallback)
  const text = [
    `Cześć ${safeName},`,
    `Dziękujemy za rejestrację w ${brand}. Twoje konto zostało pomyślnie utworzone.`,
    `Od teraz możesz przeglądać ofertę, zapisywać koszyki, śledzić zamówienia i szybciej finalizować zakupy.`,
    `Jeśli nie zakładałeś/zakładałaś konta, odpowiedz na tę wiadomość, a nasz zespół to sprawdzi.`,
    `Wejdź na ${siteUrl} i rozpocznij zakupy.`,
  ].join('\n')

  // Wersja HTML (styling pod e-maile)
  const html = `
  <!doctype html>
  <html lang="pl">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${subject}</title>
    <style>
      body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background:${
        colors.background
      }}
      table{border-collapse:collapse}
      img{border:0;outline:none;text-decoration:none;display:block;max-width:100%}
      a{color:${colors.lightBlue};text-decoration:none}
    </style>
  </head>
  <body style="background:${colors.background};">
    <!-- Preheader -->
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">
      ${preheader}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${
      colors.background
    };padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:92%;background:#000;border:1px solid ${
            colors.darkGray
          };border-radius:12px;overflow:hidden;">
            <!-- Header -->
            <tr>
              <td style="padding:20px 24px;background:#0B0B0B;border-bottom:1px solid ${
                colors.darkGray
              };">
                <div style="color:#fff;font-family:Inter,Arial,sans-serif;font-size:18px;font-weight:700;">
                  ${brand}
                </div>
                <div style="color:${
                  colors.lightGray
                };font-family:Inter,Arial,sans-serif;font-size:12px;margin-top:4px;">
                  Sklep z częściami samochodowymi
                </div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:28px 24px 8px 24px;">
                <div style="font-family:Inter,Arial,sans-serif;color:#fff;font-size:20px;font-weight:700;margin-bottom:8px;">
                  Cześć ${safeName},
                </div>

                <div style="font-family:Inter,Arial,sans-serif;color:${
                  colors.lightGray
                };font-size:14px;line-height:1.7;">
                  Dziękujemy za dołączenie do ${brand}. Twoje konto zostało pomyślnie utworzone, a zakupy będą teraz szybsze i wygodniejsze.
                  Zaloguj się, aby przeglądać katalog części, porównywać produkty i śledzić status zamówień.
                </div>

                <div style="height:18px;"></div>

                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <a href="${siteUrl}" target="_blank"
                        style="display:inline-block;background:${
                          colors.lightBlue
                        };color:#0B0B0B;font-family:Inter,Arial,sans-serif;font-weight:700;font-size:14px;padding:12px 18px;border-radius:8px;">
                        Przejdź do sklepu
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="height:22px;"></div>

                <div style="font-family:Inter,Arial,sans-serif;color:#fff;font-size:15px;font-weight:600;margin-bottom:8px;">
                  Szybkie wskazówki:
                </div>
                <ul style="padding-left:18px;margin:0;font-family:Inter,Arial,sans-serif;color:${
                  colors.lightGray
                };font-size:13px;line-height:1.7;">
                  <li>Wyszukuj po numerze VIN, modelu lub numerze katalogowym.</li>
                  <li>Dodawaj ulubione produkty do listy życzeń, aby wrócić do nich później.</li>
                  <li>Sprawdzaj dostępność na magazynie i przewidywany czas dostawy.</li>
                </ul>

                <div style="height:22px;"></div>

                <div style="font-family:Inter,Arial,sans-serif;color:#fff;font-size:15px;font-weight:600;margin-bottom:8px;">
                  Potrzebujesz pomocy?
                </div>
                <div style="font-family:Inter,Arial,sans-serif;color:${
                  colors.mediumGray
                };font-size:13px;line-height:1.7;">
                  Napisz do nas — doradzimy dobór części i status realizacji:
                  <a href="mailto:support@tashiko.pl" style="color:${
                    colors.lightBlue
                  };">support@tashiko.pl</a>.
                </div>

                <div style="height:8px;"></div>
                <div style="font-family:Inter,Arial,sans-serif;color:${
                  colors.mediumGray
                };font-size:12px;">
                  Jeśli to nie Ty zakładałeś konto, odpowiedz na tę wiadomość — natychmiast to sprawdzimy.
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:16px 24px;background:#0B0B0B;border-top:1px solid ${
                colors.darkGray
              };">
                <div style="font-family:Inter,Arial,sans-serif;color:${
                  colors.lightGray
                };font-size:12px;">
                  © ${new Date().getFullYear()} ${brand}. Wszelkie prawa zastrzeżone.
                </div>
                <div style="font-family:Inter,Arial,sans-serif;color:${
                  colors.mediumGray
                };font-size:12px;margin-top:4px;">
                  Ten e-mail został wysłany automatycznie.
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `

  return { subject, html, text }
}
