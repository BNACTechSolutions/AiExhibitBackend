import express from 'express';
import { addClient, getVisitorData, loginClient, setupPassword, requestPasswordReset, verifyResetCodeAndUpdatePassword, getAllUsersForClient, getExhibitLogsForClient, editClientUser, getClientDetails } from '../controllers/client.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import activityLogger from '../middlewares/activityLog.middleware.js';

const router = express.Router();

// Only allow Super Admins and Admins to add clients
router.post('/add', authMiddleware([0, 1, 2]),activityLogger, addClient);
router.put('/:id', authMiddleware([0,1]),activityLogger, editClientUser);
router.get('/getclient/:clientId', authMiddleware([0]), getClientDetails);

router.post('/login', loginClient);

router.post('/setup-password',activityLogger, setupPassword);

// Route for forgotten password
router.post('/request-password-reset',activityLogger, requestPasswordReset);
router.post('/verify-reset-code',activityLogger, verifyResetCodeAndUpdatePassword);

router.post('/visitor-data', getVisitorData);
router.get('/get-visitor-data', verifyToken, getAllUsersForClient);
router.get('/get-exhibit-logs', verifyToken, getExhibitLogsForClient);

export default router;
