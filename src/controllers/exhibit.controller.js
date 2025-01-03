import Exhibit from "../models/exhibit.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";  // Assuming Cloudinary for image upload
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

        const clientLanguages = await ClientLanguage.findOne({ clientId });
        if (!clientLanguages) {
            return res.status(404).json({ message: "No languages found for the client." });
        }

        const activeLanguages = Object.keys(clientLanguages._doc).filter(
            key => clientLanguages[key] === 1 && key !== '_id' && key !== 'clientId'
        );

        const translations = await Promise.all(
            activeLanguages.map(async (lang) => {
                // Perform translation or fallback to original text
                const translatedTitle = lang !== "english" ? await translateText(title, lang) : title;
                const translatedDescription = lang !== "english" ? await translateText(description, lang) : description;
        
                // Ensure inputs are valid for text-to-speech
                const titleAudio = translatedTitle
                    ? await convertTextToSpeech(translatedTitle, lang)
                    : null;
                const descriptionAudio = translatedDescription
                    ? await convertTextToSpeech(translatedDescription, lang)
                    : null;
        
                return {
                    language: lang,
                    title: translatedTitle || title, // Fallback to original text
                    description: translatedDescription || description, // Fallback to original text
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
        });

        await exhibit.save();
        res.status(201).json({ message: "Exhibit added successfully.", exhibit });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Controller to fetch exhibit by code
export const getExhibit = async (req, res) => {
    const { code } = req.params;

    try {
        const exhibit = await Exhibit.findOne({ code });
        if (!exhibit) {
            return res.status(404).json({ message: "Exhibit not found." });
        }

        res.status(200).json({ exhibit });
    } catch (error) {
        res.status(500).json({ message: error.message });
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
        const { title, description } = req.body;
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

        // Handle translations and audio generation if title or description is updated
        if (title || description) {
            const clientLanguages = await ClientLanguage.findOne({ clientId: exhibit.clientId });
            if (!clientLanguages) {
                return res.status(404).json({ message: "No languages found for the client." });
            }

            const activeLanguages = Object.keys(clientLanguages._doc).filter(
                key => clientLanguages[key] === 1 && key !== '_id' && key !== 'clientId'
            );

            const translations = await Promise.all(
                activeLanguages.map(async (lang) => {
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
                        title: translatedTitle || title,
                        description: translatedDescription || description,
                        audioUrls: {
                            title: titleAudio,
                            description: descriptionAudio,
                        },
                    };
                })
            );

            updatedFields.translations = translations;
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