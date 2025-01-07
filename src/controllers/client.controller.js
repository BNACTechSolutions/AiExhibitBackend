import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import ClientMaster from '../models/clientMaster.model.js';
import ClientUser from '../models/clientUser.model.js';
import ClientLanguage from '../models/clientLanguage.model.js';
import visitorModel from '../models/visitor.model.js';
import { sendSetupLinkEmail } from '../utils/emailService.js';
import landingPageModel from '../models/landingPage.model.js';
import ActivityLog from '../models/activityLog.model.js';
import { ObjectId } from 'mongodb';
import axios from "axios";
import nodemailer from "nodemailer";

export const addClient = async (req, res) => {
    const {
        name, email, mobile, status, allottedUsers,
        displayAllotted, textSize, validityDays, audio, isl, video,
        languages // Added languages selection
    } = req.body;

    try {
        // Check unique email and mobile
        const existingClient = await ClientMaster.findOne({ email, mobile });
        if (existingClient) {
            return res.status(400).json({ message: "Email and Mobile must be unique." });
        }

        // Validate email and mobile format
        const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Invalid email format." });
        }
        if (!/^\d{10}$/.test(mobile)) {
            return res.status(400).json({ message: "Mobile must be a 10-digit number." });
        }

        // Generate a unique link for the client (This is now just a placeholder)
        const uniqueLink = `${generateRandomLink()}`;

        // Create new client
        const client = new ClientMaster({
            name,
            email,
            mobile,
            status,
            textSize,
            audio,
            isl,
            video,
            validityDate: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000),
            createdBy: req.userId,
            link: uniqueLink, // This will be updated with actual URL when landing page is set up
            qrCode: null // No QR code here yet
        });

        await client.save();

        // Generate random password
        const randomPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        // Create super admin user for client
        const superAdminUser = new ClientUser({
            clientId: client._id,
            userType: 0, // Super Admin
            email,
            mobile,
            password: hashedPassword,
            status: 1 // Active
        });

        await superAdminUser.save();

        // Create or update client language record
        const clientLanguages = {
            clientId: client._id,
            english: languages.includes('english') ? 1 : 0,
            hindi: languages.includes('hindi') ? 1 : 0,
            odia: languages.includes('odia') ? 1 : 0,
            bengali: languages.includes('bengali') ? 1 : 0,
            telugu: languages.includes('telugu') ? 1 : 0,
            tamil: languages.includes('tamil') ? 1 : 0,
            malayalam: languages.includes('malayalam') ? 1 : 0,
            kannada: languages.includes('kannada') ? 1 : 0,
            marathi: languages.includes('marathi') ? 1 : 0,
            gujarati: languages.includes('gujarati') ? 1 : 0,
            marwadi: languages.includes('marwadi') ? 1 : 0,
            l1: languages.includes('l1') ? 1 : 0, // Custom language L1
            l2: languages.includes('l2') ? 1 : 0  // Custom language L2
        };

        const clientLang = new ClientLanguage(clientLanguages);
        await clientLang.save();

        // Generate a JWT token for password setup
        const token = jwt.sign({ userId: superAdminUser._id }, process.env.JWT_SECRET, { expiresIn: '2h' });

        // Send setup link email to the user
        const setupLink = `${process.env.PANEL_FRONTEND_URL}/setup-password/${email}/${randomPassword}?role=client`;
        await sendSetupLinkEmail(email, setupLink);

        res.status(201).json({ message: "Client added successfully and setup email sent.", client });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Function to generate a random alphanumeric link
const generateRandomLink = () => {
    return Math.random().toString(36).substring(2, 10);
};

export const loginClient = async (req, res) => {
    const { email, password, recaptchaToken } = req.body;

    try {
        const recaptchaResponse = await axios.post(
            `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
        );
        
        if (!recaptchaResponse.data.success || recaptchaResponse.data.score < 0.5) {
            console.log(recaptchaResponse.data)
            return res.status(400).send({ message: "Failed reCAPTCHA verification" });
        }

        // Find the user by email
        const user = await ClientUser.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "Client user not found." });
        }

        // Check if the user is active
        if (user.status !== 1) {
            return res.status(403).json({ message: "Account is inactive. Please contact support." });
        }

        // Compare the entered password with the hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        // Generate a JWT token
        const token = jwt.sign(
            { userId: user._id, clientId: user.clientId, userType: user.userType, email },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const logEntry = new ActivityLog({
            email,
            ipAddress,
            action: 'Client logged in',
        });
        await logEntry.save();

        const client = new ObjectId(user.clientId);
        const userQr = await landingPageModel.findOne({ clientId: client });  // Wait for the promise to resolve
        const qrUrl = userQr?.qrCode || null;  // Extract qrCode after the promise resolves
        const code = userQr?.uniqueUrl || "";

        res.status(200).json({
            message: "Login successful.",
            token,
            user: {
                id: user._id,
                email: user.email,
                mobile: user.mobile,
                clientId: user.clientId,
                userType: user.userType,
                qrURL: qrUrl,
                code
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const setupPassword = async (req, res) => {
    const { email, tempPassword, newPassword } = req.body;
    try {
        const user = await ClientUser.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        const isTempPasswordCorrect = await bcrypt.compare(tempPassword, user.password);
        if (!isTempPasswordCorrect) return res.status(400).json({ message: "Invalid temporary password" });

        // Hash new password and save
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.status(200).json({ message: "Password set successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getVisitorData = async(req, res) => {
    const {name, mobile} = req.body;
    try {
        const existingVisitor = await visitorModel.findOne({ name, mobile });
        if (!/^\d{10}$/.test(mobile)) {
            return res.status(400).json({ message: "Mobile must be a 10-digit number." });
        }

        if(!existingVisitor){
            const newVisitor = new visitorModel({
                name,
                mobile
            });

            newVisitor.save();
        }

        res.status(200).json({message: "Visitor data stored successfully"})
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const verificationCodes = {};

export const requestPasswordReset = async (req, res) => {
    const { email, newPassword } = req.body;
    try {
        const user = await ClientUser.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        const verificationCode = Math.floor(100000 + Math.random() * 900000);
        verificationCodes[email] = {
            code: verificationCode,
            expiresAt: Date.now() + 15 * 60 * 1000,
            newPassword,
        };

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: "noreplybnac@gmail.com",
                pass: "wiia pehe yngw fvzr",
            },
        });

        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: email,
            subject: "Password Reset Verification Code",
            text: `Your verification code is: ${verificationCode}`,
        });

        res.status(200).json({ message: "Verification code sent to email" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const verifyResetCodeAndUpdatePassword = async (req, res) => {
    const { email, code } = req.body;
    try {
        const record = verificationCodes[email];

        if (!record || record.expiresAt < Date.now()) {
            return res.status(400).json({ message: "Verification code expired or invalid" });
        }

        if (parseInt(code) !== record.code) {
            return res.status(400).json({ message: "Invalid verification code" });
        }

        // Update password
        const hashedPassword = await bcrypt.hash(record.newPassword, 10);
        await ClientUser.updateOne({ email }, { password: hashedPassword });

        // Remove the verification code
        delete verificationCodes[email];

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};