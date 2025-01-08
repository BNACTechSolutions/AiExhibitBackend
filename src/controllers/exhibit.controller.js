import Exhibit from "../models/exhibit.model.js";
import ExhibitLog from '../models/exhibitLog.model.js';
import clientMasterModel from '../models/clientMaster.model.js';
import advertisementModel from '../models/advertisment.model.js';
import LandingPage from '../models/landingPage.model.js';
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import ClientLanguage from "../models/clientLanguage.model.js";
import { convertTextToSpeech, translateText } from "../utils/googleApiUtils.js";

const generateCode = () => Math.random().toString(36).substr(2, 6).toUpperCase();

export const addExhibit = async (req, res) => {
    const { title, description } = req.body;
    const { clientId } = req.user;

    try {
        if (!clientId) {
            return res.status(403).json({ message: "Unauthorized: Client ID is missing." });
        }

        // Handle title image
        const titleImagePath = req.files?.titleImage ? req.files.titleImage[0].path : null;
        const images = req.files?.images ? req.files.images.map(file => file.path) : [];
        const islVideoPath = req.files?.islVideo ? req.files.islVideo[0].path : null;  // Optional ISL video

        if (!titleImagePath) {
            return res.status(400).json({ message: "Title image is required." });
        }

        const uploadResult = await uploadOnCloudinary(titleImagePath);
        if (!uploadResult) {
            return res.status(500).json({ message: "Title image upload failed." });
        }

        const cloudinaryImages = await Promise.all(
            images.map(imagePath => uploadOnCloudinary(imagePath))
        );

        const titleImageUrl = uploadResult.secure_url;
        const imageUrls = cloudinaryImages.map(result => result.secure_url);

        let islVideoUrl = null;
        if (islVideoPath) {
            const islVideoResult = await uploadOnCloudinary(islVideoPath);
            if (!islVideoResult) {
                return res.status(500).json({ message: "ISL video upload failed." });
            }
            islVideoUrl = islVideoResult.secure_url;  // ISL video URL
        }

        const clientLanguages = await ClientLanguage.findOne({ clientId });
        if (!clientLanguages) {
            return res.status(404).json({ message: "No languages found for the client." });
        }

        const activeLanguages = Object.keys(clientLanguages._doc).filter(
            key => clientLanguages[key] === 1 && key !== '_id' && key !== 'clientId'
        );

        const translations = await Promise.all(
            activeLanguages.map(async (lang) => {
                const translatedTitle = lang !== "english" ? await translateText(title, lang) : title;
                const translatedDescription = lang !== "english" ? await translateText(description, lang) : description;
        
                const titleAudio = translatedTitle
                    ? await convertTextToSpeech(translatedTitle, lang)
                    : null;
                const descriptionAudio = translatedDescription
                    ? await convertTextToSpeech(translatedDescription, lang)
                    : null;
        
                return {
                    language: lang,
                    title: translatedTitle || title,
                    description: translatedDescription || description,
                    audioUrls: {
                        title: titleAudio,
                        description: descriptionAudio,
                    },
                };
            })
        );

        const exhibit = new Exhibit({
            titleImage: titleImageUrl,
            title,
            description,
            code: generateCode(),
            images: imageUrls,
            clientId,
            translations,
            islVideo: islVideoUrl,  // Save ISL video URL
        });

        await exhibit.save();
        res.status(201).json({ message: "Exhibit added successfully.", exhibit });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getExhibit = async (req, res) => {
    const { code } = req.params;
    const userAgent = req.headers['user-agent'];
    const ip = req.ip;
    const userMobile = req.body.mobile || req.query.mobile || 'Unknown';
  
    try {
      // 1. Get the Exhibit by Code
      const exhibit = await Exhibit.findOne({ code });
      if (!exhibit) {
        return res.status(404).json({ message: 'Exhibit not found.' });
      }
  
      // 2. Get the Client (owner of the landing page and exhibit)
      const client = await clientMasterModel.findOne({ _id: exhibit.clientId });
      if (!client) {
        return res.status(404).json({ message: 'Client not found.' });
      }
  
      // 3. Get the Landing Page associated with the client (URL)
      const landingPage = await LandingPage.findOne({
        clientId: client._id,
        uniqueUrl: req.originalUrl,
      });
  
      // 4. Get the Advertisement related to the Exhibit or Client
      const advertisement = await advertisementModel.findOne({
        'advertisements.exhibitCode': code,
      });
  
      // 5. Detect Device Type from User-Agent string
      let deviceType = 'Desktop';  // Default
      if (userAgent.includes('Mobile')) {
        deviceType = 'Mobile';
      } else if (userAgent.includes('Tablet')) {
        deviceType = 'Tablet';
      }
  
      // 6. Log the interaction
      const logData = new ExhibitLog({
        serialNumber: Date.now(),  // Generate unique serial number
        clientName: client.name,
        exhibitCode: code,
        dateTime: new Date(),
        userMobile: userMobile,  // User's mobile number
        deviceType: deviceType,  // Device type
        ipAddress: ip,  // User's IP address
        advertisementId: advertisement ? advertisement._id : null,  // Advertisement ID
        landingPageId: landingPage ? landingPage._id : null,  // Landing Page ID
      });
  
      // Save the log entry
      await logData.save();
  
      // Return the exhibit details
      res.status(200).json({
        exhibit: {
          ...exhibit.toObject(),
          islVideo: exhibit.islVideo || null,  // Return ISL video URL if available
        },
      });
    } catch (error) {
      console.error('Error fetching exhibit:', error);
      res.status(500).json({ message: 'Error fetching exhibit' });
    }
  };
  


// Controller to delete an exhibit by code
export const deleteExhibit = async (req, res) => {
    const { code } = req.params;

    try {
        const exhibit = await Exhibit.findOneAndDelete({ code });

        if (!exhibit) {
            return res.status(404).json({ message: "Exhibit not found." });
        }

        res.status(200).json({ message: "Exhibit deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const editExhibit = async (req, res) => {
    const { code } = req.params;

    try {
        // Fetch the exhibit to be updated
        const exhibit = await Exhibit.findOne({ code });
        if (!exhibit) {
            return res.status(404).json({ message: "Exhibit not found." });
        }

        // Handle updates from the request body
        const { title, description, translations } = req.body;
        const updatedFields = {};

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

        // Handle multiple images update
        if (req.files?.images && req.files.images.length > 0) {
            const images = req.files.images.map(file => file.path);
            const cloudinaryImages = await Promise.all(
                images.map(imagePath => uploadOnCloudinary(imagePath))
            );

            const imageUrls = cloudinaryImages.map(result => result.secure_url);
            updatedFields.images = imageUrls;
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

        // Process translations
        if (translations) {
            const existingTranslations = exhibit.translations || [];
            const updatedTranslations = await Promise.all(
                Object.entries(translations).map(async ([language, { title, description }]) => {
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
                ...existingTranslations.filter(t => !translations[t.language]),
                ...updatedTranslations,
            ];
        }

        // Handle automatic translations for title and description if they are updated
        if (title || description) {
            const clientLanguages = await ClientLanguage.findOne({ clientId: exhibit.clientId });
            if (!clientLanguages) {
                return res.status(404).json({ message: "No languages found for the client." });
            }

            const activeLanguages = Object.keys(clientLanguages._doc).filter(
                key => clientLanguages[key] === 1 && key !== '_id' && key !== 'clientId'
            );

            const autoTranslations = await Promise.all(
                activeLanguages.map(async (lang) => {
                    if (translations && translations[lang]) {
                        return null; // Skip auto-translation for manually updated languages
                    }

                    const translatedTitle = title
                        ? (lang !== "english" ? await translateText(title, lang) : title)
                        : exhibit.translations.find(t => t.language === lang)?.title;

                    const translatedDescription = description
                        ? (lang !== "english" ? await translateText(description, lang) : description)
                        : exhibit.translations.find(t => t.language === lang)?.description;

                    const titleAudio = translatedTitle
                        ? await convertTextToSpeech(translatedTitle, lang)
                        : exhibit.translations.find(t => t.language === lang)?.audioUrls?.title;

                    const descriptionAudio = translatedDescription
                        ? await convertTextToSpeech(translatedDescription, lang)
                        : exhibit.translations.find(t => t.language === lang)?.audioUrls?.description;

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

        // Apply updates to the exhibit
        const updatedExhibit = await Exhibit.findOneAndUpdate(
            { code },
            { $set: updatedFields },
            { new: true }
        );

        res.status(200).json({ message: "Exhibit updated successfully.", exhibit: updatedExhibit });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getAllExhibits = async (req, res) => {
    const { clientId } = req.user;

    try {
        if (!clientId) {
            return res.status(403).json({ message: "Unauthorized: Client ID is missing." });
        }
        
        const exhibits = await Exhibit.find({ clientId });

        if (exhibits.length === 0) {
            return res.status(404).json({ message: "No exhibits found." });
        }

        res.status(200).json({ exhibits });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};