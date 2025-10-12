const Emergency = require('../models/Emergency');

class EmergencyRepository {
  /**
   * Create new emergency
   */
  async create(data) {
    return await Emergency.create(data);
  }

  /**
   * Find emergency by ID
   */
  async findById(id) {
    return await Emergency.findById(id);
  }

  /**
   * Find active emergencies
   */
  async findActive() {
    return await Emergency.find({ active: true }).sort({ createdAt: -1 });
  }

  /**
   * Find all emergencies
   */
  async findAll(options = {}) {
    const { limit = 100, sort = { createdAt: -1 } } = options;
    return await Emergency.find().sort(sort).limit(parseInt(limit));
  }

  /**
   * Update emergency by ID
   */
  async update(id, data) {
    return await Emergency.findByIdAndUpdate(id, data, { new: true });
  }

  /**
   * Deactivate emergency
   */
  async deactivate(id) {
    return await Emergency.findByIdAndUpdate(
      id,
      { active: false },
      { new: true }
    );
  }

  /**
   * Delete emergency
   */
  async delete(id) {
    return await Emergency.findByIdAndDelete(id);
  }

  /**
   * Count active emergencies
   */
  async countActive() {
    return await Emergency.countDocuments({ active: true });
  }
}

module.exports = new EmergencyRepository();
