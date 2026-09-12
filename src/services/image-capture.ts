import * as ImagePicker from 'expo-image-picker';
import { launchCamera } from 'react-native-image-picker';

/**
 * Launches the device camera and returns the local file URI of the captured
 * photo. Uses react-native-image-picker, which captures through the system
 * camera app via an ACTION_IMAGE_CAPTURE intent — so the app needs **no**
 * CAMERA permission (the camera app owns that permission). Everything stays
 * on-device; nothing is uploaded.
 */
export async function capturePhoto(): Promise<string | null> {
  const result = await launchCamera({
    mediaType: 'photo',
    quality: 0.8,
    saveToPhotos: false,
  });
  if (result.didCancel || result.errorCode || !result.assets?.length) return null;
  return result.assets[0].uri ?? null;
}

export async function pickPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}
