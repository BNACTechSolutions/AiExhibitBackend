import express from 'express';
import { addAdvertiser, addAdvertisement } from '../controllers/advertiser.controller.js';

const router = express.Router();

router.post('/add-advertiser', addAdvertiser);
router.post('/add-advertisement', addAdvertisement);

export default router;