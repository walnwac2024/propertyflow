import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pagination } from '../utils/pagination.js';
import { scopedProjectParams, unitAccessSql } from '../utils/access.js';

const router = Router();
router.use(authenticate);

const billSchema = z.object({
  project_id: z.coerce.number().int().positive(),
  unit_id: z.coerce.number().int().positive(),
  tenant_id: z.coerce.number().int().positive().optional().nullable(),
  bill_month: z.string().min(10),
  issue_date: z.string().min(10),
  due_date: z.string().min(10),
  late_fee: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    category_id: z.coerce.number().int().positive().optional().nullable(),
    description: z.string().min(2),
    amount: z.coerce.number().nonnegative()
  })).min(1)
});

const blankTo = (fallback) => (value) => value === '' || value === null || value === undefined ? fallback : value;
const optionalNumber = (value) => value === '' || value === null || value === undefined ? undefined : value;
const nonnegativeNumber = (fallback = 0) => z.preprocess(blankTo(fallback), z.coerce.number().nonnegative());
const multiplierInput = (value) => {
  const next = value === '' || value === null || value === undefined ? 1 : Number(value);
  return next > 0 ? next : 1;
};

const electricityBillSchema = z.object({
  project_id: z.coerce.number().int().positive(),
  unit_id: z.coerce.number().int().positive(),
  bill_month: z.string().min(7),
  reading_date: z.string().min(10),
  issue_date: z.string().min(10),
  due_date: z.string().min(10),
  consumer_id: z.string().optional().nullable(),
  meter_no: z.string().optional().nullable(),
  previous_reading: z.coerce.number().nonnegative(),
  present_reading: z.coerce.number().nonnegative(),
  multiplier_factor: z.preprocess(multiplierInput, z.coerce.number().positive()).default(1),
  total_supply_payable: nonnegativeNumber(),
  total_supply_units: nonnegativeNumber(),
  tariff: z.preprocess(optionalNumber, z.coerce.number().nonnegative().optional().nullable()),
  water_charges: nonnegativeNumber(),
  lift_charges: nonnegativeNumber(),
  maintenance_charges: nonnegativeNumber(),
  service_charges: nonnegativeNumber(),
  wifi_charges: nonnegativeNumber(),
  other_charges: nonnegativeNumber(),
  previous_arrears: nonnegativeNumber().optional(),
  bill_adjustment: z.preprocess(blankTo(0), z.coerce.number()),
  installment_amount: nonnegativeNumber(),
  subsidy_amount: nonnegativeNumber(),
  lp_surcharge_percent: z.preprocess(blankTo(10), z.coerce.number().nonnegative()),
  lp_surcharge: z.preprocess(optionalNumber, z.coerce.number().nonnegative().optional().nullable()),
  payable_after_due: z.preprocess(optionalNumber, z.coerce.number().positive().optional().nullable())
});

function monthDate(value) {
  return String(value).length === 7 ? `${value}-01` : value;
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function tariffValue(body) {
  if (body.tariff !== undefined && body.tariff !== null) return money(body.tariff);
  return Number(body.total_supply_units) > 0 ? money(body.total_supply_payable / body.total_supply_units) : 0;
}

function latePaymentSurcharge(body, currentBill, payableWithinDue) {
  if (body.payable_after_due) return money(Math.max(0, body.payable_after_due - payableWithinDue));
  if (body.lp_surcharge !== undefined && body.lp_surcharge !== null) return money(body.lp_surcharge);
  return money(currentBill * (Number(body.lp_surcharge_percent || 0) / 100));
}

router.get('/categories', asyncHandler(async (req, res) => {
  const rows = await query(`SELECT * FROM billing_categories WHERE company_id = :companyId AND is_active = TRUE ORDER BY name`, { companyId: req.user.company_id });
  res.json({ data: rows });
}));

router.get('/electricity-bills', asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const rows = await query(
    `SELECT eb.*, b.bill_no, b.paid_amount, b.status,
            p.name project_name, p.address project_address,
            f.floor_number, u.unit_number, u.unit_type,
            c.name tenant_name, c.address tenant_address,
            o.name owner_name
     FROM electricity_bills eb
     JOIN bills b ON b.id = eb.bill_id
     JOIN projects p ON p.id = eb.project_id
     JOIN floors f ON f.id = eb.floor_id
     JOIN units u ON u.id = eb.unit_id
     LEFT JOIN contacts c ON c.id = eb.tenant_id
     LEFT JOIN contacts o ON o.id = u.owner_id
     LEFT JOIN contacts access_owner ON access_owner.id = u.owner_id
     LEFT JOIN contacts access_tenant ON access_tenant.id = u.tenant_id
     WHERE eb.company_id = :companyId
       AND DATE_FORMAT(eb.bill_month, '%Y-%m') = :month
       AND (
        :canViewAll = 1
        OR (:role = 'owner' AND access_owner.user_id = :userId)
        OR (:role = 'tenant' AND access_tenant.user_id = :userId)
       )
     ORDER BY p.name, f.floor_number, u.unit_number`,
    { ...scopedProjectParams(req), month }
  );
  res.json({ data: rows });
}));

