const prisma = require('./prisma');

async function seed() {
  console.log('🌱 Starting database seeding...');

  // Clean existing data
  await prisma.activityLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.column.deleteMany();
  await prisma.board.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.organization.deleteMany();

  // 1. Create Organizations
  const acmeOrg = await prisma.organization.create({
    data: {
      name: 'Acme Global Enterprises',
      slug: 'acme-global',
    },
  });

  const nexusOrg = await prisma.organization.create({
    data: {
      name: 'Nexus Cloud Systems',
      slug: 'nexus-cloud',
    },
  });

  console.log('✅ Created Organizations:', acmeOrg.name, nexusOrg.name);

  // 2. Create Tenants (Branches)
  const acmeSfTenant = await prisma.tenant.create({
    data: {
      organizationId: acmeOrg.id,
      name: 'HQ - San Francisco',
      slug: 'sf-hq',
      code: 'HQ-SF',
    },
  });

  const acmeLondonTenant = await prisma.tenant.create({
    data: {
      organizationId: acmeOrg.id,
      name: 'London R&D Branch',
      slug: 'london-rd',
      code: 'LDN-RND',
    },
  });

  const nexusTokyoTenant = await prisma.tenant.create({
    data: {
      organizationId: nexusOrg.id,
      name: 'Tokyo Innovation Lab',
      slug: 'tokyo-lab',
      code: 'TKO-LAB',
    },
  });

  const nexusBerlinTenant = await prisma.tenant.create({
    data: {
      organizationId: nexusOrg.id,
      name: 'Berlin Edge Systems',
      slug: 'berlin-hub',
      code: 'BER-EDGE',
    },
  });

  console.log('✅ Created Tenants:', acmeSfTenant.name, acmeLondonTenant.name, nexusTokyoTenant.name, nexusBerlinTenant.name);

  // 3. Create Users
  const alexAdmin = await prisma.user.create({
    data: {
      email: 'alex.admin@acme.com',
      name: 'Alex Morgan',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    },
  });

  const sarahTenantAdmin = await prisma.user.create({
    data: {
      email: 'sarah.tenant@acme.com',
      name: 'Sarah Chen',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces',
    },
  });

  const marcusMember = await prisma.user.create({
    data: {
      email: 'marcus.dev@acme.com',
      name: 'Marcus Vance',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
    },
  });

  const elenaLondonAdmin = await prisma.user.create({
    data: {
      email: 'elena.london@acme.com',
      name: 'Elena Rostova',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=faces',
    },
  });

  const kenjiNexusAdmin = await prisma.user.create({
    data: {
      email: 'kenji.nexus@nexus.com',
      name: 'Kenji Sato',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces',
    },
  });

  console.log('✅ Created Users with Avatars');

  // 4. Create Memberships (Role-Based Access Control)
  // Alex is Org Admin of Acme Global (tenantId: null means org-wide tenant access)
  await prisma.membership.create({
    data: {
      userId: alexAdmin.id,
      organizationId: acmeOrg.id,
      tenantId: null,
      role: 'ORG_ADMIN',
    },
  });

  // Sarah is Tenant Admin of SF HQ
  await prisma.membership.create({
    data: {
      userId: sarahTenantAdmin.id,
      organizationId: acmeOrg.id,
      tenantId: acmeSfTenant.id,
      role: 'TENANT_ADMIN',
    },
  });

  // Marcus is Member of SF HQ
  await prisma.membership.create({
    data: {
      userId: marcusMember.id,
      organizationId: acmeOrg.id,
      tenantId: acmeSfTenant.id,
      role: 'MEMBER',
    },
  });

  // Elena is Tenant Admin of London R&D
  await prisma.membership.create({
    data: {
      userId: elenaLondonAdmin.id,
      organizationId: acmeOrg.id,
      tenantId: acmeLondonTenant.id,
      role: 'TENANT_ADMIN',
    },
  });

  // Kenji is Org Admin of Nexus Cloud
  await prisma.membership.create({
    data: {
      userId: kenjiNexusAdmin.id,
      organizationId: nexusOrg.id,
      tenantId: null,
      role: 'ORG_ADMIN',
    },
  });

  console.log('✅ Created RBAC Memberships');

  // 5. Create Boards & Columns & Tasks for SF HQ
  const sfBoard = await prisma.board.create({
    data: {
      tenantId: acmeSfTenant.id,
      title: 'Platform Engineering Q4',
      description: 'Core microservices, tenant routing, and real-time event pipeline',
      createdBy: sarahTenantAdmin.id,
    },
  });

  const sfCols = await Promise.all([
    prisma.column.create({
      data: {
        boardId: sfBoard.id,
        tenantId: acmeSfTenant.id,
        title: 'Backlog',
        position: 1000,
        color: '#64748b',
      },
    }),
    prisma.column.create({
      data: {
        boardId: sfBoard.id,
        tenantId: acmeSfTenant.id,
        title: 'In Progress',
        position: 2000,
        color: '#3b82f6',
      },
    }),
    prisma.column.create({
      data: {
        boardId: sfBoard.id,
        tenantId: acmeSfTenant.id,
        title: 'Review & QA',
        position: 3000,
        color: '#f59e0b',
      },
    }),
    prisma.column.create({
      data: {
        boardId: sfBoard.id,
        tenantId: acmeSfTenant.id,
        title: 'Completed',
        position: 4000,
        color: '#10b981',
      },
    }),
  ]);

  const [colBacklog, colInProgress, colReview, colDone] = sfCols;

  // Create Tasks for SF HQ
  const task1 = await prisma.task.create({
    data: {
      columnId: colInProgress.id,
      boardId: sfBoard.id,
      tenantId: acmeSfTenant.id,
      title: 'Implement Tenant Middleware & Cross-Tenant Leakage Shield',
      description: 'Ensure every REST route and WebSocket channel enforces strict tenant isolation and prevents IDOR attacks.',
      priority: 'URGENT',
      position: 1000,
      assigneeId: marcusMember.id,
      dueDate: new Date(Date.now() + 86400000 * 3),
      version: 1,
      createdBy: sarahTenantAdmin.id,
    },
  });

  const task2 = await prisma.task.create({
    data: {
      columnId: colInProgress.id,
      boardId: sfBoard.id,
      tenantId: acmeSfTenant.id,
      title: 'Optimistic Concurrency Control (OCC) with Version Vectors',
      description: 'Implement version increment checks on task updates to prevent lost updates during concurrent edits.',
      priority: 'HIGH',
      position: 2000,
      assigneeId: sarahTenantAdmin.id,
      dueDate: new Date(Date.now() + 86400000 * 5),
      version: 2,
      createdBy: sarahTenantAdmin.id,
    },
  });

  const task3 = await prisma.task.create({
    data: {
      columnId: colBacklog.id,
      boardId: sfBoard.id,
      tenantId: acmeSfTenant.id,
      title: 'Fractional Indexing for Drag-and-Drop Reordering',
      description: 'Eliminate table-wide row re-writes by calculating midpoint float positions between adjacent cards.',
      priority: 'MEDIUM',
      position: 1000,
      assigneeId: marcusMember.id,
      dueDate: new Date(Date.now() + 86400000 * 7),
      version: 1,
      createdBy: marcusMember.id,
    },
  });

  const task4 = await prisma.task.create({
    data: {
      columnId: colReview.id,
      boardId: sfBoard.id,
      tenantId: acmeSfTenant.id,
      title: 'WebSocket Presence Scoping per Tenant & Board Room',
      description: 'Broadcast active users, live editing avatars, and heartbeats strictly within the tenant board room.',
      priority: 'HIGH',
      position: 1000,
      assigneeId: alexAdmin.id,
      dueDate: new Date(Date.now() + 86400000 * 2),
      version: 3,
      createdBy: alexAdmin.id,
    },
  });

  const task5 = await prisma.task.create({
    data: {
      columnId: colDone.id,
      boardId: sfBoard.id,
      tenantId: acmeSfTenant.id,
      title: 'Multi-Tenant Database Schema & ER Model',
      description: 'Design organizations, tenants, users, memberships, boards, columns, and tasks with foreign keys and cascade rules.',
      priority: 'MEDIUM',
      position: 1000,
      assigneeId: sarahTenantAdmin.id,
      dueDate: new Date(Date.now() - 86400000 * 1),
      version: 1,
      createdBy: sarahTenantAdmin.id,
    },
  });

  // Seed Activity Logs for SF HQ
  await prisma.activityLog.createMany({
    data: [
      {
        tenantId: acmeSfTenant.id,
        boardId: sfBoard.id,
        taskId: task1.id,
        userId: sarahTenantAdmin.id,
        action: 'TASK_CREATED',
        details: JSON.stringify({ title: task1.title, column: 'In Progress', priority: 'URGENT' }),
      },
      {
        tenantId: acmeSfTenant.id,
        boardId: sfBoard.id,
        taskId: task2.id,
        userId: sarahTenantAdmin.id,
        action: 'TASK_UPDATED',
        details: JSON.stringify({ field: 'priority', from: 'MEDIUM', to: 'HIGH' }),
      },
      {
        tenantId: acmeSfTenant.id,
        boardId: sfBoard.id,
        taskId: task4.id,
        userId: alexAdmin.id,
        action: 'TASK_MOVED',
        details: JSON.stringify({ fromColumn: 'In Progress', toColumn: 'Review & QA' }),
      },
      {
        tenantId: acmeSfTenant.id,
        boardId: sfBoard.id,
        taskId: task5.id,
        userId: sarahTenantAdmin.id,
        action: 'TASK_MOVED',
        details: JSON.stringify({ fromColumn: 'Review & QA', toColumn: 'Completed' }),
      },
    ],
  });

  // 6. Create London R&D Board & Tasks (for Acme London Tenant)
  const londonBoard = await prisma.board.create({
    data: {
      tenantId: acmeLondonTenant.id,
      title: 'London AI Research & Delivery',
      description: 'Distributed model inference and edge edge agent evaluation',
      createdBy: elenaLondonAdmin.id,
    },
  });

  const ldnCol1 = await prisma.column.create({
    data: {
      boardId: londonBoard.id,
      tenantId: acmeLondonTenant.id,
      title: 'Research',
      position: 1000,
      color: '#8b5cf6',
    },
  });

  const ldnCol2 = await prisma.column.create({
    data: {
      boardId: londonBoard.id,
      tenantId: acmeLondonTenant.id,
      title: 'Prototyping',
      position: 2000,
      color: '#06b6d4',
    },
  });

  await prisma.task.create({
    data: {
      columnId: ldnCol1.id,
      boardId: londonBoard.id,
      tenantId: acmeLondonTenant.id,
      title: 'Fine-tune quantized agent for edge inference',
      description: 'Benchmark latency and VRAM footprint on Jetson Orin.',
      priority: 'HIGH',
      position: 1000,
      assigneeId: elenaLondonAdmin.id,
      version: 1,
      createdBy: elenaLondonAdmin.id,
    },
  });

  // 7. Create Tokyo Lab Board & Tasks (for Nexus Org - isolated from Acme!)
  const tokyoBoard = await prisma.board.create({
    data: {
      tenantId: nexusTokyoTenant.id,
      title: 'Tokyo Cloud Operations',
      description: 'Automated disaster recovery & multi-region failover cluster',
      createdBy: kenjiNexusAdmin.id,
    },
  });

  const tkoCol1 = await prisma.column.create({
    data: {
      boardId: tokyoBoard.id,
      tenantId: nexusTokyoTenant.id,
      title: 'Planned',
      position: 1000,
      color: '#ec4899',
    },
  });

  await prisma.task.create({
    data: {
      columnId: tkoCol1.id,
      boardId: tokyoBoard.id,
      tenantId: nexusTokyoTenant.id,
      title: 'Regional failover drill for ap-northeast-1',
      description: 'Simulate simulated AZ outage and verify zero-downtime routing.',
      priority: 'URGENT',
      position: 1000,
      assigneeId: kenjiNexusAdmin.id,
      version: 1,
      createdBy: kenjiNexusAdmin.id,
    },
  });

  console.log('✅ Seeding completed successfully!');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
