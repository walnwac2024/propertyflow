export const roles = {
  allProjectAccess: ['super_admin', 'property_manager', 'accountant'],
  projectWrite: ['super_admin', 'property_manager'],
  systemAdmin: ['super_admin']
};

export function canViewAllProjects(user) {
  return roles.allProjectAccess.includes(user.role);
}

export function scopedProjectParams(req) {
  return {
    companyId: req.user.company_id,
    userId: req.user.id,
    role: req.user.role,
    canViewAll: canViewAllProjects(req.user) ? 1 : 0
  };
}

export const projectAccessSql = `
  (
    :canViewAll = 1
    OR EXISTS (
      SELECT 1
      FROM units access_units
      LEFT JOIN contacts access_owner ON access_owner.id = access_units.owner_id
      LEFT JOIN contacts access_tenant ON access_tenant.id = access_units.tenant_id
      WHERE access_units.project_id = p.id
        AND (
          (:role = 'owner' AND access_owner.user_id = :userId)
          OR (:role = 'tenant' AND access_tenant.user_id = :userId)
        )
    )
  )
`;

export const unitAccessSql = `
  (
    :canViewAll = 1
    OR (:role = 'owner' AND o.user_id = :userId)
    OR (:role = 'tenant' AND t.user_id = :userId)
  )
`;
