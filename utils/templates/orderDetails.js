import { escapeHtml } from "./escapeHtml.js";

export const renderOrderDetails = (details, labels) => {
  if (!details) return { html: "", text: "" };

  const rows = [
    [labels.recipient, details.recipient],
    [labels.company, details.company],
    [labels.deliveryMethod, details.deliveryMethod],
    [labels.city, details.city],
    [labels.address, details.address],
    [labels.paymentMethod, details.paymentMethod],
    [
      labels.paymentStatus,
      details.isPaid ? labels.paymentPaid : labels.paymentUnpaid,
    ],
    [labels.comment, details.comment],
    [
      labels.total,
      Number.isFinite(details.totalPrice)
        ? `${details.totalPrice} ${details.currency || ""}`.trim()
        : "",
    ],
    [labels.quantity, details.totalQuantity],
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  return {
    html: rows
      .map(
        ([label, value]) => `
          <tr>
            <td style="padding:6px 10px 6px 0;color:#5F6B6D;vertical-align:top"><b>${escapeHtml(label)}</b></td>
            <td style="padding:6px 0;color:#303637;white-space:pre-wrap">${escapeHtml(value)}</td>
          </tr>`,
      )
      .join(""),
    text: rows.map(([label, value]) => `${label}: ${value}`).join("\n"),
  };
};
