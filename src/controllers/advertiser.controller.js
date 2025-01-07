import Advertiser from '../models/advertiser.model.js';
import Advertisement from '../models/advertisment.model.js';
import ClientMaster from '../models/clientMaster.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';

// Add Advertiser
export const addAdvertiser = async (req, res) => {
  try {
    const { name, email, mobile } = req.body;

    const advertiser = new Advertiser({ name, email, mobile });
    await advertiser.save();

    res.status(201).json({ message: 'Advertiser added successfully', advertiser });
  } catch (error) {
    console.error('Error adding advertiser:', error);
    res.status(500).json({ message: 'Error adding advertiser' });
  }
};

// Add Advertisement
export const addAdvertisement = async (req, res) => {
  const adImagepath = req.file ? req.file.path : null;
  try {
    const { adName, advertiserId } = req.body;

    // Ensure the advertisement image is uploaded
    if (!adImagepath) {
      return res.status(400).json({ message: 'Display image is required.' });
    }

    // Upload the display image to Cloudinary
    const uploadResult = await uploadOnCloudinary(adImagepath);
    if (!uploadResult || !uploadResult.secure_url) {
      return res.status(500).json({ message: 'Display image upload failed.' });
    }
    const adImage = uploadResult.secure_url;

    // Save the advertisement
    const advertisement = new Advertisement({ adName, adImage, advertiserId });
    await advertisement.save();

    res.status(201).json({ message: 'Advertisement added successfully', advertisement });
  } catch (error) {
    console.error('Error adding advertisement:', error);
    res.status(500).json({ message: 'Error adding advertisement' });
  }
};

// Fetch All Clients and Their Ad Status
export const getClientAds = async (req, res) => {
  try {
    // Fetch all clients with their advertisement data
    const clients = await ClientMaster.find()
      .populate('advertisements', 'adName')  // Populating the advertisement data (adName)
      .lean();

    // Prepare the response with advertisement status
    const clientAds = clients.map((client, index) => ({
      serialNumber: index + 1,
      clientName: client.name,
      hasAdvertisement: client.advertisements.length > 0 ? 'Yes' : 'No',
      advertisement: client.advertisements.length > 0 ? client.advertisements[0].adName : 'N/A',  // Assuming only one advertisement per client
    }));

    res.status(200).json({ clientAds });
  } catch (error) {
    console.error('Error fetching client ads:', error);
    res.status(500).json({ message: 'Error fetching client ads' });
  }
};

export const allocateAdvertisement = async (req, res) => {
  try {
    const { clientId, advertisementId } = req.body;

    const client = await ClientMaster.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (advertisementId) {
      // Check if the advertisement exists only when an advertisement ID is provided
      const advertisement = await Advertisement.findById(advertisementId);
      if (!advertisement) {
        return res.status(404).json({ message: 'Advertisement not found' });
      }

      // Check if the client already has an advertisement
      if (client.advertisements.length > 0) {
        // Replace the existing advertisement with the new one
        client.advertisements[0] = advertisement._id;
      } else {
        // Add the advertisement if none is assigned yet
        client.advertisements.push(advertisement._id);
      }
    } else {
      // If advertisementId is null, remove the advertisement
      client.advertisements = [];
    }

    // Save the updated client document
    await client.save();

    // Re-fetch the client and populate the advertisements field to get advertisement details
    const updatedClient = await ClientMaster.findById(clientId).populate('advertisements');

    res.status(200).json({ message: 'Advertisement allocated successfully', updatedClient });
  } catch (error) {
    console.error('Error allocating advertisement:', error);
    res.status(500).json({ message: 'Error allocating advertisement' });
  }
};

// Fetch all advertisers
export const getAllAdvertisers = async (req, res) => {
  try {
    const advertisers = await Advertiser.find().lean();
    
    if (!advertisers || advertisers.length === 0) {
      return res.status(404).json({ message: 'No advertisers found.' });
    }

    res.status(200).json({ advertisers });
  } catch (error) {
    console.error('Error fetching advertisers:', error);
    res.status(500).json({ message: 'Error fetching advertisers' });
  }
};

// Fetch all advertisements
export const getAllAdvertisements = async (req, res) => {
  try {
    const advertisements = await Advertisement.find().populate('advertiserId', 'name').lean();

    if (!advertisements || advertisements.length === 0) {
      return res.status(404).json({ message: 'No advertisements found.' });
    }

    res.status(200).json({ advertisements });
  } catch (error) {
    console.error('Error fetching advertisements:', error);
    res.status(500).json({ message: 'Error fetching advertisements' });
  }
};