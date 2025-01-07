import mongoose from 'mongoose';

const redirectMappingSchema = new mongoose.Schema({
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientMaster',
        required: true,
    },
    shortUrl: {
        type: String,
        required: true,
        unique: true,
    },
    redirectUrl: {
        type: String,
        required: true,
    },
});

export default mongoose.model('RedirectMapping', redirectMappingSchema);