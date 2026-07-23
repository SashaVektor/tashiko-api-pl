import SiteSettings from '../models/SiteSettings.js'

export async function getAdminNotificationEmail() {
  const settings = await SiteSettings.findOne({ key: 'site-settings' })
    .select('notifications')
    .lean()

  return settings?.notifications?.adminEmailPl?.trim() || undefined
}
