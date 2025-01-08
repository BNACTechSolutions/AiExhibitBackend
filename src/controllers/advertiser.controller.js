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
    const clientAds = clients.map((client, index) => {
      // Ensure advertisements is always an array
      const advertisements = client.advertisements || [];

      return {
        serialNumber: index + 1,
        clientName: client.name,
        hasAdvertisement: advertisements.length > 0 ? 'Yes' : 'No',
        advertisement: advertisements.length > 0 ? advertisements[0].adName : 'N/A', // Assuming only one advertisement per client
      };
    });

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

export const editAdvertiser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, mobile } = req.body;

    const updatedAdvertiser = await Advertiser.findByIdAndUpdate(
      id,
      { name, email, mobile },
      { new: true }
    );

    if (!updatedAdvertiser) {
      return res.status(404).json({ message: "Advertiser not found" });
    }

    res.status(200).json({ message: "Advertiser updated successfully", updatedAdvertiser });
  } catch (error) {
    console.error("Error updating advertiser:", error);
    res.status(500).json({ message: "Error updating advertiser" });
  }
};

// Controller for toggling active status
export const toggleAdvertiserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body; // We expect the active status to be passed in the request body

    // Find the advertiser and update the active status
    const updatedAdvertiser = await Advertiser.findByIdAndUpdate(
      id,
      { active }, // Update the advertiser's active status
      { new: true }
    );

    if (!updatedAdvertiser) {
      return res.status(404).json({ message: "Advertiser not found" });
    }

    // Update all associated advertisements to match the advertiser's active status
    await Advertisement.updateMany(
      { advertiserId: id },
      { active } // Set the active status of all associated advertisements
    );

    res.status(200).json({
      message: `Advertiser is now ${active ? "Active" : "Inactive"}`,
      advertiser: updatedAdvertiser,
    });
  } catch (error) {
    console.error("Error updating advertiser status:", error);
    res.status(500).json({ message: "Error updating advertiser status" });
  }
};

export const editAdvertisement = async (req, res) => {
  const adImagePath = req.file ? req.file.path : null;

  try {
    const { id } = req.params;
    const { adName, advertiserId } = req.body;

    console.log(adName, advertiserId)

    let adImage;

    // If a new image is uploaded, update it on Cloudinary
    if (adImagePath) {
      const uploadResult = await uploadOnCloudinary(adImagePath);
      if (!uploadResult || !uploadResult.secure_url) {
        return res.status(500).json({ message: "Display image upload failed" });
      }
      adImage = uploadResult.secure_url;
    }

    // Build update data only with the fields that are provided
    const updateData = {};

    if (adName) updateData.adName = adName;
    if (advertiserId) updateData.advertiserId = advertiserId;
    if (adImage) updateData.adImage = adImage;

    // If no fields are provided to update, return an error
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // Update the advertisement in the database
    const updatedAdvertisement = await Advertisement.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!updatedAdvertisement) {
      return res.status(404).json({ message: "Advertisement not found" });
    }

    res.status(200).json({ message: "Advertisement updated successfully", updatedAdvertisement });
  } catch (error) {
    console.error("Error updating advertisement:", error);
    res.status(500).json({ message: "Error updating advertisement" });
  }
};

export const toggleAdvertisementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body; // Expect the 'active' status to be sent in the request body

    // Find the advertisement and update the active status
    const updatedAdvertisement = await Advertisement.findByIdAndUpdate(
      id,
      { active }, // Update the active status of the advertisement
      { new: true }
    );

    if (!updatedAdvertisement) {
      return res.status(404).json({ message: "Advertisement not found" });
    }

    res.status(200).json({
      message: `Advertisement is now ${active ? "Active" : "Inactive"}`,
      advertisement: updatedAdvertisement,
    });
  } catch (error) {
    console.error("Error updating advertisement status:", error);
    res.status(500).json({ message: "Error updating advertisement status" });
  }
};
