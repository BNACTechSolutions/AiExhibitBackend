// controllers/landingPage.controller.js
import LandingPage from "../models/landingPage.model.js";
import ClientLanguage from '../models/clientLanguage.model.js';
import clientUserModel from "../models/clientUser.model.js";
import ClientMaster from '../models/clientMaster.model.js';
import Advertisement from "../models/advertisment.model.js";
import ExhibitLog  from "../models/exhibitLog.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { translateText, convertTextToSpeech } from "../utils/googleApiUtils.js";
import QRCode from 'qrcode';
import RedirectMapping from "../models/redirectMapping.model.js";

export const setupLandingPage = async (req, res) => {
    try {
        const { title, description } = req.body;
        const clientId = req.user.clientId;
        const displayImage = req.files?.displayImage?.[0]?.path || null;
        const islVideo = req.files?.islVideo?.[0]?.path || null;

        if (!clientId) {
            return res.status(400).json({ message: 'Client ID is required.' });
        }

        const client = await ClientMaster.findById(clientId);
        if (!client) {
            return res.status(404).json({ message: 'Client not found.' });
        }

        if (!displayImage) {
            return res.status(400).json({ message: 'Display image is required.' });
        }

        // Upload the display image to Cloudinary
        const uploadResult = await uploadOnCloudinary(displayImage);
        if (!uploadResult || !uploadResult.secure_url) {
            return res.status(500).json({ message: 'Display image upload failed.'});
        }
        const displayImageUrl = uploadResult.secure_url;

        // Upload the ISL video to Cloudinary if provided (optional)
        let islVideoUrl = null;
        if (req.files?.islVideo) {
            const islVideo = req.files.islVideo[0].path; // Get the path of the ISL video
            // Upload ISL video to Cloudinary if provided
            const videoUploadResult = await uploadOnCloudinary(islVideo);
            if (!videoUploadResult || !videoUploadResult.secure_url) {
                return res.status(500).json({ message: 'ISL video upload failed.' });
            }
            islVideoUrl = videoUploadResult.secure_url;
        }

        const qrURL = `${process.env.PROXY_URL}/${client.link}`;
        const qrCodeDataURL = await QRCode.toDataURL(qrURL);

        const uniqueUrl = `${process.env.PWA_URL}/${client.link}`;
        if (!qrCodeDataURL) {
            return res.status(500).json({ message: 'QR code generation failed.' });
        }

        const translations = [];
        const languages = await ClientLanguage.findOne({ clientId });

        if (!languages) {
            return res.status(404).json({ message: 'Languages for the client not found.' });
        }

        for (const [language, isActive] of Object.entries(languages._doc)) {
            if (isActive === 1 && language !== 'clientId') {
                let translatedTitle = title;
                let translatedDescription = description;
                let titleAudioPath = '';
                let descriptionAudioPath = '';

                try {
                    translatedTitle = await translateText(title, language) || title;
                    translatedDescription = await translateText(description, language) || description;
                    titleAudioPath = await convertTextToSpeech(translatedTitle, language);
                    descriptionAudioPath = await convertTextToSpeech(translatedDescription, language);
                } catch (error) {
                    console.error(`Error generating translations for ${language}:`, error);
                }

                translations.push({
                    language,
                    title: translatedTitle,
                    description: translatedDescription,
                    audioUrls: {
                        title: titleAudioPath,
                        description: descriptionAudioPath,
                    },
                });
            }
        }

        const landingPage = new LandingPage({
            clientId,
            displayImage: displayImageUrl,
            title,
            description,
            uniqueUrl: client.link,
            qrCode: qrCodeDataURL,
            islVideo: islVideoUrl,  // Store the ISL video URL if it's available (optional)
            translations,
        });

        await landingPage.save();

        const mapping = new RedirectMapping({
            clientId,
            shortUrl: client.link,
            redirectUrl: uniqueUrl,
        });
        await mapping.save();

        res.status(200).json({
            message: 'Landing page setup successfully.',
            landingPage,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to setup landing page.', error });
    }
};

export const getLandingPage = async (req, res) => {
    const { id } = req.params;  // This comes from the QR code (e.g., /qr-redirect/{uniqueLink})
    const userAgent = req.headers['user-agent'];
    const ip = req.ip;
    const userMobile = req.query.mobile || 'Unknown';

    try {
        // Fetch the client using the unique link
        const client = await ClientMaster.findOne({ link: id });
        if (!client) {
            return res.status(404).json({ message: 'Client not found with the provided link.' });
        }

        const clientUser = await clientUserModel.findOne({ clientId: client._id});
        if(clientUser.status === 0){
            return res.status(404).json({ message: 'Client is not active!' });
        }

        // Fetch the landing page data linked to the client using uniqueUrl
        const landingPage = await LandingPage.findOne({ uniqueUrl: id });
        if (!landingPage) {
            return res.status(404).json({ message: 'Landing page not found.' });
        }

        // Check if any advertisement image should be shown for this client
        const advertisement = await Advertisement.findById(client.advertisements[0]);

        // Prepare advertisement image if available
        let advertisementImage = null;
        if(advertisement.active){
            advertisementImage = advertisement.adImage;
        }

        // Detect device type from the User-Agent string
        let deviceType = 'Desktop';  // Default
        if (userAgent.includes('Mobile')) {
            deviceType = 'Mobile';
        } else if (userAgent.includes('Tablet')) {
            deviceType = 'Tablet';
        }

        // Log the interaction with the landing page
        const logData = new ExhibitLog({
            serialNumber: Date.now(),  // Generate unique serial number
            clientName: client.name,
            exhibitCode: id,  // Using the unique URL as the equivalent of exhibit code
            dateTime: new Date(),
            userMobile: userMobile,  // User's mobile number (from query params or fallback)
            deviceType: deviceType,  // Detected device type
            ipAddress: ip,  // User's IP address
            advertisementId: advertisement ? advertisement.adName : null,  // Advertisement ID if available
            clientId: client._id,
        });

        // Save the log entry asynchronously without blocking response
        logData.save().catch((logError) => {
            console.error('Failed to save log entry:', logError);
        });

        // Return the landing page details along with the advertisement image if it exists
        res.status(200).json({
            title: landingPage.title,
            description: landingPage.description,
            displayImage: landingPage.displayImage,  // Client's landing page display image
            translations: landingPage.translations,
            advertisementImage,  // Add the advertisement image if available
            islVideo: landingPage.islVideo,  // Include ISL video URL if available
        });
    } catch (error) {
        console.error('Error fetching landing page:', error);
        res.status(500).json({ message: 'Failed to fetch landing page.' });
    }
};

export const editLandingPage = async (req, res) => {
    const { clientId } = req.user;

    try {
        // Fetch the landing to be updated
        const landing = await LandingPage.findOne({ clientId });
        if (!landing) {
            return res.status(404).json({ message: "Landing not found." });
        }

        // Handle updates from the request body
        const { title, description, translations } = req.body;
        const updatedFields = {};

        // Handle title and description updates
        if (title) updatedFields.title = title;
        if (description) updatedFields.description = description;

        // Handle title image update
        if (req.files?.titleImage && req.files.titleImage.length > 0) {
            const titleImagePath = req.files.titleImage[0].path;
            const uploadResult = await uploadOnCloudinary(titleImagePath);

            if (!uploadResult) {
                return res.status(500).json({ message: "Title image upload failed." });
            }

            updatedFields.titleImage = uploadResult.secure_url;
        }

        // Handle ISL video update (optional)
        if (req.files?.islVideo && req.files.islVideo.length > 0) {
            const islVideoPath = req.files.islVideo[0].path;
            const islVideoResult = await uploadOnCloudinary(islVideoPath);

            if (!islVideoResult) {
                return res.status(500).json({ message: "ISL video upload failed." });
            }

            updatedFields.islVideo = islVideoResult.secure_url;
        }

        // Parse translations JSON if provided in form-data
        let parsedTranslations = null;
        if (translations) {
            try {
                parsedTranslations = JSON.parse(translations); // Convert the translations from JSON string to an object
            } catch (error) {
                return res.status(400).json({ message: "Invalid translations JSON format." });
            }
        }

        // Process translations update
        if (parsedTranslations) {
            const existingTranslations = landing.translations || [];
            const updatedTranslations = await Promise.all(
                Object.entries(parsedTranslations).map(async ([language, { title, description }]) => {
                    const existingTranslation = existingTranslations.find(t => t.language === language) || {};
                    const newTitle = title || existingTranslation.title;
                    const newDescription = description || existingTranslation.description;

                    const titleAudio = title
                        ? await convertTextToSpeech(title, language)
                        : existingTranslation.audioUrls?.title;

                    const descriptionAudio = description
                        ? await convertTextToSpeech(description, language)
                        : existingTranslation.audioUrls?.description;

                    return {
                        language,
                        title: newTitle,
                        description: newDescription,
                        audioUrls: {
                            title: titleAudio,
                            description: descriptionAudio,
                        },
                    };
                })
            );

            updatedFields.translations = [
                ...existingTranslations.filter(t => !parsedTranslations[t.language]),
                ...updatedTranslations,
            ];
        }

        // Handle automatic translations for title and description if they are updated
        if (title || description) {
            const clientLanguages = await ClientLanguage.findOne({ clientId: landing.clientId });
            if (!clientLanguages) {
                return res.status(404).json({ message: "No languages found for the client." });
            }

            const activeLanguages = Object.keys(clientLanguages._doc).filter(
                key => clientLanguages[key] === 1 && key !== '_id' && key !== 'clientId'
            );

            const autoTranslations = await Promise.all(
                activeLanguages.map(async (lang) => {
                    console.log(parsedTranslations);
                    if (parsedTranslations && parsedTranslations[lang]) {
                        return null; // Skip auto-translation for manually updated languages
                    }

                    const translatedTitle = title
                        ? (lang !== "english" ? await translateText(title, lang) : title)
                        : landing.translations.find(t => t.language === lang)?.title;

                    const translatedDescription = description
                        ? (lang !== "english" ? await translateText(description, lang) : description)
                        : landing.translations.find(t => t.language === lang)?.description;

                    const titleAudio = translatedTitle
                        ? await convertTextToSpeech(translatedTitle, lang)
                        : landing.translations.find(t => t.language === lang)?.audioUrls?.title;

                    const descriptionAudio = translatedDescription
                        ? await convertTextToSpeech(translatedDescription, lang)
                        : landing.translations.find(t => t.language === lang)?.audioUrls?.description;

                    return {
                        language: lang,
                        title: translatedTitle,
                        description: translatedDescription,
                        audioUrls: {
                            title: titleAudio,
                            description: descriptionAudio,
                        },
                    };
                })
            );

            updatedFields.translations = [
                ...(updatedFields.translations || []),
                ...autoTranslations.filter(t => t), // Remove null values
            ];
        }

        // Apply updates to the landing
        const updatedLanding = await LandingPage.findOneAndUpdate(
            { clientId },
            { $set: updatedFields },
            { new: true }
        );

        res.status(200).json({ message: "Landing updated successfully.", landing: updatedLanding });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};