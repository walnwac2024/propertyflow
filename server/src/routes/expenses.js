import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pagination } from '../utils/pagination.js';

const router = Router();
router.use(authenticate);

router.get('/categories', asyncHandler(async (req, res) => {
  const rows = await query(`SELECT * FROM expense_categories WHERE company_id = :companyId AND is_active = TRUE ORDER BY name`, { companyId: req.user.company_id });
  res.json({ data: rows });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const rows = await query(
    `SELECT e.*, p.name project_name, c.name category_name, u.name approved_by_name
     FROM expenses e
     LEFT JOIN projects p ON p.id = e.project_id
     LEFT JOIN expense_categories c ON c.id = e.category_id
     LEFT JOIN users u ON u.id = e.approved_by
     WHERE e.company_id = :companyId AND (:status = '' OR e.approval_status = :status)
     ORDER BY e.created_at DESC LIMIT :limit OFFSET :offset`,
    { companyId: req.user.company_id, status: req.query.status || '', limit, offset }
  );
  const count = await query(`SELECT COUNT(*) total FROM expenses WHERE company_id = :companyId`, { companyId: req.user.company_id });
  res.json({ data: rows, meta: { page, limit, total: count[0].total } });
}));

router.post('/', authorize('super_admin', 'property_manager', 'accountant'), upload.single('invoice'), asyncHandler(async (req, res) => {
  const body = z.object({
    project_id: z.coerce.number().int().positive().optional().nullable(),
    category_id: z.coerce.number().int().positive().optional().nullable(),
    title: z.string().min(2),
    description: z.string().optional().nullable(),
    amount: z.coerce.number().positive(),
    expense_date: z.string().min(10),
    vendor_name: z.string().optional().nullable()
  }).parse(req.body);

  const result = await query(
    `INSERT INTO expenses (company_id, project_id, category_id, title, description, amount, expense_date, vendor_name, invoice_file_path, created_by)
     VALUES (:companyId, :project_id, :category_id, :title, :description, :amount, :expense_date, :vendor_name, :invoice, :userId)`,
    { ...body, companyId: req.user.company_id, invoice: req.file?.path || null, userId: req.user.id }
  );
  await audit(req, 'create', 'expenses', result.insertId, body);
  res.status(201).json({ id: result.insertId });
}));

router.patch('/:id/approve', authorize('super_admin', 'property_manager'), asyncHandler(async (req, res) => {
  const status = z.enum(['approved', 'rejected', 'paid']).parse(req.body.status);
  await query(
    `UPDATE expenses SET approval_status=:status, approved_by=:userId WHERE id=:id AND company_id=:companyId`,
    { status, userId: req.user.id, id: req.params.id, companyId: req.user.company_id }
  );
  await audit(req, 'approve', 'expenses', req.params.id, { status });
  res.json({ id: Number(req.params.id), status });
}));

export default router;
