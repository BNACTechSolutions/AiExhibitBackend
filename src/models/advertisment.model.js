// models/advertisement.model.js
import mongoose from 'mongoose';

const advertisementSchema = new mongoose.Schema({
  adName: { type: String, required: true },
  adImage: { type: String, required: true }, // URL or file path of the ad image
  advertiserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advertiser',
    required: true,
  },
});

export default mongoose.model('Advertisement', advertisementSchema);