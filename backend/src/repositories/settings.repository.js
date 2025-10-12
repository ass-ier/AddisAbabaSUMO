const Settings = require('../models/Settings');

class SettingsRepository {
  /**
   * Get settings (there should only be one document)
   */
  async get() {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    return settings;
  }

  /**
   * Update settings
   */
  async update(data) {
    return await Settings.findOneAndUpdate(
      {},
      { ...data, updatedAt: new Date() },
      { new: true, upsert: true }
    );
  }

  /**
   * Update specific setting field
   */
  async updateField(field, value) {
    const update = { [field]: value, updatedAt: new Date() };
    return await Settings.findOneAndUpdate(
      {},
      { $set: update },
      { new: true, upsert: true }
    );
  }
}

module.exports = new SettingsRepository();
