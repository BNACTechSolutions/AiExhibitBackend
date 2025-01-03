import mongoose from 'mongoose';

const visitorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    mobile: { type: String, required: true },
});

export default mongoose.model('Visitor', visitorSchema);