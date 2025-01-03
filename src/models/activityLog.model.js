import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema({
  email: { type: String, required: true },
  ipAddress: { type: String, required: true },
  action: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model('ActivityLog', ActivityLogSchema);