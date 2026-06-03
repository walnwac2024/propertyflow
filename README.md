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

## Default Login

- Email: `admin@propertyflow.local`
- Password: `Admin@12345`

Change this password after first login in a real deployment.
