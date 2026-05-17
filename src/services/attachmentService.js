import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const ATTACHMENTS_DIR = `${FileSystem.documentDirectory}attachments/`;

/**
 * Ensure the attachments directory exists
 */
const ensureDir = async () => {
  const dirInfo = await FileSystem.getInfoAsync(ATTACHMENTS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(ATTACHMENTS_DIR, { intermediates: true });
  }
};

/**
 * Launch image picker and return the local URI of the saved file
 */
export const pickAndSaveAttachment = async () => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access media library is required');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const sourceUri = result.assets[0].uri;
    const filename = sourceUri.split('/').pop();
    const destUri = `${ATTACHMENTS_DIR}${Date.now()}_${filename}`;

    await ensureDir();
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });

    return destUri;
  } catch (error) {
    console.error('Pick attachment error:', error);
    throw error;
  }
};

/**
 * Delete a local attachment file
 */
export const deleteAttachment = async (uri) => {
  if (!uri) return;
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(uri);
    }
  } catch (error) {
    console.error('Delete attachment error:', error);
  }
};

/**
 * Get displayable URI (ensures it's handled correctly by Image component)
 */
export const getDisplayUri = (uri) => {
  if (!uri) return null;
  return uri;
};
