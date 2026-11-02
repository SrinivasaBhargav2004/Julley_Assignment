const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');

const authController = require('../controllers/authController');
const organizationController = require('../controllers/organizationController');
const tenantController = require('../controllers/tenantController');
const boardController = require('../controllers/boardController');
const columnController = require('../controllers/columnController');
const taskController = require('../controllers/taskController');
const activityController = require('../controllers/activityController');

// -------------------------------------------------------------
// Authentication & User Switching (Demo / Evaluation)
// -------------------------------------------------------------
router.get('/auth/users', authController.listUsers);
router.post('/auth/switch-user', authController.switchUser);
router.get('/auth/me', authMiddleware, authController.getMe);

// -------------------------------------------------------------
// Organizations & Tenant Switcher Discovery
// -------------------------------------------------------------
router.get('/organizations', authMiddleware, organizationController.listOrganizations);
router.get('/organizations/:orgId/tenants', authMiddleware, organizationController.getTenantsForOrg);
router.post('/organizations', authMiddleware, organizationController.createOrganization);

router.get('/tenants', authMiddleware, tenantController.listTenants);
router.get('/tenants/:id', authMiddleware, tenantController.getTenantById);
router.post('/tenants', authMiddleware, tenantController.createTenant);

// -------------------------------------------------------------
// Tenant-Scoped Business Routes (Strict Data Isolation Enforced)
// All routes below require BOTH authMiddleware and tenantMiddleware!
// -------------------------------------------------------------
const tenantScoped = express.Router();
tenantScoped.use(authMiddleware);
tenantScoped.use(tenantMiddleware);

// Boards
tenantScoped.get('/boards', boardController.listBoards);
tenantScoped.get('/boards/:id', boardController.getBoardById);
tenantScoped.post('/boards', boardController.createBoard);
tenantScoped.put('/boards/:id', boardController.updateBoard);
tenantScoped.delete('/boards/:id', boardController.deleteBoard);

// Columns
tenantScoped.post('/boards/:boardId/columns', columnController.createColumn);
tenantScoped.put('/columns/:id', columnController.updateColumn);
tenantScoped.delete('/columns/:id', columnController.deleteColumn);

// Tasks
tenantScoped.get('/tasks/:id', taskController.getTaskById);
tenantScoped.post('/boards/:boardId/tasks', taskController.createTask);
tenantScoped.put('/tasks/:id', taskController.updateTask); // OCC edit
tenantScoped.patch('/tasks/:id/move', taskController.moveTask); // Fractional reorder/move
tenantScoped.delete('/tasks/:id', taskController.deleteTask);

// Activity Logs
tenantScoped.get('/activities', activityController.listActivities);

router.use('/', tenantScoped);

// Fallback 404 handler for unknown API routes
router.use((req, res) => {
  res.status(404).json({
    error: 'NotFound',
    message: `API route ${req.method} ${req.originalUrl} not found.`,
  });
});

module.exports = router;
