import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query, transaction } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

function sign(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, companyId: user.company_id },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

router.post('/login', asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const rows = await query(`SELECT * FROM users WHERE email = :email LIMIT 1`, { email: body.email });
  const user = rows[0];
  if (!user || user.status !== 'active') return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(body.password, user.password_hash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  await query(`UPDATE users SET last_login_at = NOW() WHERE id = :id`, { id: user.id });
  res.json({
    token: sign(user),
    user: {
      id: user.id,
      company_id: user.company_id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({ user: req.user });
}));

router.get('/users', authenticate, authorize('super_admin'), asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT u.id, u.name, u.email, u.role, u.phone, u.status, u.created_at,
            c.id contact_id, c.contact_type
     FROM users u
     LEFT JOIN contacts c ON c.user_id = u.id AND c.contact_type IN ('owner','tenant')
     WHERE u.company_id = :companyId
     ORDER BY u.created_at DESC`,
    { companyId: req.user.company_id }
  );
  res.json({ data: rows });
}));

router.post('/users', authenticate, authorize('super_admin'), asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['super_admin', 'property_manager', 'accountant', 'owner', 'tenant']),
    phone: z.string().optional().nullable(),
    national_id: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    contact_id: z.coerce.number().int().positive().optional().nullable()
  }).parse(req.body);

  const passwordHash = await bcrypt.hash(body.password, 12);
  const result = await transaction(async (connection) => {
    const [insert] = await connection.execute(
      `INSERT INTO users (company_id, name, email, password_hash, role, phone)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.company_id, body.name, body.email, passwordHash, body.role, body.phone || null]
    );

    if (['owner', 'tenant'].includes(body.role)) {
      if (body.contact_id) {
        await connection.execute(
          `UPDATE contacts SET user_id = ? WHERE id = ? AND company_id = ? AND contact_type = ?`,
          [insert.insertId, body.contact_id, req.user.company_id, body.role]
        );
      } else {
        await connection.execute(
          `INSERT INTO contacts (company_id, user_id, contact_type, name, email, phone, national_id, address)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.company_id,
            insert.insertId,
            body.role,
            body.name,
            body.email,
            body.phone || null,
            body.national_id || null,
            body.address || null
          ]
        );
      }
    }

    return insert;
  });
  await audit(req, 'create', 'users', result.insertId, { email: body.email, role: body.role });
  res.status(201).json({ id: result.insertId });
}));

export default router;
