import mongoose from 'mongoose';

const clientUserSchema = new mongoose.Schema({
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientMaster' },
    userType: { type: Number, required: true }, // 0-Super Admin, 1-Admin
    email: { type: String, required: true },
    mobile: { type: String, required: true },
    password: { type: String, required: true }, // New field for storing hashed password
    status: { type: Number, required: true, default: 1 }, // 0-Inactive, 1-Active
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now }
});

export default mongoose.model('ClientUser', clientUserSchema);