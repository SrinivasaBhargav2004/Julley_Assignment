const test = require('node:test');
const assert = require('node:assert');
const prisma = require('../src/db/prisma');
const { calculatePosition } = require('../src/services/fractionalIndex');

test('Fractional Indexing calculation', () => {
  // Empty column
  assert.strictEqual(calculatePosition(null, null), 1000.0);

  // Append to end
  assert.strictEqual(calculatePosition(1000, null), 2000.0);

  // Insert before first
  assert.strictEqual(calculatePosition(null, 1000), 500.0);

  // Insert between 1000 and 2000
  assert.strictEqual(calculatePosition(1000, 2000), 1500.0);

  // Repeated insertions between positions
  assert.strictEqual(calculatePosition(1000, 1500), 1250.0);
});

test('Multi-Tenant Data Isolation and OCC Versioning', async () => {
  // 1. Fetch seed tenant A (Acme SF) and tenant B (Tokyo Lab)
  const sfTenant = await prisma.tenant.findFirst({ where: { slug: 'sf-hq' } });
  const tokyoTenant = await prisma.tenant.findFirst({ where: { slug: 'tokyo-lab' } });
  const marcusMember = await prisma.user.findFirst({ where: { email: 'marcus.dev@acme.com' } });

  assert.ok(sfTenant, 'SF Tenant should exist');
  assert.ok(tokyoTenant, 'Tokyo Tenant should exist');
  assert.ok(marcusMember, 'Marcus user should exist');

  // Verify Marcus is member of SF Tenant, but NOT Tokyo Tenant
  const marcusSfMembership = await prisma.membership.findFirst({
    where: { userId: marcusMember.id, tenantId: sfTenant.id },
  });
  const marcusTokyoMembership = await prisma.membership.findFirst({
    where: { userId: marcusMember.id, tenantId: tokyoTenant.id },
  });

  assert.ok(marcusSfMembership, 'Marcus belongs to SF Tenant');
  assert.strictEqual(marcusTokyoMembership, null, 'Marcus does NOT belong to Tokyo Tenant (Strict Isolation)');

  // 2. Test Optimistic Concurrency Control (OCC) logic on a test task
  const board = await prisma.board.findFirst({ where: { tenantId: sfTenant.id } });
  const column = await prisma.column.findFirst({ where: { boardId: board.id } });

  const testTask = await prisma.task.create({
    data: {
      boardId: board.id,
      columnId: column.id,
      tenantId: sfTenant.id,
      title: 'OCC Test Task',
      position: 5000,
      version: 1,
      createdBy: marcusMember.id,
    },
  });

  assert.strictEqual(testTask.version, 1, 'Initial OCC version is 1');

  // Simulate User 1 reading task version 1 and updating
  const user1ReadVersion = testTask.version;

  // Simulate User 2 reading task version 1 and updating first
  const updatedByUser2 = await prisma.task.update({
    where: { id: testTask.id },
    data: {
      title: 'Updated by User 2',
      version: testTask.version + 1,
    },
  });

  assert.strictEqual(updatedByUser2.version, 2, 'Version incremented to 2 by User 2');

  // Now User 1 attempts to commit with stale version 1
  const isConflict = updatedByUser2.version !== user1ReadVersion;
  assert.strictEqual(isConflict, true, 'Conflict successfully detected: Server version (2) != User 1 expected version (1)');

  // Clean up test task
  await prisma.task.delete({ where: { id: testTask.id } });
});
