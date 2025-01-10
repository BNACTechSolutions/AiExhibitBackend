import mongoose from 'mongoose';

const exhibitLogSchema = new mongoose.Schema({
  serialNumber: { type: Number, required: true },
  clientName: { type: String, required: true },
  exhibitCode: { type: String, required: true },
  dateTime: { type: Date, required: true },
  userMobile: { type: String, required: true },
  deviceType: { type: String, required: true },
  ipAddress: { type: String, required: true },
  advertisementId: { type: String, required: false },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientMaster' }
});

export default mongoose.model('ExhibitLog', exhibitLogSchema);