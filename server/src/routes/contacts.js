import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { like, pagination } from '../utils/pagination.js';

const router = Router();
router.use(authenticate);

const contactSchema = z.object({
  contact_type: z.enum(['owner', 'tenant', 'vendor', 'other']),
  name: z.string().min(2),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  national_id: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active')
});

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const search = like(req.query.search || '');
  const canViewAll = ['super_admin', 'property_manager', 'accountant'].includes(req.user.role) ? 1 : 0;
  const rows = await query(
    `SELECT * FROM contacts
     WHERE company_id = :companyId
       AND (:canViewAll = 1 OR user_id = :userId)
       AND (:type = '' OR contact_type = :type)
       AND (:rawSearch = '' OR name LIKE :search OR email LIKE :search OR phone LIKE :search)
     ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
    { companyId: req.user.company_id, userId: req.user.id, canViewAll, type: req.query.type || '', rawSearch: req.query.search || '', search, limit, offset }
  );
  const count = await query(
    `SELECT COUNT(*) total FROM contacts
     WHERE company_id = :companyId AND (:canViewAll = 1 OR user_id = :userId) AND (:type = '' OR contact_type = :type)`,
    { companyId: req.user.company_id, userId: req.user.id, canViewAll, type: req.query.type || '' }
  );
  res.json({ data: rows, meta: { page, limit, total: count[0].total } });
}));

router.post('/', authorize('super_admin', 'property_manager', 'accountant'), asyncHandler(async (req, res) => {
  const body = contactSchema.parse(req.body);
  const result = await query(
    `INSERT INTO contacts (company_id, contact_type, name, email, phone, national_id, address, status)
     VALUES (:companyId, :contact_type, :name, :email, :phone, :national_id, :address, :status)`,
    { ...body, companyId: req.user.company_id }
  );
  await audit(req, 'create', 'contacts', result.insertId, body);
  res.status(201).json({ id: result.insertId });
}));

router.put('/:id', authorize('super_admin', 'property_manager', 'accountant'), asyncHandler(async (req, res) => {
  const body = contactSchema.parse(req.body);
  await query(
    `UPDATE contacts SET contact_type=:contact_type, name=:name, email=:email, phone=:phone, national_id=:national_id, address=:address, status=:status
     WHERE id=:id AND company_id=:companyId`,
    { ...body, id: req.params.id, companyId: req.user.company_id }
  );
  await audit(req, 'update', 'contacts', req.params.id, body);
  res.json({ id: Number(req.params.id) });
}));

router.delete('/:id', authorize('super_admin'), asyncHandler(async (req, res) => {
  await query(`DELETE FROM contacts WHERE id=:id AND company_id=:companyId`, { id: req.params.id, companyId: req.user.company_id });
  await audit(req, 'delete', 'contacts', req.params.id);
  res.status(204).end();
}));

export default router;
