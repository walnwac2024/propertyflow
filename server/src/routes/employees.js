import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pagination } from '../utils/pagination.js';
import { like } from '../utils/pagination.js';

const router = Router();
router.use(authenticate);
router.use(authorize('super_admin'));

const employeeSchema = z.object({
  name: z.string().min(2),
  designation: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active')
});

const payrollSchema = z.object({
  project_id: z.coerce.number().int().positive(),
  employee_id: z.coerce.number().int().positive().optional().nullable(),
  employee_name: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  payroll_month: z.string().min(10),
  payment_date: z.string().min(10),
  amount: z.coerce.number().positive(),
  payment_method: z.enum(['cash', 'bank_transfer', 'cheque', 'online', 'other']).default('cash'),
  status: z.enum(['pending', 'paid', 'cancelled']).default('paid'),
  notes: z.string().optional().nullable()
});

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const search = like(req.query.search || '');
  const rows = await query(
    `SELECT *
     FROM employees
     WHERE company_id = :companyId
       AND (:status = '' OR status = :status)
       AND (:rawSearch = '' OR name LIKE :search OR designation LIKE :search OR phone LIKE :search)
     ORDER BY name
     LIMIT :limit OFFSET :offset`,
    {
      companyId: req.user.company_id,
      status: req.query.status || '',
      rawSearch: req.query.search || '',
      search,
      limit,
      offset
    }
  );
  const count = await query(
    `SELECT COUNT(*) total
     FROM employees
     WHERE company_id = :companyId
       AND (:status = '' OR status = :status)
       AND (:rawSearch = '' OR name LIKE :search OR designation LIKE :search OR phone LIKE :search)`,
    {
      companyId: req.user.company_id,
      status: req.query.status || '',
      rawSearch: req.query.search || '',
      search
    }
  );
  res.json({ data: rows, meta: { page, limit, total: count[0].total } });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = employeeSchema.parse(req.body);
  const result = await query(
    `INSERT INTO employees (company_id, name, designation, phone, email, address, status, created_by)
     VALUES (:companyId, :name, :designation, :phone, :email, :address, :status, :userId)`,
    { ...body, companyId: req.user.company_id, userId: req.user.id }
  );
  await audit(req, 'create', 'employees', result.insertId, body);
  res.status(201).json({ id: result.insertId });
}));

router.get('/payroll', asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const rows = await query(
    `SELECT ep.*, p.name project_name, u.name created_by_name
     FROM employee_payroll ep
     JOIN projects p ON p.id = ep.project_id
     LEFT JOIN users u ON u.id = ep.created_by
     WHERE ep.company_id = :companyId
       AND (:projectId = 0 OR ep.project_id = :projectId)
       AND (:employeeId = 0 OR ep.employee_id = :employeeId)
       AND (:status = '' OR ep.status = :status)
       AND (:monthStart = '' OR (ep.payroll_month >= :monthStart AND ep.payroll_month < :monthEnd))
     ORDER BY ep.payment_date DESC, ep.created_at DESC
     LIMIT :limit OFFSET :offset`,
    {
      companyId: req.user.company_id,
      projectId: Number(req.query.project_id || 0),
      employeeId: Number(req.query.employee_id || 0),
      status: req.query.status || '',
      monthStart: req.query.month ? `${String(req.query.month).slice(0, 7)}-01` : '',
      monthEnd: req.query.month ? monthEnd(String(req.query.month).slice(0, 7)) : '',
      limit,
      offset
    }
  );
  const count = await query(
    `SELECT COUNT(*) total
     FROM employee_payroll
     WHERE company_id = :companyId
       AND (:projectId = 0 OR project_id = :projectId)
       AND (:employeeId = 0 OR employee_id = :employeeId)
       AND (:status = '' OR status = :status)
       AND (:monthStart = '' OR (payroll_month >= :monthStart AND payroll_month < :monthEnd))`,
    {
      companyId: req.user.company_id,
      projectId: Number(req.query.project_id || 0),
      employeeId: Number(req.query.employee_id || 0),
      status: req.query.status || '',
      monthStart: req.query.month ? `${String(req.query.month).slice(0, 7)}-01` : '',
      monthEnd: req.query.month ? monthEnd(String(req.query.month).slice(0, 7)) : ''
    }
  );
  res.json({ data: rows, meta: { page, limit, total: count[0].total } });
}));

