import expressAsyncHandler from 'express-async-handler'
import SiteSettings from '../models/SiteSettings.js'

const emptySettings = {
  key: 'site-settings',
  contacts: { emails: [], phones: [] },
  workingHours: { ua: '', ru: '', pl: '' },
  delivery: {
    title: { ua: '', ru: '', pl: '' },
    blocks: [],
  },
}

const editableFields = ({ contacts, workingHours, delivery }) => ({
  contacts,
  workingHours,
  delivery,
})

export const getSiteSettings = expressAsyncHandler(async (_req, res) => {
  const settings = await SiteSettings.findOne({ key: 'site-settings' }).lean()
  res.send(settings || emptySettings)
})

export const updateSiteSettings = expressAsyncHandler(async (req, res) => {
  const settings = await SiteSettings.findOneAndUpdate(
    { key: 'site-settings' },
    { $set: editableFields(req.body) },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  )

  res.status(200).send(settings)
})
