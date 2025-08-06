import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import ClientMaster from '../models/clientMaster.model.js';
import ClientUser from '../models/clientUser.model.js';
import ClientLanguage from '../models/clientLanguage.model.js';
import visitorModel from '../models/visitor.model.js';
import Exhibit from '../models/exhibit.model.js';
import Landing from '../models/landingPage.model.js';
import { sendSetupLinkEmail } from '../utils/emailService.js';
import landingPageModel from '../models/landingPage.model.js';
import ActivityLog from '../models/activityLog.model.js';
import Visitor from '../models/visitor.model.js';
import exhibitLogModel from '../models/exhibitLog.model.js';
import { ObjectId } from 'mongodb';
import axios from "axios";
import nodemailer from "nodemailer";
import { convertTextToSpeech, translateText } from '../utils/googleApiUtils.js';

export const addClient = async (req, res) => {
    const {
        name, email, mobile, status, maximumDisplays, textSize, validityDays, audio, isl,
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
            maximumDisplays,
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
    const { email, password } = req.body;

    try {
        // const recaptchaResponse = await axios.post(
        //     `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
        // );
        
        // if (!recaptchaResponse.data.success || recaptchaResponse.data.score < 0.5) {
        //     return res.status(400).send({ message: "Failed reCAPTCHA verification" });
        // }

        // Find the user by email
        const user = await ClientUser.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "Client user not found." });
        }

        if(user.status === 0){
            return res.status(400).send({ message: "Your account is blocked!" });
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

export const getVisitorData = async (req, res) => {
  const { name, mobile, clientLink } = req.body;

  try {
    // Validate the mobile number format (10-digit)
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: "Mobile must be a 10-digit number." });
    }

    // Find the ClientMaster based on the clientLink from the URL
    const client = await ClientMaster.findOne({ link: clientLink });

    if (!client) {
      return res.status(400).json({ message: "Client not found for the given link." });
    }

    // Check if the visitor already exists with the same name and mobile
    const existingVisitor = await visitorModel.findOne({ name, mobile });
    
    if (!existingVisitor) {
      // If no existing visitor found, create a new visitor and link to the client
      const newVisitor = new visitorModel({
        name,
        mobile,
        clientId: client._id, // Link to the specific ClientMaster
      });

      await newVisitor.save(); // Save the new visitor
    }

    res.status(200).json({ message: "Visitor data stored successfully" });

  } catch (error) {
    console.error("Error in getVisitorData:", error);
    res.status(500).json({ message: "Error storing visitor data." });
  }
};

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

export const getAllUsersForClient = async (req, res) => {
    try {
        const clientId = req.user.clientId;

        if (!clientId) {
            return res.status(400).json({ message: 'Client not authenticated' });
        }

        const data = await Visitor.find({ clientId })
            .populate('clientId', 'name')  // Populate clientId with only the name field
            .exec();

        res.json(data);
    } catch (error) {
        console.error('Error fetching visitors for client:', error);
        res.status(500).json({ message: 'Failed to fetch visitors for client' });
    }
};

export const getExhibitLogsForClient = async (req, res) => {
    try {
        // Assuming clientId is stored in the token or session
        const clientId = req.user.clientId;  // req.user.clientId should be available after token validation

        if (!clientId) {
            return res.status(400).json({ message: 'Client not authenticated' });
        }

        // Fetch logs for the specific client, sorted by timestamp in descending order
        const logs = await exhibitLogModel.find({ clientId: clientId })
            .sort({ dateTime: -1 })
            .exec();

        if (!logs) {
            return res.status(404).json({ message: 'No logs found for this client' });
        }

        res.status(200).json(logs);
    } catch (error) {
        console.error('Error fetching exhibit logs for client:', error);
        res.status(500).json({ message: 'An error occurred while fetching the logs' });
    }
};

