// models/qrScan.model.js
import mongoose from 'mongoose';

const qrScanSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientMaster',
    required: true,
  },
  shortUrl: {
    type: String,
    required: true,
  },
  ipAddress: {
    type: String,
    required: true,
  },
  deviceType: {
    type: String,
    required: true,
  },
  scanTimestamp: {
    type: Date,
    default: Date.now,
  },
  redirectMappingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RedirectMapping',
    required: true,
  },
});

export default mongoose.model('QRScan', qrScanSchema);
