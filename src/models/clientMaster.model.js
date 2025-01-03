import mongoose from 'mongoose';

const clientMasterSchema = new mongoose.Schema({
    name: { type: String, required: true, maxlength: 60 },
    email: { type: String, required: true, unique: true },
    mobile: { type: String, required: true, unique: true, maxlength: 10 },
    status: { type: Number, required: true }, // 1 for Active, 0 for Inactive
    allottedUsers: { type: Number, required: true, min: 1 },
    activeUsers: { type: Number, default: 1 }, // Includes Super Admin
    displayAllotted: { type: Number, required: true, min: 10 },
    activeDisplays: { type: Number, default: 0 },
    displayPoints: { type: Number, default: 99999 },
    displayPointsUsed: { type: Number, default: 0 },
    languages: { type: [String], default: ['English'] },
    textAI: { type: Number, default: 0 }, // 0-No 1-Yes
    audio: { type: Number, default: 0 },
    audioAI: { type: Number, default: 0 },
    audioAssigned: { type: Number, default: 0 },
    video: { type: Number, default: 0 },
    videoAI: { type: Number, default: 0 },
    isl: { type: Number, default: 0 },
    islAI: { type: Number, default: 0 },
    islAssigned: { type: Number, default: 0 },
    textSize: { type: Number, default: 0 }, // Small=0, Medium=1, ...
    validityDate: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    createdAt: { type: Date, default: Date.now },
    modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    modifiedAt: { type: Date, default: Date.now },
    link: { type: String },
    qrCode: { type: String },
    readyToDisplay: { type: Number, default: 0 }
});

export default mongoose.model('ClientMaster', clientMasterSchema);
