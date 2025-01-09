// routes/exhibit.routes.js
import express from "express";
import multer from "multer";
import { addExhibit, getExhibit, deleteExhibit, editExhibit, getAllExhibits } from "../controllers/exhibit.controller.js";
import {verifyToken} from "../middlewares/auth.middleware.js";
import activityLogger from "../middlewares/activityLog.middleware.js";

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');  // Directory to store files
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);  // Unique file name
    }
});

const upload = multer({ storage }).fields([
    { name: 'titleImage', maxCount: 1 },  // Title image (single upload)
    { name: 'images', maxCount: 10 },  // Multiple images (maximum 10)
    { name: 'islVideo', maxCount: 1}
]);

router.post('/add', upload, verifyToken,activityLogger, addExhibit);
router.get("/all", verifyToken, getAllExhibits);
router.get("/:code", getExhibit);

// Route to delete an exhibit by code
router.delete("/:code", verifyToken,activityLogger, deleteExhibit);
router.put("/:code", verifyToken, upload,activityLogger, editExhibit);


export default router;