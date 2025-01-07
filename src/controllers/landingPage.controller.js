// controllers/landingPage.controller.js
import LandingPage from "../models/landingPage.model.js";
import ClientLanguage from '../models/clientLanguage.model.js';
import ClientMaster from '../models/clientMaster.model.js';
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { translateText, convertTextToSpeech } from "../utils/googleApiUtils.js";
import QRCode from 'qrcode';
import RedirectMapping from "../models/redirectMapping.model.js";

export const setupLandingPage = async (req, res) => {
    try {
        const { title, description } = req.body;
        const clientId = req.user.clientId;
        const displayImage = req.file ? req.file.path : null;

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

        const uploadResult = await uploadOnCloudinary(displayImage);
        if (!uploadResult || !uploadResult.secure_url) {
            return res.status(500).json({ message: 'Display image upload failed.' });
        }
        const displayImageUrl = uploadResult.secure_url;

        const qrURL = `${process.env.PROXY_URL}/${client.link}`;
        const qrCodeDataURL = await QRCode.toDataURL(qrURL);

        const uniqueUrl = `${process.env.PWA_URL}/${client.link}`
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

    try {
        // Fetch the client using the unique link
        const client = await ClientMaster.findOne({ link:id });
        if (!client) {
            return res.status(404).json({ message: 'Client not found with the provided link.' });
        }
        
        // Fetch the landing page data linked to the client using uniqueUrl
        const landingPage = await LandingPage.findOne({ uniqueUrl: id });
        if (!landingPage) {
            return res.status(404).json({ message: 'Landing page not found.' });
        }

        // Return the landing page details
        res.status(200).json({
            title: landingPage.title,
            description: landingPage.description,
            displayImage: landingPage.displayImage,
            translations: landingPage.translations,
        });
    } catch (error) {
        console.error('Error fetching landing page:', error);
        res.status(500).json({ message: 'Failed to fetch landing page.' });
    }
};

export const editLandingPage = async (req, res) => {
    const { title, description, translations } = req.body;
    const { clientId } = req.user; // Assuming clientId is stored in the token

    try {
        // Fetch the landing page for the client
        const landingPage = await LandingPage.findOne({ clientId });
        if (!landingPage) {
            return res.status(404).json({ message: "Landing page not found." });
        }

        // Handle image update if a new file is uploaded
        let displayImage = landingPage.displayImage;
        if (req.file?.path) {
            const uploadResult = await uploadOnCloudinary(req.file.path);
            if (!uploadResult) {
                return res.status(500).json({ message: "Image upload failed." });
            }
            displayImage = uploadResult.secure_url;
        }

        // Fetch client languages
        const clientLanguages = await ClientLanguage.findOne({ clientId });
        if (!clientLanguages) {
            return res.status(404).json({ message: "Languages for the client not found." });
        }

        const activeLanguages = Object.keys(clientLanguages._doc).filter(
            key => clientLanguages[key] === 1 && key !== '_id' && key !== 'clientId'
        );

        // Process translations
        const updatedTranslations = await Promise.all(
            activeLanguages.map(async (language) => {
                const existingTranslation = landingPage.translations.find(t => t.language === language);

                // Check if a specific translation update is provided
                const translationUpdate = translations?.[language];

                // Use provided translations or default to existing values
                const translatedTitle = translationUpdate?.title || existingTranslation?.title || title;
                const translatedDescription = translationUpdate?.description || existingTranslation?.description || description;

                // Generate new audio files only for updated fields
                const titleAudio = translationUpdate?.title
                    ? await convertTextToSpeech(translationUpdate.title, language)
                    : existingTranslation?.audioUrls?.title;

                const descriptionAudio = translationUpdate?.description
                    ? await convertTextToSpeech(translationUpdate.description, language)
                    : existingTranslation?.audioUrls?.description;

                return {
                    language,
                    title: translatedTitle,
                    description: translatedDescription,
                    audioUrls: {
                        title: titleAudio,
                        description: descriptionAudio,
                    },
                };
            })
        );

        // Update the landing page
        landingPage.title = title || landingPage.title;
        landingPage.description = description || landingPage.description;
        landingPage.displayImage = displayImage;
        landingPage.translations = updatedTranslations;

        await landingPage.save();

        res.status(200).json({ message: "Landing page updated successfully.", landingPage });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update landing page.", error });
    }
};