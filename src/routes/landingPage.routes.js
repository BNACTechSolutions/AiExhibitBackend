import express from 'express';
import multer from 'multer';
import { setupLandingPage, editLandingPage, getLandingPage } from '../controllers/landingPage.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import activityLogger from '../middlewares/activityLog.middleware.js';

const router = express.Router();

// Multer setup for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage }).single('displayImage');
const uploadVideo = multer({ storage }).single('islVideo');

// Route for setting up the landing page
router.post('/setup', verifyToken, upload,activityLogger,uploadVideo, setupLandingPage);
router.put('/edit', verifyToken, upload, activityLogger, uploadVideo, editLandingPage);
router.get("/:id", getLandingPage);

export default router;