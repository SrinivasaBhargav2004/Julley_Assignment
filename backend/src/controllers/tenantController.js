const prisma = require('../db/prisma');

async function listTenants(req, res) {
  try {
    const userId = req.user.id;

    // Check user's org admin memberships
    const orgAdminMemberships = await prisma.membership.findMany({
      where: { userId, role: 'ORG_ADMIN' },
      select: { organizationId: true },
    });
    const orgAdminOrgIds = orgAdminMemberships.map((m) => m.organizationId);

    // Check direct tenant memberships
    const directTenantMemberships = await prisma.membership.findMany({
      where: { userId, tenantId: { not: null } },
      select: { tenantId: true },
    });
    const directTenantIds = directTenantMemberships.map((m) => m.tenantId);

    const tenants = await prisma.tenant.findMany({
      where: {
        OR: [
          { organizationId: { in: orgAdminOrgIds } },
          { id: { in: directTenantIds } },
        ],
      },
      include: {
        organization: true,
        _count: {
          select: { boards: true, tasks: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.json({ tenants });
  } catch (error) {
    console.error('listTenants error:', error);
    return res.status(500).json({ error: 'Failed to fetch tenants' });
  }
}

async function getTenantById(req, res) {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        organization: true,
        boards: {
          include: {
            _count: { select: { columns: true, tasks: true } },
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    return res.json({ tenant });
  } catch (error) {
    console.error('getTenantById error:', error);
    return res.status(500).json({ error: 'Failed to fetch tenant' });
  }
}

async function createTenant(req, res) {
  try {
    const { organizationId, name, slug, code } = req.body;

    if (!organizationId || !name || !slug || !code) {
      return res.status(400).json({ error: 'organizationId, name, slug, and code are required' });
    }

    // Check if user is Org Admin for this organization
    const orgAdmin = await prisma.membership.findFirst({
      where: {
        userId: req.user.id,
        organizationId,
        role: 'ORG_ADMIN',
      },
    });

    if (!orgAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only Organization Admins can create new branches/tenants.',
      });
    }

    const tenant = await prisma.tenant.create({
      data: {
        organizationId,
        name,
        slug,
        code,
      },
      include: {
        organization: true,
      },
    });

    return res.status(201).json({ tenant });
  } catch (error) {
    console.error('createTenant error:', error);
    return res.status(500).json({ error: 'Failed to create tenant' });
  }
}

module.exports = {
  listTenants,
  getTenantById,
  createTenant,
};
