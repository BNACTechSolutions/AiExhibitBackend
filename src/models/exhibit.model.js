import mongoose from 'mongoose';

const exhibitSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    titleImage: { type: String, required: true },  // URL of the title image
    images: [{ type: String }],  // Array to store URLs of multiple images
    code: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
    clientId: {type: mongoose.Schema.Types.ObjectId, ref: "clientUser", required: true},
    translations: [
        {
            language: String,
            title: String,
            description: String,
            audioUrls: {
                title: String,
                description: String,
            },
        },
    ],
    islVideo: { type: String, default: null },
    status: { type: Number, required: true, default: 1 }
});

export default mongoose.model('Exhibit', exhibitSchema);