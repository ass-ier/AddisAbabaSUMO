const axios = require('axios');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

/**
 * Hourly backup job: fetches API data and upserts into backup_* collections.
 * Enabled when BACKUP_ENABLED=1 (or "true").
 * Config:
 *  - BACKUP_INTERVAL_MINUTES (default 60)
 *  - BACKUP_DAYS (default 30)
 *  - BACKUP_BASE_URL (default http://localhost:PORT)
 */
function initBackupJob({ port }) {
  const enabled = String(process.env.BACKUP_ENABLED || '0').toLowerCase() in { '1':1, 'true':1, 'yes':1 };
  if (!enabled) return;

  const intervalMin = Number(process.env.BACKUP_INTERVAL_MINUTES || 60);
  const windowDays = Number(process.env.BACKUP_DAYS || 30);
  const baseUrl = (process.env.BACKUP_BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');

  async function runOnce() {
    try {
      const db = mongoose.connection.db;
      const colUsers = db.collection('backup_users');
      const colEmerg = db.collection('backup_emergencies');
      const colAudit = db.collection('backup_auditlogs');
      const colTraffic = db.collection('backup_trafficdatas');
      const colKpis = db.collection('backup_reports_kpis');
      const colTrends = db.collection('backup_reports_trends');
      const colAggregates = db.collection('backup_traffic_aggregates');

      // Short-lived JWT for internal calls
      const token = jwt.sign(
        { username: 'system-cron', role: 'super_admin' },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '5m' }
      );
      const s = axios.create({ headers: { Authorization: `Bearer ${token}` }, timeout: 60000 });

      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
      const until = new Date().toISOString();

      // Users
      try {
        const u = await s.get(`${baseUrl}/api/users`);
        const items = Array.isArray(u.data) ? u.data : (Array.isArray(u.data?.items) ? u.data.items : []);
        if (items.length) {
          const ops = items.map((d) => ({
            updateOne: {
              filter: { _id: d._id || d.id },
              update: { $set: { ...d, _backedAt: new Date() } },
              upsert: true,
            },
          }));
          if (ops.length) await colUsers.bulkWrite(ops, { ordered: false });
        }
      } catch (_) {}

      // Emergencies
      try {
        const e = await s.get(`${baseUrl}/api/emergencies`);
        const items = Array.isArray(e.data) ? e.data : (Array.isArray(e.data?.items) ? e.data.items : []);
        if (items.length) {
          const ops = items.map((d) => ({
            updateOne: {
              filter: { _id: d._id || d.id || d.emergencyId },
              update: { $set: { ...d, _backedAt: new Date() } },
              upsert: true,
            },
          }));
          if (ops.length) await colEmerg.bulkWrite(ops, { ordered: false });
        }
      } catch (_) {}

      // Audit (window)
      try {
        const a = await s.get(`${baseUrl}/api/audit`, { params: { startDate: since, endDate: until, limit: 5000 } });
        const items = Array.isArray(a.data)
          ? a.data
          : Array.isArray(a.data?.items)
          ? a.data.items
          : Array.isArray(a.data?.items?.items)
          ? a.data.items.items
          : [];
        if (items.length) {
          const ops = items.map((d) => ({
            updateOne: {
              filter: { _id: d._id || `${d.time}|${d.user}|${d.action}|${d.target}` },
              update: { $set: { ...d, _backedAt: new Date() } },
              upsert: true,
            },
          }));
          if (ops.length) await colAudit.bulkWrite(ops, { ordered: false });
        }
      } catch (_) {}

      // Traffic data (window)
      try {
        const t = await s.get(`${baseUrl}/api/traffic-data`, { params: { startDate: since, endDate: until, limit: 5000 } });
        const rows = Array.isArray(t.data) ? t.data : (Array.isArray(t.data?.items) ? t.data.items : []);
        if (rows.length) {
          const ops = rows.map((d) => {
            const bs = d.bucketStart || d.timestamp || '';
            const be = d.bucketEnd || '';
            const iid = d.intersectionId || d.clusterId || d.tls_id || '';
            const key = `${iid}|${bs}|${be}`;
            return {
              updateOne: {
                filter: { _id: key },
                update: { $set: { ...d, _backedAt: new Date() } },
                upsert: true,
              },
            };
          });
          if (ops.length) await colTraffic.bulkWrite(ops, { ordered: false });
        }
      } catch (_) {}

      // KPIs (window)
      try {
        const k = await s.get(`${baseUrl}/api/reports/kpis`, { params: { startDate: since, endDate: until } });
        if (k.data && typeof k.data === 'object') {
          const doc = { _id: `kpis_${since}_${until}`, window: { start: since, end: until }, ...k.data, _backedAt: new Date() };
          await colKpis.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
        }
      } catch (_) {}

      // Trends (window)
      try {
        const tr = await s.get(`${baseUrl}/api/reports/trends`, { params: { startDate: since, endDate: until } });
        const daily = tr.data?.daily || [];
        if (daily.length) {
          const doc = { _id: `trends_${since}_${until}`, window: { start: since, end: until }, daily: daily, _backedAt: new Date() };
          await colTrends.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
        }
      } catch (_) {}

      // Aggregates (window)
      try {
        const ag = await s.get(`${baseUrl}/api/traffic/aggregates`, { params: { startDate: since, endDate: until } });
        if (ag.data && typeof ag.data === 'object') {
          const doc = { _id: `agg_${since}_${until}`, window: { start: since, end: until }, ...ag.data, _backedAt: new Date() };
          await colAggregates.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
        }
      } catch (_) {}

      console.log(`[backup] Completed at ${new Date().toISOString()}`);
    } catch (err) {
      console.error('[backup] Error:', err?.message || err);
    }
  }

  // Initial run a bit after startup, then interval
  setTimeout(runOnce, 10_000);
  setInterval(runOnce, Math.max(1, intervalMin) * 60 * 1000);
  console.log(`[backup] Enabled. Interval=${intervalMin}min, Window=${windowDays}d, Base=${baseUrl}`);
}

module.exports = { initBackupJob };
