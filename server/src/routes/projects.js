import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { like, pagination } from '../utils/pagination.js';
import { projectAccessSql, scopedProjectParams } from '../utils/access.js';
import { monthRange } from '../utils/month.js';

const router = Router();
router.use(authenticate);

const projectSchema = z.object({
  name: z.string().min(2),
  address: z.string().min(2),
  description: z.string().optional().nullable(),
  total_floors: z.coerce.number().int().nonnegative().default(0),
  status: z.enum(['planning', 'active', 'maintenance', 'completed', 'inactive']).default('active')
});

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const search = like(req.query.search || '');
  const canViewFinance = req.user.role === 'super_admin' ? 1 : 0;
  const month = monthRange(req.query.month);
  const rows = await query(
    `SELECT p.*,
      (
        SELECT COUNT(DISTINCT f.id)
        FROM floors f
        LEFT JOIN units fu ON fu.floor_id = f.id
        LEFT JOIN contacts fo ON fo.id = fu.owner_id
        LEFT JOIN contacts ft ON ft.id = fu.tenant_id
        WHERE f.project_id = p.id
          AND (
            :canViewAll = 1
            OR (:role = 'owner' AND fo.user_id = :userId)
            OR (:role = 'tenant' AND ft.user_id = :userId)
          )
      ) floor_count,
      (
        SELECT COUNT(*)
        FROM units u
        LEFT JOIN contacts uo ON uo.id = u.owner_id
        LEFT JOIN contacts ut ON ut.id = u.tenant_id
        WHERE u.project_id = p.id
          AND (
            :canViewAll = 1
            OR (:role = 'owner' AND uo.user_id = :userId)
            OR (:role = 'tenant' AND ut.user_id = :userId)
          )
      ) unit_count
      ,CASE WHEN :canViewFinance = 1 THEN (
        SELECT COALESCE(SUM(b.paid_amount), 0)
        FROM bills b
        WHERE b.company_id = :companyId
          AND b.project_id = p.id
          AND b.status = 'paid'
          AND b.bill_month >= :monthStart
          AND b.bill_month < :monthEnd
      ) ELSE 0 END recovered_amount
      ,CASE WHEN :canViewFinance = 1 THEN (
        SELECT COALESCE(SUM(GREATEST(b.total_amount - b.paid_amount, 0)), 0)
        FROM bills b
        WHERE b.company_id = :companyId
          AND b.project_id = p.id
          AND b.status IN ('draft','issued','partially_paid','overdue')
          AND b.bill_month >= :monthStart
          AND b.bill_month < :monthEnd
      ) ELSE 0 END pending_amount
      ,CASE WHEN :canViewFinance = 1 THEN (
        SELECT COALESCE(SUM(e.amount), 0)
        FROM expenses e
        WHERE e.company_id = :companyId
          AND e.project_id = p.id
          AND e.approval_status <> 'rejected'
          AND e.expense_date >= :monthStart
          AND e.expense_date < :monthEnd
      ) ELSE 0 END expense_amount
      ,CASE WHEN :canViewFinance = 1 THEN (
        SELECT COALESCE(SUM(ep.amount), 0)
        FROM employee_payroll ep
        WHERE ep.company_id = :companyId
          AND ep.project_id = p.id
          AND ep.status = 'paid'
          AND ep.payroll_month >= :monthStart
          AND ep.payroll_month < :monthEnd
      ) ELSE 0 END payroll_amount
     FROM projects p
     WHERE p.company_id = :companyId
       AND ${projectAccessSql}
       AND (:rawSearch = '' OR p.name LIKE :search OR p.address LIKE :search)
     ORDER BY p.created_at DESC LIMIT :limit OFFSET :offset`,
    { ...scopedProjectParams(req), canViewFinance, monthStart: month.start, monthEnd: month.next, rawSearch: req.query.search || '', search, limit, offset }
  );
  const count = await query(
    `SELECT COUNT(*) total FROM projects p
     WHERE p.company_id = :companyId
       AND ${projectAccessSql}
       AND (:rawSearch = '' OR p.name LIKE :search OR p.address LIKE :search)`,
    { ...scopedProjectParams(req), rawSearch: req.query.search || '', search }
  );
  res.json({ data: rows, meta: { page, limit, total: count[0].total } });
}));

router.post('/', authorize('super_admin', 'property_manager'), asyncHandler(async (req, res) => {
  const body = projectSchema.parse(req.body);
  const result = await query(
    `INSERT INTO projects (company_id, name, address, description, total_floors, status, created_by)
     VALUES (:companyId, :name, :address, :description, :total_floors, :status, :createdBy)`,
    { ...body, companyId: req.user.company_id, createdBy: req.user.id }
  );
  await audit(req, 'create', 'projects', result.insertId, body);
  res.status(201).json({ id: result.insertId });
}));

router.put('/:id', authorize('super_admin', 'property_manager'), asyncHandler(async (req, res) => {
  const body = projectSchema.parse(req.body);
  await query(
    `UPDATE projects SET name=:name, address=:address, description=:description, total_floors=:total_floors, status=:status
     WHERE id=:id AND company_id=:companyId`,
    { ...body, id: req.params.id, companyId: req.user.company_id }
  );
  await audit(req, 'update', 'projects', req.params.id, body);
  res.json({ id: Number(req.params.id) });
}));

router.delete('/:id', authorize('super_admin'), asyncHandler(async (req, res) => {
  await query(`DELETE FROM projects WHERE id=:id AND company_id=:companyId`, { id: req.params.id, companyId: req.user.company_id });
  await audit(req, 'delete', 'projects', req.params.id);
  res.status(204).end();
}));

router.post('/:id/documents', authorize('super_admin', 'property_manager'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File is required' });
  const result = await query(
    `INSERT INTO project_documents (project_id, file_name, file_path, file_type, uploaded_by)
     VALUES (:projectId, :fileName, :filePath, :fileType, :userId)`,
    {
      projectId: req.params.id,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileType: req.file.mimetype,
      userId: req.user.id
    }
  );
  await audit(req, 'upload', 'project_documents', result.insertId, { projectId: req.params.id });
  res.status(201).json({ id: result.insertId, path: req.file.path });
}));

export default router;
