import express from 'express'
import {
  getSiteSettings,
  updateSiteSettings,
} from '../controllers/siteSettingsController.js'
import { isAdmin, isAuth } from '../utils.js'

const siteSettingsRoute = express.Router()

siteSettingsRoute.get('/', getSiteSettings)
siteSettingsRoute.put('/', isAuth, isAdmin, updateSiteSettings)

export default siteSettingsRoute
