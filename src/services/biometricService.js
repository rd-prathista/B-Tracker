import * as LocalAuthentication from 'expo-local-authentication';
import { getAppSettings } from '../database/db';

/**
 * Check if the device has biometric hardware and if it's enrolled
 */
export const checkBiometricsAvailability = async () => {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
};

/**
 * Attempt to authenticate the user via biometrics
 * Returns true if successful, false otherwise.
 */
export const authenticateBiometrics = async () => {
  try {
    const available = await checkBiometricsAvailability();
    if (!available) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock B Tracker',
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });

    return result.success;
  } catch (error) {
    console.error('Biometric authentication error:', error);
    return false;
  }
};

/**
 * Check if the user has enabled biometrics in the app settings
 */
export const isBiometricsEnabledInSettings = () => {
  const settings = getAppSettings();
  return !!settings?.biometrics_enabled;
};
