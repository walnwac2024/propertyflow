# PropertyFlow

Modern Property Management ERP built with React, Node.js, Express, and MySQL.

## Stack

- React + Vite frontend
- Node.js + Express REST API
- MySQL database
- JWT authentication with role-based authorization
- Modular schema for companies, projects, floors, units, owners, tenants, billing, expenses, payments, notifications, and audit logs

## Local Setup

1. Make sure WAMP/MySQL is running.
2. Confirm the database `propertyflow` exists.
3. Install dependencies:

```bash
npm run install:all
```

4. Configure backend env:

```bash
copy server\.env.example server\.env
```

The default env uses `localhost`, database `propertyflow`, user `root`, and blank password.

5. Create tables and seed admin/demo data:

```bash
npm run migrate
npm run seed
```

6. Start the app:

```bash
npm run dev
```

Frontend: http://localhost:5173
API: http://localhost:4000/api

## Frontend and API URLs

- Frontend API base URL: `client/src/api.js`
- Optional frontend override: `client/.env` with `VITE_API_URL=...`
- Backend allowed frontend origin: `server/.env` with `CLIENT_ORIGIN=...`
- Backend proxy mode for nginx/PM2: `server/.env` with `TRUST_PROXY=1`

Default behavior:

- If the frontend is opened with `http://`, it uses `http://localhost:4000/api`.
- If the frontend is opened with `https://`, it uses `https://api.proproperty.cloud/api`.
- If the backend runs with `NODE_ENV=production`, its default `CLIENT_ORIGIN` is `https://proproperty.cloud`.
- If the backend runs with `NODE_ENV=production`, `TRUST_PROXY` defaults to `1` so nginx forwarded IP headers work with rate limiting.

## Default Login

- Email: `admin@propertyflow.local`
- Password: `Admin@12345`

Change this password after first login in a real deployment.

## VPS Security Notes

- Set a strong `JWT_SECRET` in `server/.env` before running with `NODE_ENV=production`.
- Change the default admin password immediately after deployment.
- Use a dedicated MySQL user with privileges only for the `propertyflow` database; do not use root on a VPS.
- Keep `server/uploads/` outside public web roots when possible, and only allow trusted users to upload documents.
- Put the API behind HTTPS and set `CLIENT_ORIGIN` to the real frontend domain.
