import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import adminRoutes from './routes/admin.routes.js';
import clientRoutes from './routes/client.routes.js';
import exhibitRoutes from './routes/exhibit.routes.js';
import landingRoutes from './routes/landingPage.routes.js'
import cors from "cors";
import redirectRoutes from './routes/redirect.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

app.use(cors({origin: '*'}))

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("MongoDB connected");
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        process.exit(1);
    }
};

app.use('/api/admin', adminRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/exhibit', exhibitRoutes);
app.use('/api/landing', landingRoutes);
app.use('/api/redirect', redirectRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    connectDB();
});
