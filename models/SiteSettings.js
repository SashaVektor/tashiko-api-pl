import mongoose from 'mongoose'

const localizedTextSchema = new mongoose.Schema(
  {
    ua: { type: String, default: '' },
    ru: { type: String, default: '' },
    pl: { type: String, default: '' },
  },
  { _id: false },
)

const contactSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: '' },
    value: { type: String, trim: true, required: true },
    displayValue: { type: String, trim: true, default: '' },
    isPrimary: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
    languages: {
      type: [{ type: String, enum: ['ua', 'ru', 'pl'] }],
      default: ['ua', 'ru', 'pl'],
    },
  },
  { _id: true },
)

const contentBlockSchema = new mongoose.Schema(
  {
    title: { type: localizedTextSchema, default: () => ({}) },
    content: { type: localizedTextSchema, default: () => ({}) },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    languages: {
      type: [{ type: String, enum: ['ua', 'ru', 'pl'] }],
      default: ['ua', 'ru', 'pl'],
    },
  },
  { _id: true },
)

const siteSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'site-settings',
      unique: true,
      immutable: true,
    },
    contacts: {
      emails: { type: [contactSchema], default: [] },
      phones: { type: [contactSchema], default: [] },
    },
    notifications: {
      adminEmail: { type: String, trim: true, default: '' },
      adminEmailPl: { type: String, trim: true, default: '' },
    },
    workingHours: { type: localizedTextSchema, default: () => ({}) },
    delivery: {
      title: { type: localizedTextSchema, default: () => ({}) },
      blocks: { type: [contentBlockSchema], default: [] },
    },
  },
  { timestamps: true },
)

const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema)

export default SiteSettings
