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
    punjabi: { type: Number, default: 0 },
    assamese: { type: Number, default: 0 },
    urdu: { type: Number, default: 0 },
    sanskrit: { type: Number, default: 0 },
    spanish: { type: Number, default: 0 },
    french: { type: Number, default: 0 },
    german: { type: Number, default: 0 },
    mandarin: { type: Number, default: 0 },
    japanese: { type: Number, default: 0 },
    arabic: { type: Number, default: 0 },
    russian: { type: Number, default: 0 },
    portuguese: { type: Number, default: 0 },
    italian: { type: Number, default: 0 },
    korean: { type: Number, default: 0 },
    thai: { type: Number, default: 0 }
});

export default mongoose.model('ClientLanguage', clientLanguageSchema);