import express from 'express';
import { updateRedirectUrl, handleRedirect } from '../controllers/redirect.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { trackQRScan } from '../middlewares/qrLogs.middleware.js';

const router = express.Router();

// Route to update redirect URL
router.post('/update-redirect-url',verifyToken, updateRedirectUrl);
router.get('/:shortUrl', trackQRScan, handleRedirect);

export default router;
