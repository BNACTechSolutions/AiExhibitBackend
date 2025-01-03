import express from 'express';
import { addAdminUser, loginAdminUser, requestPasswordReset, verifyResetCodeAndUpdatePassword, setupPassword, editAdminUser, viewAdminUser, getAdminProfile, getAllClients, getActivityLogs } from '../controllers/admin.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import activityLogger from '../middlewares/activityLog.middleware.js';

const router = express.Router();

// Route for creating an admin user (accessible only by super admin)
router.post('/add', authMiddleware([0]), activityLogger, addAdminUser);

// Route for admin user login
router.post('/login', loginAdminUser);

// Route for forgotten password
router.post('/request-password-reset',activityLogger, requestPasswordReset);
router.post('/verify-reset-code',activityLogger, verifyResetCodeAndUpdatePassword);

// New endpoint for setting up password after receiving temporary password
router.post('/setup-password', activityLogger,setupPassword);

// Edit Admin User - Only Status can be edited
router.put('/:id', authMiddleware([0]),activityLogger, editAdminUser);

// View Admin User Details
router.get('/', authMiddleware([0,1]), viewAdminUser);
router.get('/getClients', authMiddleware([0,1]), getAllClients);

router.get('/profile', authMiddleware([0,1,2]), getAdminProfile);

router.get('/logs', authMiddleware([0]), getActivityLogs)

export default router;
