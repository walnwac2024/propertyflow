import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { projectAccessSql, scopedProjectParams, unitAccessSql } from '../utils/access.js';
import { monthRange } from '../utils/month.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const companyId = req.user.company_id;
  const scope = scopedProjectParams(req);
  const month = monthRange(req.query.month);
  const financeScope = { companyId, monthStart: month.start, monthEnd: month.next };
  const canViewCompanyFinance = req.user.role === 'super_admin';
  const [projects, floors, units, occupancy, recovered, pendingAmount, expenseAmount, payrollAmount, pendingBills, approvedBills, completedBills, recent] = await Promise.all([
    query(`SELECT COUNT(*) total FROM projects p WHERE p.company_id = :companyId AND ${projectAccessSql}`, scope),
    query(`SELECT COUNT(*) total FROM floors f JOIN projects p ON p.id = f.project_id WHERE p.company_id = :companyId AND ${projectAccessSql}`, scope),
    query(`SELECT COUNT(*) total FROM units u JOIN projects p ON p.id = u.project_id LEFT JOIN contacts o ON o.id = u.owner_id LEFT JOIN contacts t ON t.id = u.tenant_id WHERE p.company_id = :companyId AND ${unitAccessSql}`, scope),
    query(`SELECT occupancy_status, COUNT(*) total FROM units u JOIN projects p ON p.id = u.project_id LEFT JOIN contacts o ON o.id = u.owner_id LEFT JOIN contacts t ON t.id = u.tenant_id WHERE p.company_id = :companyId AND ${unitAccessSql} GROUP BY occupancy_status`, scope),
    canViewCompanyFinance
      ? query(`SELECT COALESCE(SUM(paid_amount),0) total FROM bills WHERE company_id = :companyId AND status = 'paid' AND bill_month >= :monthStart AND bill_month < :monthEnd`, financeScope)
      : Promise.resolve([{ total: 0 }]),
    canViewCompanyFinance
      ? query(`SELECT COALESCE(SUM(GREATEST(total_amount - paid_amount, 0)),0) total FROM bills WHERE company_id = :companyId AND status IN ('draft','issued','partially_paid','overdue') AND bill_month >= :monthStart AND bill_month < :monthEnd`, financeScope)
      : Promise.resolve([{ total: 0 }]),
    canViewCompanyFinance
      ? query(`SELECT COALESCE(SUM(amount),0) total FROM expenses WHERE company_id = :companyId AND approval_status <> 'rejected' AND expense_date >= :monthStart AND expense_date < :monthEnd`, financeScope)
      : Promise.resolve([{ total: 0 }]),
    canViewCompanyFinance
      ? query(`SELECT COALESCE(SUM(amount),0) total FROM employee_payroll WHERE company_id = :companyId AND status = 'paid' AND payroll_month >= :monthStart AND payroll_month < :monthEnd`, financeScope)
      : Promise.resolve([{ total: 0 }]),
    query(`SELECT COUNT(*) total FROM bills b JOIN units u ON u.id = b.unit_id LEFT JOIN contacts o ON o.id = u.owner_id LEFT JOIN contacts t ON t.id = u.tenant_id WHERE b.company_id = :companyId AND ${unitAccessSql} AND b.status = 'draft' AND b.bill_month >= :monthStart AND b.bill_month < :monthEnd`, { ...scope, monthStart: month.start, monthEnd: month.next }),
    query(`SELECT COUNT(*) total FROM bills b JOIN units u ON u.id = b.unit_id LEFT JOIN contacts o ON o.id = u.owner_id LEFT JOIN contacts t ON t.id = u.tenant_id WHERE b.company_id = :companyId AND ${unitAccessSql} AND b.status = 'issued' AND b.bill_month >= :monthStart AND b.bill_month < :monthEnd`, { ...scope, monthStart: month.start, monthEnd: month.next }),
    query(`SELECT COUNT(*) total FROM bills b JOIN units u ON u.id = b.unit_id LEFT JOIN contacts o ON o.id = u.owner_id LEFT JOIN contacts t ON t.id = u.tenant_id WHERE b.company_id = :companyId AND ${unitAccessSql} AND b.status = 'paid' AND b.bill_month >= :monthStart AND b.bill_month < :monthEnd`, { ...scope, monthStart: month.start, monthEnd: month.next }),
    canViewCompanyFinance
      ? query(`(
          SELECT 'payment' type, receipt_no ref, amount, payment_date date_value, created_at FROM payments WHERE company_id = :companyId
        ) UNION ALL (
          SELECT 'expense' type, title ref, amount, expense_date date_value, created_at FROM expenses WHERE company_id = :companyId
        ) ORDER BY created_at DESC LIMIT 8`, { companyId })
      : query(`SELECT 'payment' type, pay.receipt_no ref, pay.amount, pay.payment_date date_value, pay.created_at
          FROM payments pay
          JOIN bills b ON b.id = pay.bill_id
          JOIN units u ON u.id = b.unit_id
          LEFT JOIN contacts o ON o.id = u.owner_id
          LEFT JOIN contacts t ON t.id = u.tenant_id
          WHERE pay.company_id = :companyId AND ${unitAccessSql}
          ORDER BY pay.created_at DESC LIMIT 8`, scope)
  ]);

  const recoveredTotal = Number(recovered[0].total);
  const pendingTotal = Number(pendingAmount[0].total);
  const expenseTotal = Number(expenseAmount[0].total);
  const payrollTotal = Number(payrollAmount[0].total);
  const totalExpense = expenseTotal + payrollTotal;

  res.json({
    totals: {
      projects: projects[0].total,
      floors: floors[0].total,
      units: units[0].total,
      monthlyIncome: recoveredTotal,
      monthlyExpenses: totalExpense,
      recoveredAmount: recoveredTotal,
      pendingAmount: pendingTotal,
      expenseAmount: expenseTotal,
      payrollAmount: payrollTotal,
      totalExpenseAmount: totalExpense,
      cashInHand: recoveredTotal - totalExpense,
      pendingBills: pendingBills[0].total,
      approvedBills: approvedBills[0].total,
      completedBills: completedBills[0].total,
      month: month.label
    },
    occupancy,
    recentTransactions: recent
  });
}));

export default router;
