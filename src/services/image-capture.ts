import * as ImagePicker from 'expo-image-picker';
import { launchCamera } from 'react-native-image-picker';
import ImageCropPicker from 'react-native-image-crop-picker';

/**
 * Opens an interactive crop screen (uCrop) on an already-captured/picked image.
 * Needs no camera permission — it only edits an existing file. If the user
 * cancels the crop, the original image is kept.
 */
async function cropImage(uri: string): Promise<string> {
  try {
    const cropped = await ImageCropPicker.openCropper({
      path: uri,
      mediaType: 'photo',
      freeStyleCropEnabled: true,
      compressImageQuality: 0.85,
    });
    const path = cropped?.path;
    if (!path) return uri;
    return path.startsWith('file://') || path.startsWith('content://') ? path : `file://${path}`;
  } catch {
    // Crop cancelled or unavailable — keep the original image.
    return uri;
  }
}

/**
 * Launches the device camera and returns the local file URI of the captured
 * (then cropped) photo. Uses react-native-image-picker, which captures through
 * the system camera app via an ACTION_IMAGE_CAPTURE intent — so the app needs
 * **no** CAMERA permission (the camera app owns that permission). Everything
 * stays on-device; nothing is uploaded.
 */
export async function capturePhoto(): Promise<string | null> {
  const result = await launchCamera({
    mediaType: 'photo',
    quality: 0.8,
    saveToPhotos: false,
  });
  if (result.didCancel || result.errorCode || !result.assets?.length) return null;
  const uri = result.assets[0].uri;
  return uri ? cropImage(uri) : null;
}

export async function pickPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return cropImage(result.assets[0].uri);
}