router.post('/payroll', asyncHandler(async (req, res) => {
  const body = payrollSchema.parse(req.body);
  const employee = await resolveEmployee(req, body);
  const result = await query(
    `INSERT INTO employee_payroll
      (company_id, project_id, employee_id, employee_name, designation, payroll_month, payment_date, amount, payment_method, status, notes, created_by)
     SELECT :companyId, p.id, :employee_id, :employee_name, :designation, :payroll_month, :payment_date, :amount, :payment_method, :status, :notes, :userId
     FROM projects p
     WHERE p.id = :project_id AND p.company_id = :companyId`,
    {
      ...body,
      ...employee,
      companyId: req.user.company_id,
      userId: req.user.id
    }
  );
  await audit(req, 'create', 'employee_payroll', result.insertId, body);
  res.status(201).json({ id: result.insertId });
}));

router.put('/payroll/:id', asyncHandler(async (req, res) => {
  const body = payrollSchema.parse(req.body);
  const employee = await resolveEmployee(req, body);
  await query(
    `UPDATE employee_payroll ep
     JOIN projects p ON p.id = :project_id AND p.company_id = :companyId
     SET ep.project_id = p.id,
         ep.employee_id = :employee_id,
         ep.employee_name = :employee_name,
         ep.designation = :designation,
         ep.payroll_month = :payroll_month,
         ep.payment_date = :payment_date,
         ep.amount = :amount,
         ep.payment_method = :payment_method,
         ep.status = :status,
         ep.notes = :notes
     WHERE ep.id = :id AND ep.company_id = :companyId`,
    { ...body, ...employee, id: req.params.id, companyId: req.user.company_id }
  );
  await audit(req, 'update', 'employee_payroll', req.params.id, body);
  res.json({ id: Number(req.params.id) });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const body = employeeSchema.parse(req.body);
  await query(
    `UPDATE employees
     SET name = :name,
         designation = :designation,
         phone = :phone,
         email = :email,
         address = :address,
         status = :status
     WHERE id = :id AND company_id = :companyId`,
    { ...body, id: req.params.id, companyId: req.user.company_id }
  );
  await audit(req, 'update', 'employees', req.params.id, body);
  res.json({ id: Number(req.params.id) });
}));

router.patch('/payroll/:id/status', asyncHandler(async (req, res) => {
  const body = z.object({ status: z.enum(['pending', 'paid', 'cancelled']) }).parse(req.body);
  await query(
    `UPDATE employee_payroll SET status = :status WHERE id = :id AND company_id = :companyId`,
    { status: body.status, id: req.params.id, companyId: req.user.company_id }
  );
  await audit(req, 'update_status', 'employee_payroll', req.params.id, body);
  res.json({ id: Number(req.params.id), status: body.status });
}));

export default router;

function monthEnd(monthValue) {
  const [yearValue, monthPart] = monthValue.split('-').map(Number);
  return monthPart === 12
    ? `${yearValue + 1}-01-01`
    : `${yearValue}-${String(monthPart + 1).padStart(2, '0')}-01`;
}

async function resolveEmployee(req, body) {
  if (body.employee_id) {
    const rows = await query(
      `SELECT id, name, designation FROM employees WHERE id = :id AND company_id = :companyId LIMIT 1`,
      { id: body.employee_id, companyId: req.user.company_id }
    );
    if (!rows[0]) {
      const error = new Error('Employee not found');
      error.status = 404;
      throw error;
    }
    return {
      employee_id: rows[0].id,
      employee_name: rows[0].name,
      designation: body.designation || rows[0].designation || null
    };
  }
  if (!body.employee_name) {
    const error = new Error('Employee is required');
    error.status = 400;
    throw error;
  }
  return {
    employee_id: null,
    employee_name: body.employee_name,
    designation: body.designation || null
  };
}
