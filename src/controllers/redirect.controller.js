import RedirectMapping from '../models/redirectMapping.model.js';

export const handleRedirect = async (req, res) => {
    try {
        const shortUrl = req.params.shortUrl;


        // Find the mapping for the shortUrl
        const mapping = await RedirectMapping.findOne({ shortUrl });

        if (!mapping) {
            return res.status(404).send("Short URL not found");
        }

        // Redirect to the mapped URL
        return res.redirect(mapping.redirectUrl);
    } catch (error) {
        console.error("Error during redirection:", error);
        res.status(500).send("Server Error");
    }
};

export const updateRedirectUrl = async (req, res) => {
    try {
        const { shortUrl, redirectUrl } = req.body;
        const clientId = req.user.clientId;

        if (!shortUrl || !redirectUrl) {
            return res.status(400).json({ message: 'Short URL and Redirect URL are required.' });
        }

        // Find the mapping and update or create a new one
        let mapping = await RedirectMapping.findOne({ shortUrl });
        if (mapping) {
            mapping.redirectUrl = redirectUrl;
            await mapping.save();
        } else {
            mapping = new RedirectMapping({ clientId, shortUrl, redirectUrl });
            await mapping.save();
        }

        res.status(200).json({ message: 'Redirect URL updated successfully.', mapping });
    } catch (error) {
        console.error('Update Redirect URL error:', error);
        res.status(500).json({ message: 'Failed to update Redirect URL.', error });
    }
};