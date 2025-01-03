// utils/emailService.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

export const sendSetupLinkEmail = async (to, setupLink) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: "noreplybnac@gmail.com",
            pass: "wiia pehe yngw fvzr"
        }
    });

    const mailOptions = {
        from: process.env.GMAIL_USER,
        to,
        subject: 'Set up your password',
        text: `Welcome! Please set up your password using the following link: ${setupLink}`,
        html: `<p>Welcome! Please set up your password using the following link: <a href="${setupLink}">${setupLink}</a></p>`
    };

    try {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error while sending email:", error);
                return res.status(500).json({ message: "Failed to send setup link email" });
            } else {
                console.log("Email sent successfully:", info.response);
                return res.status(201).json({ message: "Admin added successfully and email sent." });
            }
        });        
    } catch (error) {
        throw new Error("Failed to send setup link email");
    }
};
