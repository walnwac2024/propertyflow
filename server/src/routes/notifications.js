import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT * FROM notifications
     WHERE company_id = :companyId AND (user_id IS NULL OR user_id = :userId)
     ORDER BY created_at DESC LIMIT 30`,
    { companyId: req.user.company_id, userId: req.user.id }
  );
  res.json({ data: rows });
}));

router.patch('/:id/read', asyncHandler(async (req, res) => {
  await query(
    `UPDATE notifications SET is_read = TRUE WHERE id = :id AND company_id = :companyId AND (user_id IS NULL OR user_id = :userId)`,
    { id: req.params.id, companyId: req.user.company_id, userId: req.user.id }
  );
  res.json({ id: Number(req.params.id), is_read: true });
}));

export default router;
