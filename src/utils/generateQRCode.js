// utils/generateQRCode.js
import QRCode from 'qrcode';

export const generateQRCode = (uniqueId) => {
  const qrData = `http://yourdomain.com/qr/${uniqueId}`;
  return QRCode.toDataURL(qrData);  // Returns the QR code as a Data URL
};
