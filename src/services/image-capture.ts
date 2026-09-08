import * as ImagePicker from 'expo-image-picker';

/**
 * Launches the device camera (on-device, no internet) and returns the local
 * file URI of the captured photo.
 */
export async function capturePhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
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
