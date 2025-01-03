import mongoose from 'mongoose';

const adminUserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true, // Ensure emails are unique
    },
    password: {
        type: String,
        required: true,
    },
    mobile: {
        type: String,
        required: true,
    },
    user_type: {
        type: Number,
        required: true,
    },
    status: {
        type: Number,
        required: true,
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
});

const AdminUser = mongoose.model('AdminUser', adminUserSchema);
export default AdminUser;