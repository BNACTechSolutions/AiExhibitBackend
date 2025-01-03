import axios from 'axios';
import ISO6391 from 'iso-639-1'; // Import the library
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import path from 'path';
import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { uploadOnCloudinary } from './cloudinary.js';

// Ensure you have the correct API key in the .env file
const GOOGLE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;  // Use your API key from environment variables

// Translate text using Google Translate API
const translateText = async (text, targetLanguage) => {
    try {
        // Get the ISO 639-1 code for the target language
        const targetLanguageCode = ISO6391.getCode(targetLanguage.toLowerCase());

        if (!targetLanguageCode) {
            throw new Error('Unsupported target language');
        }

        // Endpoint for Google Translate API
        const endpoint = 'https://translation.googleapis.com/language/translate/v2';

        // Set up the parameters for the request
        const params = new URLSearchParams();
        params.append('q', text);  // The text to be translated
        params.append('target', targetLanguageCode);  // Target language code
        params.append('source', 'en');  // Source language (assuming English)
        params.append('format', 'text');  // Format of the text
        params.append('model', 'nmt');  // Using Neural Machine Translation model
        params.append('key', GOOGLE_API_KEY);  // API key (should be securely stored in .env)

        // Make the API call to Google Translate
        const response = await axios.post(endpoint, params);

        // Return the translated text
        return response.data.data.translations[0].translatedText;
    } catch (error) {
        // console.error(`Error at translateText --> ${error.response ? error.response.data : error.message}`);
        return null; // Return null in case of an error
    }
};

process.env.GOOGLE_APPLICATION_CREDENTIALS = './ai-exhibit-ed49a8ead891.json';

/**
 * Converts text to speech and uploads the generated audio to Cloudinary.
 * @param {string} text - Text to convert to speech.
 * @param {string} languageCode - Language code for the audio generation.
 * @returns {Promise<string>} - URL of the uploaded audio file.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));

const convertTextToSpeech = async (text, targetLanguage) => {
    const languageCode = ISO6391.getCode(targetLanguage.toLowerCase());

    if (!languageCode) {
        throw new Error('Unsupported target language');
    }

    const client = new TextToSpeechClient();
    const tempDir = path.join(__dirname, '..', 'temp');
    const outputFile = path.join(tempDir, `${Date.now()}-${languageCode}.mp3`);

    try {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const request = {
            input: { text },
            voice: { languageCode, ssmlGender: 'NEUTRAL' },
            audioConfig: { audioEncoding: 'MP3' },
        };

        const [response] = await client.synthesizeSpeech(request);
        fs.writeFileSync(outputFile, response.audioContent, 'binary');

        const uploadResult = await uploadOnCloudinary(outputFile);
        if (fs.existsSync(outputFile)) {
            fs.unlinkSync(outputFile);
        }

        if (uploadResult && uploadResult.secure_url) {
            return uploadResult.secure_url;
        }

        throw new Error('Audio upload failed');
    } catch (error) {

        if (fs.existsSync(outputFile)) {
            fs.unlinkSync(outputFile);
        }

        throw error;
    }
};

export { translateText, convertTextToSpeech };
