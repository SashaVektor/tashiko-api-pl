import { adminEmailPL } from "../utils/templates/adminEmailTemplates.js";
import { customerEmailPL } from "../utils/templates/customerEmailTemplates.js";
import { getAdminNotificationEmail } from "../utils/getAdminNotificationEmail.js";
import { logEmailResults, queueEmailsAndAttempt } from "./emailOutbox.js";

// Fire-and-forget: callers should not await this so the HTTP response isn't
// held up by outbound SMTP sends (the email outbox already retries on failure).
export const sendOrderNotificationEmails = async ({
  kindPrefix,
  orderId,
  name,
  phone,
  email,
  items,
  details,
}) => {
  try {
    const adminTo = await getAdminNotificationEmail();
    const messages = [];

    if (email) {
      const customerEmail = customerEmailPL({
        name,
        phone,
        items,
        orderId,
        details,
      });
      messages.push({
        kind: `${kindPrefix}-customer`,
        relatedId: String(orderId),
        to: email,
        subject: customerEmail.subject,
        html: customerEmail.html,
        text: customerEmail.text,
      });
    }

    if (adminTo) {
      const adminEmail = adminEmailPL({
        name,
        phone,
        items,
        orderId,
        details,
      });
      messages.push({
        kind: `${kindPrefix}-admin`,
        relatedId: String(orderId),
        to: adminTo,
        subject: adminEmail.subject,
        html: adminEmail.html,
        text: adminEmail.text,
      });
    } else {
      console.warn("[Mailer] ADMIN_EMAIL is not configured");
    }

    const results = await queueEmailsAndAttempt(messages);
    logEmailResults(results, `${kindPrefix} ${orderId}`);
  } catch (mailError) {
    console.error("[Mailer] queueing failed:", mailError);
  }
};
