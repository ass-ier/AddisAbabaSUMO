# AddisAbaba SUMO Traffic Management API – Swagger Docs

This backend exposes a REST API for authentication, user and traffic management, reporting, and SUMO/TLS control. Interactive API documentation is available via Swagger UI.

## Quick start

- Install dependencies
  - Backend dependencies (already present in this repo):
    - express, mongoose, ioredis, socket.io, etc.
    - Swagger tooling: `swagger-ui-express`, `swagger-jsdoc`
- Configure environment
  - Copy `backend/config.env` template if needed and set:
    - `PORT` (default 5001)
    - `MONGODB_URI`
    - `ACCESS_TOKEN_SECRET`
    - Optional: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `SUMO_HOME`, `SUMO_CONFIG_PATH`
- Run the server

```bash
# from project root
npm --prefix backend run dev
# or
npm --prefix backend start
```

Then open these URLs:
- Swagger UI: http://localhost:5001/api/docs
- OpenAPI JSON: http://localhost:5001/api/openapi.json
- Health check: http://localhost:5001/health

## Authentication in Swagger UI

Most endpoints require JWT auth. In Swagger UI, click “Authorize” and enter a Bearer token.

1. Use `POST /api/auth/login` with your credentials
2. Copy the `token` from the response
3. Click “Authorize” and input: `Bearer YOUR_JWT_TOKEN`

This API also supports an HttpOnly cookie named `access_token`. If you already have the cookie in your browser (from the app), “Try it out” may work without adding the bearer token.

## API areas covered

- Auth: login, register, logout, verify/validate, reset-password
- OTP: send, verify, resend, check-verification
- Users: CRUD, profile, counts, role queries, statistics
- Traffic data: create, query, export CSV, stats
- Settings: get/update system settings
- Emergencies: list/create/force-clear
- Audit: list and export CSV
- Reports/Stats: KPIs, trends, overview, admin
- Operator: monitoring, analytics, alerts, reports, commands, user ops
- SUMO/TLS: simulation status, config, control, TLS control, bridge utilities

See the full parameter details and sample payloads in Swagger UI.

## Updating the docs

OpenAPI spec lives at `backend/src/docs/openapi.js`.
- Add or update path entries to document new endpoints
- Optionally add more schemas under `components.schemas`
- If you prefer annotation-driven docs, we included `swagger-jsdoc` so you can add JSDoc-style comments in route files and switch the loader to `swaggerJSDoc` in the future.

## Notes

- This documentation targets the three-tier architecture booted by `server-new.js` under `/api`.
- Some legacy endpoints in `server.js` are not meant for production; prefer the modular routes mounted by `server-new.js`.