router.get('/electricity-arrears', asyncHandler(async (req, res) => {
  const unitId = Number(req.query.unit_id || 0);
  const billMonth = monthDate(req.query.month || new Date().toISOString().slice(0, 7));
  if (!unitId) return res.json({ previous_arrears: 0 });

  const rows = await query(
    `SELECT eb.payable_within_due, b.paid_amount
     FROM electricity_bills eb
     JOIN bills b ON b.id = eb.bill_id
     JOIN units u ON u.id = eb.unit_id
     LEFT JOIN contacts o ON o.id = u.owner_id
     LEFT JOIN contacts t ON t.id = u.tenant_id
     WHERE eb.unit_id = :unitId
       AND eb.company_id = :companyId
       AND eb.bill_month < :billMonth
       AND ${unitAccessSql}
     ORDER BY eb.bill_month DESC, eb.id DESC
     LIMIT 1`,
    { ...scopedProjectParams(req), unitId, billMonth }
  );
  const previousArrears = money(Math.max(0, Number(rows[0]?.payable_within_due || 0) - Number(rows[0]?.paid_amount || 0)));
  res.json({ previous_arrears: previousArrears });
}));

router.get('/electricity-bills/:id', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT eb.*, b.bill_no, b.paid_amount, b.status,
            p.name project_name, p.address project_address,
            f.floor_number, u.unit_number, u.unit_type,
            c.name tenant_name, c.address tenant_address,
            o.name owner_name
     FROM electricity_bills eb
     JOIN bills b ON b.id = eb.bill_id
     JOIN projects p ON p.id = eb.project_id
     JOIN floors f ON f.id = eb.floor_id
     JOIN units u ON u.id = eb.unit_id
     LEFT JOIN contacts c ON c.id = eb.tenant_id
     LEFT JOIN contacts o ON o.id = u.owner_id
     LEFT JOIN contacts access_owner ON access_owner.id = u.owner_id
     LEFT JOIN contacts access_tenant ON access_tenant.id = u.tenant_id
     WHERE eb.id = :id AND eb.company_id = :companyId
       AND (
        :canViewAll = 1
        OR (:role = 'owner' AND access_owner.user_id = :userId)
        OR (:role = 'tenant' AND access_tenant.user_id = :userId)
       )
     LIMIT 1`,
    { ...scopedProjectParams(req), id: req.params.id }
  );
  if (!rows[0]) return res.status(404).json({ message: 'Electricity bill not found' });
  res.json({ data: rows[0] });
}));

router.post('/electricity-bills', authorize('super_admin', 'property_manager', 'accountant'), asyncHandler(async (req, res) => {
  const body = electricityBillSchema.parse(req.body);
  const billMonth = monthDate(body.bill_month);
  const unitsConsumed = money((body.present_reading - body.previous_reading) * body.multiplier_factor);
  if (unitsConsumed < 0) return res.status(400).json({ message: 'Present reading must be greater than previous reading' });

  const tariff = tariffValue(body);
  const electricityCost = money(unitsConsumed * tariff);
  const currentBill = money(
    electricityCost +
    body.water_charges +
    body.lift_charges +
    body.maintenance_charges +
    body.service_charges +
    body.wifi_charges +
    body.other_charges +
    body.bill_adjustment +
    body.installment_amount -
    body.subsidy_amount
  );
  const billNo = `ELEC-${Date.now()}`;

  const result = await transaction(async (connection) => {
    const [unitRows] = await connection.execute(
      `SELECT u.id, u.project_id, u.floor_id, u.tenant_id
       FROM units u
       JOIN projects p ON p.id = u.project_id
       WHERE u.id = ? AND u.project_id = ? AND p.company_id = ?`,
      [body.unit_id, body.project_id, req.user.company_id]
    );
    const unit = unitRows[0];
    if (!unit) {
      const error = new Error('Unit not found in selected project');
      error.status = 404;
      throw error;
    }

    const [previousRows] = await connection.execute(
      `SELECT eb.payable_within_due, b.paid_amount
       FROM electricity_bills eb
       JOIN bills b ON b.id = eb.bill_id
       WHERE eb.unit_id = ? AND eb.bill_month < ?
       ORDER BY eb.bill_month DESC, eb.id DESC
       LIMIT 1`,
      [body.unit_id, billMonth]
    );
    const carriedArrears = money(Math.max(0, Number(previousRows[0]?.payable_within_due || 0) - Number(previousRows[0]?.paid_amount || 0)));
    const previousArrears = body.previous_arrears === undefined ? carriedArrears : money(body.previous_arrears);
    const payableWithinDue = money(previousArrears + currentBill);
    const lpSurcharge = latePaymentSurcharge(body, currentBill, payableWithinDue);
    const payableAfterDue = money(body.payable_after_due || (payableWithinDue + lpSurcharge));

    const [billInsert] = await connection.execute(
      `INSERT INTO bills (company_id, project_id, unit_id, tenant_id, bill_no, bill_month, issue_date, due_date, subtotal, late_fee, total_amount, status, created_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      [
        req.user.company_id,
        unit.project_id,
        body.unit_id,
        unit.tenant_id || null,
        billNo,
        billMonth,
        body.issue_date,
        body.due_date,
        payableWithinDue,
        lpSurcharge,
        payableWithinDue,
        req.user.id,
        'Electricity monthly bill'
      ]
    );

    const itemRows = [
      ['Units consumed', unitsConsumed],
      ['Cost of electricity', electricityCost],
      ['Water charges', body.water_charges],
      ['Lift charges', body.lift_charges],
      ['Maintenance charges', body.maintenance_charges],
      ['Service charges', body.service_charges],
      ['Wifi charges', body.wifi_charges],
      ['Other charges', body.other_charges],
      ['Bill adjustment', body.bill_adjustment],
      ['Installment', body.installment_amount],
      ['Subsidy', -body.subsidy_amount],
      ['Previous arrears', previousArrears]
    ].filter((item) => Number(item[1]) !== 0);

    for (const [description, amount] of itemRows) {
      await connection.execute(`INSERT INTO bill_items (bill_id, description, amount) VALUES (?, ?, ?)`, [billInsert.insertId, description, amount]);
    }

    const [electricityInsert] = await connection.execute(
      `INSERT INTO electricity_bills (
        bill_id, company_id, project_id, floor_id, unit_id, tenant_id, bill_month, reading_date, issue_date, due_date,
        consumer_id, meter_no, previous_reading, present_reading, multiplier_factor, units_consumed,
        total_supply_payable, total_supply_units, tariff, electricity_cost, water_charges, lift_charges,
        maintenance_charges, service_charges, wifi_charges, other_charges, previous_arrears, bill_adjustment,
        installment_amount, subsidy_amount, current_bill, payable_within_due, lp_surcharge, payable_after_due, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        billInsert.insertId,
        req.user.company_id,
        unit.project_id,
        unit.floor_id,
        body.unit_id,
        unit.tenant_id || null,
        billMonth,
        body.reading_date,
        body.issue_date,
        body.due_date,
        body.consumer_id || null,
        body.meter_no || null,
        body.previous_reading,
        body.present_reading,
        body.multiplier_factor,
        unitsConsumed,
        body.total_supply_payable,
        body.total_supply_units,
        tariff,
        electricityCost,
        body.water_charges,
        body.lift_charges,
        body.maintenance_charges,
        body.service_charges,
        body.wifi_charges,
        body.other_charges,
        previousArrears,
        body.bill_adjustment,
        body.installment_amount,
        body.subsidy_amount,
        currentBill,
        payableWithinDue,
        lpSurcharge,
        payableAfterDue,
        req.user.id
      ]
    );

    return { billInsert, electricityInsert, previousArrears, payableWithinDue };
  });

  await audit(req, 'create', 'electricity_bills', result.electricityInsert.insertId, { billNo, unitId: body.unit_id });
  res.status(201).json({ id: result.electricityInsert.insertId, bill_id: result.billInsert.insertId, bill_no: billNo });
}));

router.put('/electricity-bills/:id', authorize('super_admin', 'property_manager', 'accountant'), asyncHandler(async (req, res) => {
  const body = electricityBillSchema.parse(req.body);
  const billMonth = monthDate(body.bill_month);
  const unitsConsumed = money((body.present_reading - body.previous_reading) * body.multiplier_factor);
  if (unitsConsumed < 0) return res.status(400).json({ message: 'Present reading must be greater than previous reading' });

  const tariff = tariffValue(body);
  const electricityCost = money(unitsConsumed * tariff);
  const currentBill = money(
    electricityCost +
    body.water_charges +
    body.lift_charges +
    body.maintenance_charges +
    body.service_charges +
    body.wifi_charges +
    body.other_charges +
    body.bill_adjustment +
    body.installment_amount -
    body.subsidy_amount
  );

  await transaction(async (connection) => {
    const [existingRows] = await connection.execute(
      `SELECT eb.id, eb.bill_id
       FROM electricity_bills eb
       JOIN bills b ON b.id = eb.bill_id
       WHERE eb.id = ? AND eb.company_id = ?`,
      [req.params.id, req.user.company_id]
    );
    const existing = existingRows[0];
    if (!existing) {
      const error = new Error('Electricity bill not found');
      error.status = 404;
      throw error;
    }

    const [unitRows] = await connection.execute(
      `SELECT u.id, u.project_id, u.floor_id, u.tenant_id
       FROM units u
       JOIN projects p ON p.id = u.project_id
       WHERE u.id = ? AND u.project_id = ? AND p.company_id = ?`,
      [body.unit_id, body.project_id, req.user.company_id]
    );
    const unit = unitRows[0];
    if (!unit) {
      const error = new Error('Unit not found in selected project');
      error.status = 404;
      throw error;
    }

    const [previousRows] = await connection.execute(
      `SELECT eb.payable_within_due, b.paid_amount
       FROM electricity_bills eb
       JOIN bills b ON b.id = eb.bill_id
       WHERE eb.unit_id = ? AND eb.bill_month < ?
       ORDER BY eb.bill_month DESC, eb.id DESC
       LIMIT 1`,
      [body.unit_id, billMonth]
    );
    const carriedArrears = money(Math.max(0, Number(previousRows[0]?.payable_within_due || 0) - Number(previousRows[0]?.paid_amount || 0)));
    const previousArrears = body.previous_arrears === undefined ? carriedArrears : money(body.previous_arrears);
    const payableWithinDue = money(previousArrears + currentBill);
    const lpSurcharge = latePaymentSurcharge(body, currentBill, payableWithinDue);
    const payableAfterDue = money(body.payable_after_due || (payableWithinDue + lpSurcharge));

    await connection.execute(
      `UPDATE bills
       SET project_id = ?, unit_id = ?, tenant_id = ?, bill_month = ?, issue_date = ?, due_date = ?,
           subtotal = ?, late_fee = ?, total_amount = ?, notes = ?
       WHERE id = ? AND company_id = ?`,
      [
        unit.project_id,
        body.unit_id,
        unit.tenant_id || null,
        billMonth,
        body.issue_date,
        body.due_date,
        payableWithinDue,
        lpSurcharge,
        payableWithinDue,
        'Electricity monthly bill',
        existing.bill_id,
        req.user.company_id
      ]
    );

    await connection.execute(`DELETE FROM bill_items WHERE bill_id = ?`, [existing.bill_id]);
    const itemRows = [
      ['Units consumed', unitsConsumed],
      ['Cost of electricity', electricityCost],
      ['Water charges', body.water_charges],
      ['Lift charges', body.lift_charges],
      ['Maintenance charges', body.maintenance_charges],
      ['Service charges', body.service_charges],
      ['Wifi charges', body.wifi_charges],
      ['Other charges', body.other_charges],
      ['Bill adjustment', body.bill_adjustment],
      ['Installment', body.installment_amount],
      ['Subsidy', -body.subsidy_amount],
      ['Previous arrears', previousArrears]
    ].filter((item) => Number(item[1]) !== 0);

    for (const [description, amount] of itemRows) {
      await connection.execute(`INSERT INTO bill_items (bill_id, description, amount) VALUES (?, ?, ?)`, [existing.bill_id, description, amount]);
    }

    await connection.execute(
      `UPDATE electricity_bills SET
        project_id = ?, floor_id = ?, unit_id = ?, tenant_id = ?, bill_month = ?, reading_date = ?, issue_date = ?, due_date = ?,
        consumer_id = ?, meter_no = ?, previous_reading = ?, present_reading = ?, multiplier_factor = ?, units_consumed = ?,
        total_supply_payable = ?, total_supply_units = ?, tariff = ?, electricity_cost = ?, water_charges = ?, lift_charges = ?,
        maintenance_charges = ?, service_charges = ?, wifi_charges = ?, other_charges = ?, previous_arrears = ?, bill_adjustment = ?,
        installment_amount = ?, subsidy_amount = ?, current_bill = ?, payable_within_due = ?, lp_surcharge = ?, payable_after_due = ?
       WHERE id = ? AND company_id = ?`,
      [
        unit.project_id,
        unit.floor_id,
        body.unit_id,
        unit.tenant_id || null,
        billMonth,
        body.reading_date,
        body.issue_date,
        body.due_date,
        body.consumer_id || null,
        body.meter_no || null,
        body.previous_reading,
        body.present_reading,
        body.multiplier_factor,
        unitsConsumed,
        body.total_supply_payable,
        body.total_supply_units,
        tariff,
        electricityCost,
        body.water_charges,
        body.lift_charges,
        body.maintenance_charges,
        body.service_charges,
        body.wifi_charges,
        body.other_charges,
        previousArrears,
        body.bill_adjustment,
        body.installment_amount,
        body.subsidy_amount,
        currentBill,
        payableWithinDue,
        lpSurcharge,
        payableAfterDue,
        req.params.id,
        req.user.company_id
      ]
    );
  });

  await audit(req, 'update', 'electricity_bills', req.params.id, { unitId: body.unit_id });
  res.json({ id: Number(req.params.id) });
}));

router.get('/bills', asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const rows = await query(
    `SELECT b.*, p.name project_name, u.unit_number, c.name tenant_name
     FROM bills b
     JOIN projects p ON p.id = b.project_id
     JOIN units u ON u.id = b.unit_id
     LEFT JOIN contacts o ON o.id = u.owner_id
     LEFT JOIN contacts t ON t.id = u.tenant_id
     LEFT JOIN contacts c ON c.id = b.tenant_id
     WHERE b.company_id = :companyId AND ${unitAccessSql} AND (:status = '' OR b.status = :status)
     ORDER BY b.created_at DESC LIMIT :limit OFFSET :offset`,
    { ...scopedProjectParams(req), status: req.query.status || '', limit, offset }
  );
  const count = await query(
    `SELECT COUNT(*) total
     FROM bills b
     JOIN units u ON u.id = b.unit_id
     LEFT JOIN contacts o ON o.id = u.owner_id
     LEFT JOIN contacts t ON t.id = u.tenant_id
     WHERE b.company_id = :companyId AND ${unitAccessSql}`,
    scopedProjectParams(req)
  );
  res.json({ data: rows, meta: { page, limit, total: count[0].total } });
}));

router.patch('/bills/:id/status', authorize('super_admin', 'property_manager', 'accountant'), asyncHandler(async (req, res) => {
  const body = z.object({
    status: z.enum(['pending', 'approved', 'draft', 'issued', 'cancelled'])
  }).parse(req.body);
  const nextStatus = body.status === 'pending' ? 'draft' : body.status === 'approved' ? 'issued' : body.status;

  await query(
    `UPDATE bills b
     JOIN units u ON u.id = b.unit_id
     JOIN projects p ON p.id = b.project_id
     SET b.status = :status
     WHERE b.id = :id AND b.company_id = :companyId AND p.company_id = :companyId`,
    { status: nextStatus, id: req.params.id, companyId: req.user.company_id }
  );
  await audit(req, 'status_change', 'bills', req.params.id, { status: nextStatus });
  res.json({ id: Number(req.params.id), status: nextStatus });
}));

router.post('/bills', authorize('super_admin', 'property_manager', 'accountant'), asyncHandler(async (req, res) => {
  const body = billSchema.parse(req.body);
  const subtotal = body.items.reduce((sum, item) => sum + Number(item.amount), 0);
  const total = subtotal + Number(body.late_fee);
  const billNo = `BILL-${Date.now()}`;

  const result = await transaction(async (connection) => {
    const [unitRows] = await connection.execute(
      `SELECT u.id, u.project_id, u.tenant_id FROM units u JOIN projects p ON p.id = u.project_id WHERE u.id = ? AND p.company_id = ?`,
      [body.unit_id, req.user.company_id]
    );
    if (!unitRows[0]) {
      const error = new Error('Unit not found');
      error.status = 404;
      throw error;
    }
    const tenantId = body.tenant_id || unitRows[0].tenant_id || null;
    const [insert] = await connection.execute(
      `INSERT INTO bills (company_id, project_id, unit_id, tenant_id, bill_no, bill_month, issue_date, due_date, subtotal, late_fee, total_amount, created_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.company_id, unitRows[0].project_id, body.unit_id, tenantId, billNo, body.bill_month, body.issue_date, body.due_date, subtotal, body.late_fee, total, req.user.id, body.notes || null]
    );
    for (const item of body.items) {
      await connection.execute(
        `INSERT INTO bill_items (bill_id, category_id, description, amount) VALUES (?, ?, ?, ?)`,
        [insert.insertId, item.category_id || null, item.description, item.amount]
      );
    }
    return insert;
  });

  await audit(req, 'create', 'bills', result.insertId, { billNo, total });
  res.status(201).json({ id: result.insertId, bill_no: billNo });
}));

