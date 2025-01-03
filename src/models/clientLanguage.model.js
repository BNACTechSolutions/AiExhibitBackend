import mongoose from 'mongoose';

const clientLanguageSchema = new mongoose.Schema({
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientMaster' },
    english: { type: Number, default: 1 }, // Default to English
    hindi: { type: Number, default: 0 },
    odia: { type: Number, default: 0 },
    bengali: { type: Number, default: 0 },
    telugu: { type: Number, default: 0 },
    tamil: { type: Number, default: 0 },
    malayalam: { type: Number, default: 0 },
    kannada: { type: Number, default: 0 },
    marathi: { type: Number, default: 0 },
    gujarati: { type: Number, default: 0 },
    marwadi: { type: Number, default: 0 },
    l1: { type: Number, default: 0 },
    l2: { type: Number, default: 0 }
});

export default mongoose.model('ClientLanguage', clientLanguageSchema);