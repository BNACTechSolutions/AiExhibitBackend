import axios from 'axios';
import ISO6391 from 'iso-639-1';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import path from 'path';
import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { uploadOnCloudinary } from './cloudinary.js';
import fetch from 'node-fetch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(__dirname, '..', 'temp');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}


// Load environment variables
const GOOGLE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
process.env.GOOGLE_APPLICATION_CREDENTIALS = './ai-exhibit-ed49a8ead891.json'; // Set Google TTS credentials

// Custom mappings for some uncommon language names
const languageCodeMap = {
  'punjabi': 'pa',
  'marwadi': 'hi', // fallback to Hindi
  'odia': 'or',
  'bengali': 'bn',
};

const googleSupportedLanguages = new Set([
  'hindi', 'bengali', 'gujarati', 'kannada',
  'malayalam', 'tamil', 'telugu', 'english',
]);

const sarvamSupportedLanguages = {
  bengali: 'bn-IN',
  english: 'en-IN',
  gujarati: 'gu-IN',
  hindi: 'hi-IN',
  kannada: 'kn-IN',
  malayalam: 'ml-IN',
  marathi: 'mr-IN',
  odia: 'od-IN',
  punjabi: 'pa-IN',
  tamil: 'ta-IN',
  telugu: 'te-IN'
};

const getTTSServiceAndCode = (languageName) => {
  const normalized = languageName.toLowerCase().trim();

  if (googleSupportedLanguages.has(normalized)) {
    const code = ISO6391.getCode(normalized);
    return { service: 'google', code: code || 'en' };
  }

  if (sarvamSupportedLanguages[normalized]) {
    return { service: 'sarvam', code: sarvamSupportedLanguages[normalized] };
  }

  throw new Error(`Unsupported or unknown language: ${languageName}`);
};


const translateText = async (text, targetLanguage) => {
  try {
    const targetLanguageCode = languageCodeMap[targetLanguage.toLowerCase()] || ISO6391.getCode(targetLanguage.toLowerCase());
    if (!targetLanguageCode) throw new Error('Unsupported target language');

    const endpoint = 'https://translation.googleapis.com/language/translate/v2';
    const params = new URLSearchParams({
      q: text,
      target: targetLanguageCode,
      source: 'en',
      format: 'text',
      model: 'nmt',
      key: GOOGLE_API_KEY,
    });

    const response = await axios.post(endpoint, params);
    return response.data.data.translations[0].translatedText;
  } catch (error) {
    return null;
  }
};

const convertTextToSpeech = async (text, targetLanguage) => {
  const { service, code } = getTTSServiceAndCode(targetLanguage);
  const fileName = `${Date.now()}-${code}.mp3`;
  const outputFile = path.join(tempDir, fileName);

  try {
    if (service === 'google') {
      const client = new TextToSpeechClient();
      const request = {
        input: { text },
        voice: { languageCode: code, ssmlGender: 'NEUTRAL' },
        audioConfig: { audioEncoding: 'MP3' },
      };

      const [response] = await client.synthesizeSpeech(request);
      fs.writeFileSync(outputFile, response.audioContent, 'binary');
    } else if (service === 'sarvam') {
      const response = await fetch("https://api.sarvam.ai/text-to-speech", {
        method: "POST",
        headers: {
          "api-subscription-key": SARVAM_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text,
          target_language_code: code
        })
      });

      const data = await response.json();

    if (!response.ok || !data.audios || !data.audios.length) {
        console.error('Sarvam API response:', data);
        throw new Error(`Sarvam API Error: ${data.error?.message || 'Unknown error'}`);
    }

    fs.writeFileSync(outputFile, Buffer.from(data.audios[0], 'base64'));

    }

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
    console.error(`Error processing language: ${targetLanguage}`, error);
    throw error;
  }
};

export { translateText, convertTextToSpeech };