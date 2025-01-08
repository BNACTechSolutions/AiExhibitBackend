// models/advertiser.model.js
import mongoose from 'mongoose';

const advertiserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  mobile: { type: String, required: true },
  active: { type: Boolean, default: true }, // New field to track the active status
});

export default mongoose.model('Advertiser', advertiserSchema);