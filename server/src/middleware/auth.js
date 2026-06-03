import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication token required' });

    const payload = jwt.verify(token, env.jwtSecret);
    const users = await query(
      `SELECT id, company_id, name, email, role, status FROM users WHERE id = :id LIMIT 1`,
      { id: payload.sub }
    );

    const user = users[0];
    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'User is inactive or does not exist' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission for this action' });
    }
    next();
  };
}
