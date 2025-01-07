import mongoose from "mongoose";

const landingPageSchema = new mongoose.Schema({
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "ClientMaster", required: true },
    displayImage: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    uniqueUrl: { type: String, required: true },
    qrCode: { type: String },
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
    islVideo: { type: String, default: null },  // Optional field for ISL video URL
});

export default mongoose.model("LandingPage", landingPageSchema);