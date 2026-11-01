const prisma = require('../db/prisma');
const { signToken } = require('../utils/auth');

async function getMe(req, res) {
  try {
    const user = req.user;

    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: {
        organization: true,
        tenant: true,
      },
    });

    const token = signToken(user);

    return res.json({
      user,
      memberships,
      token,
    });
  } catch (error) {
    console.error('getMe error:', error);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}

async function listUsers(req, res) {
  try {
    const users = await prisma.user.findMany({
      include: {
        memberships: {
          include: {
            organization: { select: { id: true, name: true, slug: true } },
            tenant: { select: { id: true, name: true, code: true, organizationId: true } },
          },
        },
      },
    });

    return res.json({ users });
  } catch (error) {
    console.error('listUsers error:', error);
    return res.status(500).json({ error: 'Failed to list users' });
  }
}

async function switchUser(req, res) {
  try {
    const { userId } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: true,
            tenant: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const token = signToken(user);
    return res.json({ user, token, memberships: user.memberships });
  } catch (error) {
    console.error('switchUser error:', error);
    return res.status(500).json({ error: 'Failed to switch user' });
  }
}

module.exports = {
  getMe,
  listUsers,
  switchUser,
};
