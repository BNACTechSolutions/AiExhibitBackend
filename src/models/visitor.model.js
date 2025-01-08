import mongoose from 'mongoose';

const visitorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "ClientMaster", required: true },
    timestamp: { type: Date, default: Date.now }
});

export default mongoose.model('Visitor', visitorSchema);