export async function getAdminNotificationEmail() {
  return process.env.ADMIN_EMAIL?.trim() || undefined
}