export const editClientUser = async (req, res) => {
    const { id } = req.params; // ID of the user to be edited
    const {
        status,
        name,
        email,
        mobile,
        maximumDisplays,
        audio,
        isl,
        languages,
    } = req.body;

    try {
        // Step 1: Update ClientUser details
        const updatedUser = await ClientUser.findOneAndUpdate(
            { clientId: id },
            {
                status,
                email,
                mobile,
                modifiedAt: Date.now(),
            },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        const clientId = updatedUser.clientId;

        // Step 2: Update ClientMaster details if associated
        const updatedClient = await ClientMaster.findByIdAndUpdate(
            clientId,
            {
                ...(name && { name }),
                ...(maximumDisplays !== undefined && { maximumDisplays }),
                ...(audio !== undefined && { audio }),
                ...(isl !== undefined && { isl }),
                modifiedAt: Date.now(),
            },
            { new: true }
        );

        // Step 3: Update ClientLanguage details
        let updatedLanguages = null;
        updatedLanguages = await ClientLanguage.findOneAndUpdate(
            { clientId },
            {
                ...(Object.entries(languages || {}).reduce((acc, [key, value]) => {
                    acc[key] = value; // Assign the value (0 or 1) for each language
                    return acc;
                }, {})),
            },
            { new: true }
        );

        // Step 4: Update Landing Page with title and description translations
        const landingPage = await Landing.findOne({ clientId });
        if (landingPage) {
            const updatedTranslations = await Object.entries(languages || {}).reduce(async (accPromise, [lang, isActive]) => {
                const acc = await accPromise;
                if (isActive === 1) {
                    // Look for existing translations for the given language
                    const existingTranslation = landingPage.translations.find(t => t.language === lang);
                    
                    const translatedTitle = name
                        ? (lang !== "english" ? await translateText(name, lang) : name)
                        : existingTranslation?.title || ''; // If translation exists, use existing or empty string

                    const translatedDescription = landingPage.description
                        ? (lang !== "english" ? await translateText(landingPage.description, lang) : landingPage.description)
                        : existingTranslation?.description || ''; // Same for description

                    const titleAudio = audio && translatedTitle
                        ? await convertTextToSpeech(translatedTitle, lang)
                        : existingTranslation?.audioUrls?.title || ''; // Use existing audio URL or generate new one

                    const descriptionAudio = audio && translatedDescription
                        ? await convertTextToSpeech(translatedDescription, lang)
                        : existingTranslation?.audioUrls?.description || ''; // Use existing audio URL or generate new one

                    // Add the translation for the current language
                    acc[lang] = {
                        language: lang, // Ensure we preserve the language
                        title: translatedTitle,
                        description: translatedDescription,
                        audioUrls: {
                            title: titleAudio,
                            description: descriptionAudio,
                        },
                    };
                }
                return acc;
            }, Promise.resolve({}));

            // Merge existing translations with new ones
            const newTranslations = landingPage.translations.reduce((acc, translation) => {
                acc[translation.language] = translation;  // Add existing translations to the accumulator
                return acc;
            }, {});

            // Merge the new translations (with updated data) with the old ones
            const mergedTranslations = { ...newTranslations, ...updatedTranslations };

            await Landing.findByIdAndUpdate(landingPage._id, {
                ...(name && { name }),
                ...(languages && { translations: Object.values(mergedTranslations) }), // Update with merged translations
                modifiedAt: Date.now(),
            });
        }



        // Step 5: Update Exhibits with title and description translations
        const exhibits = await Exhibit.find({ clientId });
        if (exhibits.length > 0) {
            await Promise.all(
                exhibits.map(async (exhibit) => {
                    const exhibitTranslations = await Object.entries(languages || {}).reduce(async (accPromise, [lang, isActive]) => {
                        const acc = await accPromise;
                        if (isActive === 1) {
                            // Look for existing translations for the given language
                            const existingTranslation = exhibit.translations.find(t => t.language === lang);

                            const translatedTitle = exhibit.title
                                ? (lang !== "english" ? await translateText(exhibit.title, lang) : exhibit.title)
                                : existingTranslation?.title || ''; // If translation exists, use existing or empty string

                            const translatedDescription = exhibit.description
                                ? (lang !== "english" ? await translateText(exhibit.description, lang) : exhibit.description)
                                : existingTranslation?.description || ''; // Same for description

                            const titleAudio = audio && translatedTitle
                                ? await convertTextToSpeech(translatedTitle, lang)
                                : existingTranslation?.audioUrls?.title || ''; // Use existing audio URL or generate new one

                            const descriptionAudio = audio && translatedDescription
                                ? await convertTextToSpeech(translatedDescription, lang)
                                : existingTranslation?.audioUrls?.description || ''; // Use existing audio URL or generate new one

                            // Add the translation for the current language
                            acc.push({
                                language: lang, // Ensure we preserve the language
                                title: translatedTitle,
                                description: translatedDescription,
                                audioUrls: {
                                    title: titleAudio,
                                    description: descriptionAudio,
                                },
                            });
                        }
                        return acc;
                    }, Promise.resolve([]));

                    // Merge existing translations with new ones
                    const newTranslations = exhibit.translations.reduce((acc, translation) => {
                        acc[translation.language] = translation;  // Add existing translations to the accumulator
                        return acc;
                    }, {});

                    // Merge the new translations (with updated data) with the old ones
                    const mergedTranslations = [...Object.values(newTranslations), ...exhibitTranslations];

                    await Exhibit.findByIdAndUpdate(exhibit._id, {
                        ...(isl !== undefined && { isl }),
                        ...(audio !== undefined && { audio }),
                        translations: mergedTranslations, // Update with merged translations
                        modifiedAt: Date.now(),
                    });
                })
            );
        }



        res.status(200).json({
            message: "User updated successfully, including landing pages and exhibits.",
            updatedUser,
            updatedClient,
            updatedLanguages,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getClientDetails = async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await ClientMaster.findById(clientId);
    const user = await ClientUser.findOne({ clientId });
    const langs = await ClientLanguage.findOne({ clientId });

    if (!client || !user || !langs) {
      return res.status(404).json({ message: 'Client or associated data not found' });
    }

    // Map the language data to return the languages with a value of 1 (enabled)
    const languages = {
      english: langs.english,
      hindi: langs.hindi,
      odia: langs.odia,
      bengali: langs.bengali,
      telugu: langs.telugu,
      tamil: langs.tamil,
      malayalam: langs.malayalam,
      kannada: langs.kannada,
      marathi: langs.marathi,
      gujarati: langs.gujarati,
      marwadi: langs.marwadi,
      punjabi: langs.punjabi,
      assamese: langs.assamese,
      urdu: langs.urdu,
      sanskrit: langs.sanskrit,
      spanish: langs.spanish,
      french: langs.french,
      german: langs.german,
      mandarin: langs.mandarin,
      japanese: langs.japanese,
      arabic: langs.arabic,
      russian: langs.russian,
      portuguese: langs.portuguese,
      italian: langs.italian,
      korean: langs.korean,
      thai: langs.thai,
    };

    // Send the filtered client details and languages as a response
    res.status(200).json({
      status: client.status,
      name: client.name,
      email: user.email,
      mobile: user.mobile,
      maximumDisplays: client.maximumDisplays,
      audio: client.audio,
      isl: client.isl,
      languages: languages, // Send the language data
    });
  } catch (error) {
    console.error('Error fetching client details:', error);
    res.status(500).json({ message: 'Server error' });
  }
};