// utils/generateQRCode.js
import QRCode from 'qrcode';

export const generateQRCode = (data) => {
  if (!data) {
    throw new Error('QR data is required');
  }
  return QRCode.toDataURL(data);  // Returns the QR code as a Data URL
};