router.post('/payments', authorize('super_admin', 'accountant'), asyncHandler(async (req, res) => {
  const body = z.object({
    bill_id: z.coerce.number().int().positive().optional().nullable(),
    project_id: z.coerce.number().int().positive().optional().nullable(),
    unit_id: z.coerce.number().int().positive().optional().nullable(),
    contact_id: z.coerce.number().int().positive().optional().nullable(),
    amount: z.coerce.number().positive(),
    payment_method: z.enum(['cash', 'bank_transfer', 'card', 'cheque', 'online', 'other']).default('cash'),
    payment_date: z.string().min(10),
    reference_no: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
  }).parse(req.body);

  const receiptNo = `RCPT-${Date.now()}`;
  const result = await transaction(async (connection) => {
    const [insert] = await connection.execute(
      `INSERT INTO payments (bill_id, company_id, project_id, unit_id, contact_id, receipt_no, amount, payment_method, payment_date, reference_no, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [body.bill_id || null, req.user.company_id, body.project_id || null, body.unit_id || null, body.contact_id || null, receiptNo, body.amount, body.payment_method, body.payment_date, body.reference_no || null, body.notes || null, req.user.id]
    );
    if (body.bill_id) {
      await connection.execute(`UPDATE bills SET paid_amount = paid_amount + ? WHERE id = ? AND company_id = ?`, [body.amount, body.bill_id, req.user.company_id]);
      await connection.execute(
        `UPDATE bills SET status = CASE
          WHEN paid_amount >= total_amount THEN 'paid'
          WHEN paid_amount > 0 THEN 'partially_paid'
          ELSE status
        END WHERE id = ? AND company_id = ?`,
        [body.bill_id, req.user.company_id]
      );
    }
    return insert;
  });
  await audit(req, 'create', 'payments', result.insertId, { receiptNo, amount: body.amount });
  res.status(201).json({ id: result.insertId, receipt_no: receiptNo });
}));

export default router;
