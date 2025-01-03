import express from 'express';
import { updateRedirectUrl, handleRedirect } from '../controllers/redirect.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Route to update redirect URL
router.post('/update-redirect-url',verifyToken, updateRedirectUrl);
router.get('/:shortUrl', handleRedirect);

export default router;
