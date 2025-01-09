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

const upload = multer({ storage }).fields([
    { name: 'displayImage', maxCount: 1 }, // For the display image
    { name: 'islVideo', maxCount: 1 }     // For the ISL video
]);

// Route for setting up the landing page
router.post('/setup', verifyToken, upload,activityLogger, setupLandingPage);
router.put('/edit', verifyToken, upload, activityLogger, editLandingPage);
router.get("/:id", getLandingPage);

export default router;