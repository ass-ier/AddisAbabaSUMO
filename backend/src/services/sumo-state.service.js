/**
 * Sumo State Service
 * Holds lightweight in-memory snapshots from the SUMO bridge for reuse across routes.
 */
class SumoStateService {
  constructor() {
    this._latestVehiclesSnapshot = { timestamp: 0, vehicles: [] };
  }

  setLatestVehiclesSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;
    this._latestVehiclesSnapshot = {
      timestamp: Number(snapshot.timestamp || Date.now()),
      vehicles: Array.isArray(snapshot.vehicles) ? snapshot.vehicles : [],
    };
  }

  getLatestVehiclesSnapshot() {
    return this._latestVehiclesSnapshot;
  }
}

module.exports = new SumoStateService();