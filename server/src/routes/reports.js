import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { scopedProjectParams, unitAccessSql } from '../utils/access.js';

const router = Router();
router.use(authenticate);

router.get('/occupancy', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT p.name project_name, u.occupancy_status, COUNT(*) total
     FROM units u JOIN projects p ON p.id = u.project_id
     LEFT JOIN contacts o ON o.id = u.owner_id
     LEFT JOIN contacts t ON t.id = u.tenant_id
     WHERE p.company_id = :companyId AND ${unitAccessSql}
     GROUP BY p.id, u.occupancy_status
     ORDER BY p.name`,
    scopedProjectParams(req)
  );
  res.json({ data: rows });
}));

router.get('/financial-summary', asyncHandler(async (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  const canViewCompanyFinance = ['super_admin', 'property_manager', 'accountant'].includes(req.user.role);
  const income = await query(
    canViewCompanyFinance
      ? `SELECT MONTH(payment_date) month, COALESCE(SUM(amount),0) income
         FROM payments WHERE company_id = :companyId AND YEAR(payment_date) = :year GROUP BY MONTH(payment_date)`
      : `SELECT MONTH(pay.payment_date) month, COALESCE(SUM(pay.amount),0) income
         FROM payments pay
         JOIN bills b ON b.id = pay.bill_id
         JOIN units u ON u.id = b.unit_id
         LEFT JOIN contacts o ON o.id = u.owner_id
         LEFT JOIN contacts t ON t.id = u.tenant_id
         WHERE pay.company_id = :companyId AND ${unitAccessSql} AND YEAR(pay.payment_date) = :year
         GROUP BY MONTH(pay.payment_date)`,
    { ...scopedProjectParams(req), year }
  );
  const expenses = canViewCompanyFinance
    ? await query(
      `SELECT MONTH(expense_date) month, COALESCE(SUM(amount),0) expenses
       FROM expenses WHERE company_id = :companyId AND YEAR(expense_date) = :year GROUP BY MONTH(expense_date)`,
      { companyId: req.user.company_id, year }
    )
    : [];
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const incomeValue = Number(income.find((row) => row.month === month)?.income || 0);
    const expenseValue = Number(expenses.find((row) => row.month === month)?.expenses || 0);
    return { month, income: incomeValue, expenses: expenseValue, profit: incomeValue - expenseValue };
  });
  res.json({ year, data: months });
}));

router.get('/outstanding-balances', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT b.bill_no, b.due_date, b.total_amount, b.paid_amount, (b.total_amount - b.paid_amount) balance,
            p.name project_name, u.unit_number, c.name tenant_name
     FROM bills b
     JOIN projects p ON p.id = b.project_id
     JOIN units u ON u.id = b.unit_id
     LEFT JOIN contacts o ON o.id = u.owner_id
     LEFT JOIN contacts t ON t.id = u.tenant_id
     LEFT JOIN contacts c ON c.id = b.tenant_id
     WHERE b.company_id = :companyId AND ${unitAccessSql} AND b.total_amount > b.paid_amount
     ORDER BY b.due_date ASC`,
    scopedProjectParams(req)
  );
  res.json({ data: rows });
}));

export default router;
