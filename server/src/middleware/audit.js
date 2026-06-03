import { query } from '../config/db.js';

export async function audit(req, action, entity, entityId = null, metadata = {}) {
  if (!req.user) return;
  await query(
    `INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, metadata, ip_address, user_agent)
     VALUES (:companyId, :userId, :action, :entity, :entityId, :metadata, :ip, :agent)`,
    {
      companyId: req.user.company_id,
      userId: req.user.id,
      action,
      entity,
      entityId,
      metadata: JSON.stringify(metadata),
      ip: req.ip,
      agent: req.headers['user-agent'] || null
    }
  );
}
