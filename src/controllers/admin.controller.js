import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import AdminUser from '../models/adminUser.model.js';
import mongoose from 'mongoose';
import { sendSetupLinkEmail } from '../utils/emailService.js';
import nodemailer from "nodemailer";
import clientUserModel from '../models/clientUser.model.js';
import axios from 'axios';
import ActivityLog from '../models/activityLog.model.js';
import exhibitLog from '../models/exhibitLog.model.js';
import Visitor from '../models/visitor.model.js'

export const addAdminUser = async (req, res) => {
    const { name, mobile, email, user_type } = req.body;
    try {
        const existingUser = await AdminUser.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "User already exists" });

        const randomPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        const newUser = new AdminUser({
            name,
            password: hashedPassword,
            mobile,
            email,
            user_type,
            created_by: req.userId,
            user_id: new mongoose.Types.ObjectId(),
            status: 1
        });

        await newUser.save();
        const setupLink = `${process.env.PANEL_FRONTEND_URL}/admin/setup-password/${email}/${randomPassword}?role=admin`;
        await sendSetupLinkEmail(email, setupLink);

        res.status(201).json({ message: "Admin user created"});
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const loginAdminUser = async (req, res) => {
    const { email, password, recaptchaToken } = req.body;

    try {
        const recaptchaResponse = await axios.post(
            `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
        );
        
        if (!recaptchaResponse.data.success || recaptchaResponse.data.score < 0.5) {
            console.log(recaptchaResponse.data)
            return res.status(400).send({ message: "Failed reCAPTCHA verification" });
        }

        const user = await AdminUser.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        if(user.status === 0){
            return res.status(400).send({ message: "Account is blocked!"})
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // Generate JWT token
        const token = jwt.sign({ id: user._id, user_type: user.user_type, email }, process.env.JWT_SECRET, { expiresIn: "2h" });
        res.status(200).json({ 
            message: "Login successful",
            token,
            admin: {
                user_type: user.user_type
            }
        });

        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const logEntry = new ActivityLog({
            email,
            ipAddress,
            action: 'User logged in',
        });
        await logEntry.save();

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const verificationCodes = {};

export const requestPasswordReset = async (req, res) => {
    const { email, newPassword } = req.body;
    try {
        const user = await AdminUser.findOne({ email });
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
        await AdminUser.updateOne({ email }, { password: hashedPassword });

        // Remove the verification code
        delete verificationCodes[email];

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const setupPassword = async (req, res) => {
    const { email, tempPassword, newPassword } = req.body;
    try {
        const user = await AdminUser.findOne({ email });
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

export const editAdminUser = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const updatedUser = await AdminUser.findByIdAndUpdate(id, { status }, { new: true });
        if (!updatedUser) return res.status(404).json({ message: "User not found" });

        res.status(200).json({ message: "User updated successfully", updatedUser });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const viewAdminUser = async (req, res) => {
    try {
      const users = await AdminUser.find({user_type: { $in: [1, 2] } }).select('-password'); // Assuming 1 = admin and 2 = manager
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch users' });
    }
};

export const getAdminProfile = async (req, res) => {
    try {
      const userId = req.userId; // Extracted from the middleware
      const user = await AdminUser.findById(userId).select("name email user_type"); // Fetch only relevant fields
  
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      res.json(user); // Send profile data
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
};

export const getAllClients = async (req, res) => {
    try {
      const users = await clientUserModel
        .find({ userType: { $in: [0, 1] } })
        .select('-password') // Exclude password
        .populate('clientId', 'name'); // Populate clientId with only the name field from ClientMaster
  
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
};  

export const getActivityLogs = async (req, res) => {
    try {
      const logs = await ActivityLog.find().sort({ timestamp: -1 }); // Retrieve all logs sorted by time
      res.status(200).send(logs);
    } catch (error) {
      res.status(500).send('An error occurred');
    }
};

export const getExhibitLogs = async (req, res) => {
    try{
        const logs = await exhibitLog.find().sort({ timestamp: -1});
        res.status(200).send(logs);
    } catch (error){
        res.status(500).send('An error occurred');
    }
}

export const getAllUsers = async (req, res) => {
    try {
        const data = await Visitor.find().populate('clientId', 'name'); // Populate clientId and only return the name field
        res.json(data);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
};