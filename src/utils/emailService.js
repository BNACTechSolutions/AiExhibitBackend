// utils/emailService.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

export const sendSetupLinkEmail = async (to, setupLink) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: "noreplybnac@gmail.com",
            pass: "pmlx xedc rype slvp"
        }
    });

    const mailOptions = {
        from: process.env.GMAIL_USER,
        to,
        subject: 'Set up your password',
        text: `Welcome! Please set up your password using the following link: ${setupLink}`,
        html: `<p>Welcome! Please set up your password using the following link: <a href="${setupLink}">${setupLink}</a></p>`
    };

    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error while sending email:", error);
                reject(error);
            } else {
                console.log("Email sent successfully:", info.response);
                resolve(info);
            }
        });
    });
};
