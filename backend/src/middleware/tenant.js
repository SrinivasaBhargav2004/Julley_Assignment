const prisma = require('../db/prisma');

/**
 * Strict Tenant Isolation Middleware
 * Guarantees that:
 * 1. Every request identifies its target tenant.
 * 2. The tenant exists and belongs to the valid organization hierarchy.
 * 3. The authenticated user belongs to the tenant or is an Org Admin of the parent organization.
 * 4. Cross-tenant and cross-organization data access attempts are strictly blocked with 403 Forbidden.
 */
async function tenantMiddleware(req, res, next) {
  try {
    const tenantId =
      req.headers['x-tenant-id'] ||
      req.params.tenantId ||
      req.query.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        error: 'TenantContextRequired',
        message: 'Strict tenant isolation requires X-Tenant-ID header or tenantId parameter.',
      });
    }

    // 1. Fetch tenant with organization details
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        organization: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'TenantNotFound',
        message: `Tenant with ID "${tenantId}" does not exist.`,
      });
    }

    // 2. Validate organization hierarchy if X-Organization-ID header is present
    const orgIdHeader = req.headers['x-organization-id'] || req.query.organizationId;
    if (orgIdHeader && orgIdHeader !== tenant.organizationId) {
      return res.status(403).json({
        error: 'CrossOrganizationViolation',
        message: 'Tenant does not belong to the specified organization. Cross-organization access denied.',
      });
    }

    // 3. Verify user membership and role permissions
    const userId = req.user.id;

    // Check 3A: Is the user an Org Admin for this organization?
    const orgAdminMembership = await prisma.membership.findFirst({
      where: {
        userId,
        organizationId: tenant.organizationId,
        role: 'ORG_ADMIN',
      },
    });

    let activeRole = null;

    if (orgAdminMembership) {
      activeRole = 'ORG_ADMIN';
    } else {
      // Check 3B: Does user have tenant-specific membership?
      const tenantMembership = await prisma.membership.findFirst({
        where: {
          userId,
          tenantId: tenant.id,
        },
      });

      if (tenantMembership) {
        activeRole = tenantMembership.role; // "TENANT_ADMIN" or "MEMBER"
      }
    }

    // If no matching membership, prevent cross-tenant access!
    if (!activeRole) {
      return res.status(403).json({
        error: 'CrossTenantForbidden',
        message: `Cross-tenant access denied: User "${req.user.name}" (${req.user.email}) does not have membership in tenant "${tenant.name}" (${tenant.id}).`,
      });
    }

    // Attach verified tenant and role context to request
    req.tenant = tenant;
    req.membership = {
      role: activeRole,
      organizationId: tenant.organizationId,
      tenantId: tenant.id,
    };

    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    return res.status(500).json({ error: 'Internal server error in tenant verification' });
  }
}

module.exports = tenantMiddleware;
