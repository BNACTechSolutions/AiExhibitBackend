import ActivityLog from '../models/activityLog.model.js';

const activityLogger = async (req, _, next) => {
  const email = req.user?.email || 'Guest';
  const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const action = `${req.method} ${req.originalUrl}`;

  try {
    const logEntry = new ActivityLog({
      email,
      ipAddress,
      action,
    });
    await logEntry.save();
  } catch (error) {
    console.error('Error saving activity log:', error);
  }

  next();
};

export default activityLogger;