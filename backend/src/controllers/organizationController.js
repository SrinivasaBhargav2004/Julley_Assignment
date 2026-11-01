const prisma = require('../db/prisma');

async function listOrganizations(req, res) {
  try {
    const userId = req.user.id;

    // Find all memberships for this user
    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: {
        organization: true,
      },
    });

    // Unique list of organizations user is a member of
    const orgMap = new Map();
    for (const m of memberships) {
      if (m.organization && !orgMap.has(m.organization.id)) {
        orgMap.set(m.organization.id, {
          ...m.organization,
          role: m.role,
        });
      }
    }

    const organizations = Array.from(orgMap.values());
    return res.json({ organizations });
  } catch (error) {
    console.error('listOrganizations error:', error);
    return res.status(500).json({ error: 'Failed to fetch organizations' });
  }
}

async function getTenantsForOrg(req, res) {
  try {
    const { orgId } = req.params;
    const userId = req.user.id;

    // Check if user is ORG_ADMIN of this organization
    const orgAdminMembership = await prisma.membership.findFirst({
      where: {
        userId,
        organizationId: orgId,
        role: 'ORG_ADMIN',
      },
    });

    let tenants = [];

    if (orgAdminMembership) {
      // Org Admin can see all branches/tenants under their organization
      tenants = await prisma.tenant.findMany({
        where: { organizationId: orgId },
        include: {
          _count: {
            select: { boards: true, tasks: true },
          },
        },
        orderBy: { name: 'asc' },
      });
    } else {
      // Non-org admin can only see tenants where they hold a membership
      const userTenantMemberships = await prisma.membership.findMany({
        where: {
          userId,
          organizationId: orgId,
          tenantId: { not: null },
        },
        select: { tenantId: true, role: true },
      });

      const allowedTenantIds = userTenantMemberships.map((m) => m.tenantId);

      tenants = await prisma.tenant.findMany({
        where: {
          organizationId: orgId,
          id: { in: allowedTenantIds },
        },
        include: {
          _count: {
            select: { boards: true, tasks: true },
          },
        },
        orderBy: { name: 'asc' },
      });
    }

    return res.json({ tenants });
  } catch (error) {
    console.error('getTenantsForOrg error:', error);
    return res.status(500).json({ error: 'Failed to fetch organization tenants' });
  }
}

async function createOrganization(req, res) {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }

    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      return res.status(400).json({ error: 'Organization slug already exists' });
    }

    const org = await prisma.organization.create({
      data: { name, slug },
    });

    // Make creator the Org Admin
    await prisma.membership.create({
      data: {
        userId: req.user.id,
        organizationId: org.id,
        role: 'ORG_ADMIN',
      },
    });

    return res.status(201).json({ organization: org });
  } catch (error) {
    console.error('createOrganization error:', error);
    return res.status(500).json({ error: 'Failed to create organization' });
  }
}

module.exports = {
  listOrganizations,
  getTenantsForOrg,
  createOrganization,
};
