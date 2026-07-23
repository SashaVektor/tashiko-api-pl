import express from 'express'
import {
  getAdminSiteSettings,
  getSiteSettings,
  sendAdminTestEmail,
  updateSiteSettings,
} from '../controllers/siteSettingsController.js'
import { isAdmin, isAuth } from '../utils.js'

const siteSettingsRoute = express.Router()

siteSettingsRoute.get('/', getSiteSettings)
siteSettingsRoute.get('/admin', isAuth, isAdmin, getAdminSiteSettings)
siteSettingsRoute.post('/admin/test-email', isAuth, isAdmin, sendAdminTestEmail)
siteSettingsRoute.put('/', isAuth, isAdmin, updateSiteSettings)

export default siteSettingsRoute
