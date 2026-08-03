import { escapeHtml, sanitizeUrl } from './escapeHtml.js'

export function renderItemsTable(items) {
  return (items || [])
    .map(
      (item) => `
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px">
            <img src="${escapeHtml(sanitizeUrl(item.imageLink))}" alt="item" width="60" style="border-radius:6px" />
          </td>
          <td style="padding:10px;color:#111827">${escapeHtml(item.name)}</td>
          <td style="padding:10px;color:#111827">${escapeHtml(item.productCode) || '—'}</td>
          <td style="padding:10px;color:#111827">${escapeHtml(item.price)} zł</td>
          <td style="padding:10px;color:#111827">${escapeHtml(item.quantity)}</td>
        </tr>`,
    )
    .join('')
}
