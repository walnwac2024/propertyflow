import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { scopedProjectParams, unitAccessSql } from '../utils/access.js';

const router = Router();
router.use(authenticate);

const floorSchema = z.object({
  project_id: z.coerce.number().int().positive(),
  floor_number: z.string().min(1),
  description: z.string().optional().nullable()
});

router.get('/', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT f.*, p.name project_name, COUNT(u.id) unit_count
     FROM floors f
     JOIN projects p ON p.id = f.project_id
     LEFT JOIN units u ON u.floor_id = f.id
     LEFT JOIN contacts o ON o.id = u.owner_id
     LEFT JOIN contacts t ON t.id = u.tenant_id
     WHERE p.company_id = :companyId
       AND ${unitAccessSql}
       AND (:projectId = 0 OR f.project_id = :projectId)
     GROUP BY f.id
     ORDER BY p.name, f.floor_number`,
    { ...scopedProjectParams(req), projectId: Number(req.query.project_id || 0) }
  );
  res.json({ data: rows });
}));

router.post('/', authorize('super_admin', 'property_manager'), asyncHandler(async (req, res) => {
  const body = floorSchema.parse(req.body);
  const result = await query(
    `INSERT INTO floors (project_id, floor_number, description)
     SELECT :project_id, :floor_number, :description
     FROM projects WHERE id = :project_id AND company_id = :companyId`,
    { ...body, companyId: req.user.company_id }
  );
  await audit(req, 'create', 'floors', result.insertId, body);
  res.status(201).json({ id: result.insertId });
}));

router.put('/:id', authorize('super_admin', 'property_manager'), asyncHandler(async (req, res) => {
  const body = floorSchema.parse(req.body);
  await query(
    `UPDATE floors f JOIN projects p ON p.id = f.project_id
     SET f.project_id=:project_id, f.floor_number=:floor_number, f.description=:description
     WHERE f.id=:id AND p.company_id=:companyId`,
    { ...body, id: req.params.id, companyId: req.user.company_id }
  );
  await audit(req, 'update', 'floors', req.params.id, body);
  res.json({ id: Number(req.params.id) });
}));

router.delete('/:id', authorize('super_admin'), asyncHandler(async (req, res) => {
  await query(
    `DELETE f FROM floors f JOIN projects p ON p.id = f.project_id WHERE f.id=:id AND p.company_id=:companyId`,
    { id: req.params.id, companyId: req.user.company_id }
  );
  await audit(req, 'delete', 'floors', req.params.id);
  res.status(204).end();
}));

export default router;
