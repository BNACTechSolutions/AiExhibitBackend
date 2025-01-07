import express from 'express';
import multer from 'multer';
import { addAdminUser, loginAdminUser, requestPasswordReset, verifyResetCodeAndUpdatePassword, setupPassword, editAdminUser, viewAdminUser, getAdminProfile, getAllClients, getActivityLogs, getAllQRScans } from '../controllers/admin.controller.js';
import { getClientAds, allocateAdvertisement, addAdvertisement, addAdvertiser, getAllAdvertisers, getAllAdvertisements } from '../controllers/advertiser.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import activityLogger from '../middlewares/activityLog.middleware.js';

const router = express.Router();

// Multer setup for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Folder where the files will be temporarily stored
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); // Unique filename to avoid conflicts
    }
});

// Multer middleware for advertisement image
const uploadAdImage = multer({ storage }).single('adImage');

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
router.get('/qr-scans',authMiddleware([0,1,2]), getAllQRScans);

// Advertisement Routes
router.post('/add-advertiser', authMiddleware([0,1,2]), addAdvertiser);
router.post('/add-advertisement', authMiddleware([0,1,2]), uploadAdImage, addAdvertisement);
router.post('/allocate-ad',authMiddleware([0,1,2]), allocateAdvertisement);
router.get('/getads', authMiddleware([0,1,2]), getClientAds);
router.get('/advertisers', authMiddleware([0,1,2]), getAllAdvertisers);
router.get('/advertisements', authMiddleware([0,1,2]), getAllAdvertisements);

export default router;