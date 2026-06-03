import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { like, pagination } from '../utils/pagination.js';
import { scopedProjectParams, unitAccessSql } from '../utils/access.js';

const router = Router();
router.use(authenticate);

const unitSchema = z.object({
  floor_id: z.coerce.number().int().positive(),
  unit_number: z.string().min(1),
  unit_type: z.enum(['apartment', 'office', 'shop', 'warehouse', 'other']),
  custom_type: z.string().optional().nullable(),
  area_sqft: z.coerce.number().nonnegative().default(0),
  owner_id: z.coerce.number().int().positive().optional().nullable(),
  tenant_id: z.coerce.number().int().positive().optional().nullable(),
  occupancy_status: z.enum(['vacant', 'occupied', 'reserved', 'maintenance']).default('vacant'),
  status: z.enum(['active', 'inactive']).default('active')
});

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const search = like(req.query.search || '');
  const rows = await query(
    `SELECT u.*, f.floor_number, p.name project_name,
            o.name owner_name, t.name tenant_name,
            ou.name owner_user_name, tu.name tenant_user_name
     FROM units u
     JOIN floors f ON f.id = u.floor_id
     JOIN projects p ON p.id = u.project_id
     LEFT JOIN contacts o ON o.id = u.owner_id
     LEFT JOIN contacts t ON t.id = u.tenant_id
     LEFT JOIN users ou ON ou.id = o.user_id
     LEFT JOIN users tu ON tu.id = t.user_id
     WHERE p.company_id = :companyId
       AND ${unitAccessSql}
       AND (:projectId = 0 OR u.project_id = :projectId)
       AND (:floorId = 0 OR u.floor_id = :floorId)
       AND (:rawSearch = '' OR u.unit_number LIKE :search OR p.name LIKE :search)
     ORDER BY p.name, f.floor_number, u.unit_number
     LIMIT :limit OFFSET :offset`,
    {
      ...scopedProjectParams(req),
      projectId: Number(req.query.project_id || 0),
      floorId: Number(req.query.floor_id || 0),
      rawSearch: req.query.search || '',
      search,
      limit,
      offset
    }
  );
  const count = await query(
    `SELECT COUNT(*) total
     FROM units u
     JOIN projects p ON p.id = u.project_id
     LEFT JOIN contacts o ON o.id = u.owner_id
     LEFT JOIN contacts t ON t.id = u.tenant_id
     WHERE p.company_id = :companyId
       AND ${unitAccessSql}
       AND (:projectId = 0 OR u.project_id = :projectId)
       AND (:floorId = 0 OR u.floor_id = :floorId)
       AND (:rawSearch = '' OR u.unit_number LIKE :search OR p.name LIKE :search)`,
    {
      ...scopedProjectParams(req),
      projectId: Number(req.query.project_id || 0),
      floorId: Number(req.query.floor_id || 0),
      rawSearch: req.query.search || '',
      search
    }
  );
  res.json({ data: rows, meta: { page, limit, total: count[0].total } });
}));

router.post('/', authorize('super_admin', 'property_manager'), asyncHandler(async (req, res) => {
  const body = unitSchema.parse(req.body);
  const result = await transaction(async (connection) => {
    const [floorRows] = await connection.execute(
      `SELECT f.id, f.project_id FROM floors f JOIN projects p ON p.id = f.project_id WHERE f.id = ? AND p.company_id = ?`,
      [body.floor_id, req.user.company_id]
    );
    if (!floorRows[0]) {
      const error = new Error('Floor not found');
      error.status = 404;
      throw error;
    }
    const projectId = floorRows[0].project_id;
    const [insert] = await connection.execute(
      `INSERT INTO units (floor_id, project_id, unit_number, unit_type, custom_type, area_sqft, owner_id, tenant_id, occupancy_status, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.floor_id,
        projectId,
        body.unit_number,
        body.unit_type,
        body.custom_type || null,
        body.area_sqft,
        body.owner_id || null,
        body.tenant_id || null,
        body.occupancy_status,
        body.status
      ]
    );
    if (body.owner_id) {
      await connection.execute(
        `INSERT INTO unit_ownership_history (unit_id, owner_id, start_date, notes) VALUES (?, ?, CURDATE(), 'Initial owner assignment')`,
        [insert.insertId, body.owner_id]
      );
    }
    return insert;
  });
  await audit(req, 'create', 'units', result.insertId, body);
  res.status(201).json({ id: result.insertId });
}));

router.put('/:id', authorize('super_admin', 'property_manager'), asyncHandler(async (req, res) => {
  const body = unitSchema.parse(req.body);
  await transaction(async (connection) => {
    const [existingRows] = await connection.execute(
      `SELECT u.owner_id FROM units u JOIN projects p ON p.id = u.project_id WHERE u.id = ? AND p.company_id = ?`,
      [req.params.id, req.user.company_id]
    );
    if (!existingRows[0]) {
      const error = new Error('Unit not found');
      error.status = 404;
      throw error;
    }
    const [floorRows] = await connection.execute(
      `SELECT f.project_id FROM floors f JOIN projects p ON p.id = f.project_id WHERE f.id = ? AND p.company_id = ?`,
      [body.floor_id, req.user.company_id]
    );
    if (!floorRows[0]) {
      const error = new Error('Floor not found');
      error.status = 404;
      throw error;
    }
    await connection.execute(
      `UPDATE units SET floor_id=?, project_id=?, unit_number=?, unit_type=?, custom_type=?, area_sqft=?, owner_id=?, tenant_id=?, occupancy_status=?, status=? WHERE id=?`,
      [
        body.floor_id,
        floorRows[0].project_id,
        body.unit_number,
        body.unit_type,
        body.custom_type || null,
        body.area_sqft,
        body.owner_id || null,
        body.tenant_id || null,
        body.occupancy_status,
        body.status,
        req.params.id
      ]
    );
    if (body.owner_id && Number(existingRows[0].owner_id || 0) !== Number(body.owner_id)) {
      await connection.execute(`UPDATE unit_ownership_history SET end_date = CURDATE() WHERE unit_id = ? AND end_date IS NULL`, [req.params.id]);
      await connection.execute(`INSERT INTO unit_ownership_history (unit_id, owner_id, start_date, notes) VALUES (?, ?, CURDATE(), 'Owner changed')`, [req.params.id, body.owner_id]);
    }
  });
  await audit(req, 'update', 'units', req.params.id, body);
  res.json({ id: Number(req.params.id) });
}));

router.delete('/:id', authorize('super_admin'), asyncHandler(async (req, res) => {
  await query(
    `DELETE u FROM units u JOIN projects p ON p.id = u.project_id WHERE u.id=:id AND p.company_id=:companyId`,
    { id: req.params.id, companyId: req.user.company_id }
  );
  await audit(req, 'delete', 'units', req.params.id);
  res.status(204).end();
}));

router.get('/:id/ownership-history', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT h.*, c.name owner_name
     FROM unit_ownership_history h
     JOIN units u ON u.id = h.unit_id
     JOIN projects p ON p.id = u.project_id
     JOIN contacts c ON c.id = h.owner_id
     LEFT JOIN contacts o ON o.id = u.owner_id
     LEFT JOIN contacts t ON t.id = u.tenant_id
     WHERE h.unit_id = :id AND p.company_id = :companyId AND ${unitAccessSql}
     ORDER BY h.start_date DESC`,
    { id: req.params.id, ...scopedProjectParams(req) }
  );
  res.json({ data: rows });
}));

export default router;
