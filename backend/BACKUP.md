# Backup Job

This document explains the automated backup job that copies key API data into MongoDB backup collections for disaster recovery and analytics snapshots.

## What it does
- Runs automatically on startup (after ~10s) and then on a fixed interval.
- Calls internal authenticated APIs and upserts data into `backup_*` collections.
- Backs up a time window of recent data (rolling window).

Backed up datasets and target collections:
- Users → `backup_users`
- Emergencies → `backup_emergencies`
- Audit logs (windowed) → `backup_auditlogs`
- Traffic data (windowed) → `backup_trafficdatas`
- KPIs (windowed aggregate snapshot) → `backup_reports_kpis`
- Trends (windowed aggregate snapshot) → `backup_reports_trends`
- Aggregates (windowed aggregate snapshot; optional endpoint) → `backup_traffic_aggregates`

Code locations:
- Job: `src/services/backup.job.js`
- Bootstrapped in: `server-new.js` (called inside the server start block)

## Configuration
The backend loads environment variables from `backend/config.env`.

Required/optional variables:
- `MONGODB_URI` (required) – MongoDB connection string
- `ACCESS_TOKEN_SECRET` (required) – secret used to sign short-lived internal JWT for backup API calls
- `PORT` (recommended) – backend server port (also used to derive `BACKUP_BASE_URL` if not provided)
- `BACKUP_ENABLED` (required to enable) – set `1`/`true`/`yes` to enable the job
- `BACKUP_INTERVAL_MINUTES` (optional, default 60) – how often to run
- `BACKUP_DAYS` (optional, default 30) – rolling window lookback used on windowed endpoints
- `BACKUP_BASE_URL` (optional) – defaults to `http://localhost:${PORT}`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` – used by the app cache (not required for backup itself)

Example (already appended to `config.env`):

```
BACKUP_ENABLED=1
BACKUP_INTERVAL_MINUTES=60
BACKUP_DAYS=30
BACKUP_BASE_URL=http://localhost:5001
```

## Endpoints used
The job calls these internal endpoints using a short-lived JWT (`super_admin` role):
- `GET /api/users`
- `GET /api/emergencies`
- `GET /api/audit?startDate=...&endDate=...&limit=5000`
- `GET /api/traffic-data?startDate=...&endDate=...&limit=5000`
- `GET /api/reports/kpis?startDate=...&endDate=...`
- `GET /api/reports/trends?startDate=...&endDate=...`
- `GET /api/traffic/aggregates?startDate=...&endDate=...` (optional; if missing the job continues without failing)

Notes:
- Responses are normalized to arrays when possible; bulk upserts are performed with `upsert: true`.
- Windowed calls use `BACKUP_DAYS` to compute `since`→`until`.

## How to enable
1) Ensure `ACCESS_TOKEN_SECRET` is set to a strong secret in `config.env`.
2) Set `BACKUP_ENABLED=1` (and tune other `BACKUP_*` variables as desired).
3) Restart the backend. On startup you should see a log similar to:
   - `[backup] Enabled. Interval=60min, Window=30d, Base=http://localhost:5001`
   - After ~10 seconds: `[backup] Completed at 2025-...` (or errors if any)

## Verifying backups
- Check logs for `[backup]` lines.
- Inspect MongoDB collections:
  - `backup_users`, `backup_emergencies`, `backup_auditlogs`, `backup_trafficdatas`
  - `backup_reports_kpis`, `backup_reports_trends`, `backup_traffic_aggregates`

Example mongosh checks:

```
use traffic_management
show collections

db.backup_users.countDocuments()
db.backup_trafficdatas.find().sort({ _id: -1 }).limit(5)
db.backup_reports_kpis.findOne()
db.backup_reports_trends.findOne()
```

## Restore examples (manual)
You can restore from a backup collection into a primary collection using upserts. Adjust field mappings as needed.

Users:
```
db.backup_users.find().forEach(d => {
  db.users.updateOne({ _id: d._id }, { $set: d }, { upsert: true })
})
```

Emergency records:
```
db.backup_emergencies.find().forEach(d => {
  db.emergencies.updateOne({ _id: d._id }, { $set: d }, { upsert: true })
})
```

Traffic data (by composite key already stored in `_id`):
```
db.backup_trafficdatas.find().forEach(d => {
  db.trafficdatas.updateOne({ _id: d._id }, { $set: d }, { upsert: true })
})
```

Note: For aggregate snapshots (KPIs/Trends/Aggregates) you typically restore into analytics collections or export to files depending on your use case.

## Scheduling behavior
- Initial run starts ~10 seconds after the server starts.
- Then runs every `BACKUP_INTERVAL_MINUTES` minutes.
- Each run backs up a rolling window of `BACKUP_DAYS`.

## Troubleshooting
- 401/403 from API calls → Ensure `ACCESS_TOKEN_SECRET` matches the server’s validator and that the job issues `super_admin`-role tokens.
- Network errors → Verify `BACKUP_BASE_URL` is reachable from the backend.
- Missing `/api/traffic/aggregates` → Safe to ignore; the job continues. You can add the endpoint later or remove that section from the job.
- Large datasets → Increase `limit` on windowed endpoints or reduce `BACKUP_INTERVAL_MINUTES`.
- Timeouts → Increase axios timeout in `backup.job.js` if necessary (default: 60s).

## Indexing suggestions
For faster upserts:
- `backup_users(_id)` (implicit if `_id` is used)
- `backup_emergencies(_id)`
- `backup_auditlogs(_id)`
- `backup_trafficdatas(_id)`

## Security
- Keep `ACCESS_TOKEN_SECRET` secret and strong.
- The job uses a short-lived JWT (5 minutes) per run and only calls internal endpoints.

## Manual/On-demand backup
The job is time-based. To trigger sooner:
- Temporarily set `BACKUP_INTERVAL_MINUTES=1` and restart, or
- Restart the backend (initial run occurs ~10s after startup).
