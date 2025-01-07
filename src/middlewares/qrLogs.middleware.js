// middleware/qrScanTracker.js
import QRScan from '../models/qrScan.model.js';
import RedirectMapping from '../models/redirectMapping.model.js';
import ClientMaster from '../models/clientMaster.model.js';

export const trackQRScan = async (req, res, next) => {
  try {
    const shortUrl = req.params.shortUrl;
    const clientId = req.user?.clientId || null; // Assuming `clientId` is attached to the user from authentication
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const deviceType = req.headers['user-agent']; // Capture user agent for device type

    // Get the redirect URL based on short URL
    const redirectMapping = await RedirectMapping.findOne({ shortUrl });

    if (!redirectMapping) {
      return res.status(404).json({ message: 'QR not found.' });
    }

    // Log the QR scan activity
    const qrScan = new QRScan({
      clientId: redirectMapping.clientId, // Use clientId from RedirectMapping
      shortUrl: shortUrl,
      ipAddress: ipAddress,
      deviceType: deviceType,
      scanTimestamp: new Date(),
      redirectMappingId: redirectMapping._id
    });

    await qrScan.save(); // Save the scan data into the QRScan collection

    next(); // Proceed with redirecting to the target URL
  } catch (error) {
    console.error('Error tracking QR scan:', error);
    res.status(500).json({ message: 'Error tracking QR scan.' });
  }
};
