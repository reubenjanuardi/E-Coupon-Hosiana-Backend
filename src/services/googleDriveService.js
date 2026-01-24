import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the service account key file
const KEY_FILE_PATH = path.join(__dirname, '../../config/google-service-account.json');

// Initialize GoogleAuth
const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE_PATH,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

// Initialize Google Drive API
const drive = google.drive({ version: 'v3', auth });

/**
 * Find a file in Google Drive by its name.
 * @param {string} fileName - The name of the file to search for.
 * @returns {Promise<Object|null>} - The file object (id, name) or null if not found.
 */
export const findFileByName = async (fileName) => {
  try {
    console.log(`Searching for file: ${fileName}`);
    const res = await drive.files.list({
      q: `name = '${fileName}' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (res.data.files.length === 0) {
      console.warn(`File not found: ${fileName}`);
      return null;
    }

    // Return the first match
    return res.data.files[0];
  } catch (error) {
    console.error('Error finding file in Google Drive:', error);
    throw new Error('Failed to search for file in Google Drive');
  }
};

/**
 * Download a file from Google Drive as a Buffer.
 * @param {string} fileId - The ID of the file to download.
 * @returns {Promise<Buffer>} - The file content as a Buffer.
 */
export const downloadFile = async (fileId) => {
  try {
    console.log(`Downloading file ID: ${fileId}`);
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    return Buffer.from(res.data);
  } catch (error) {
    console.error('Error downloading file from Google Drive:', error);
    throw new Error('Failed to download file from Google Drive');
  }
};
