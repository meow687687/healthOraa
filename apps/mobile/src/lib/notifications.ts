import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

// Shown while the app is open as well as in the background.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// An Expo push token needs the EAS project id. It comes from the build configuration, not the code.
const PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

export type PushRegistration = 'registered' | 'skipped' | 'denied';

let tokenOperationQueue: Promise<void> = Promise.resolve();
const blockedRegistrations = new Set<string>();

const serializeTokenOperation = async <T>(operation: () => Promise<T>): Promise<T> => {
  const result = tokenOperationQueue.then(operation, operation);
  tokenOperationQueue = result.then(() => undefined, () => undefined);
  return result;
};

// A cleared account stays blocked until AuthProvider verifies a later signed-in session.
export function allowPushTokenRegistration(userId: string): void {
  blockedRegistrations.delete(userId);
}

export function blockPushTokenRegistration(userId: string): void {
  blockedRegistrations.add(userId);
}

// Asks for permission and stores this device's token in the owner-private token table.
export async function registerPushToken(userId: string): Promise<PushRegistration> {
  if (blockedRegistrations.has(userId) || Platform.OS === 'web' || !PROJECT_ID) return 'skipped';
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Appointments and chat',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const status = current.status === 'granted' ? current.status : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    return serializeTokenOperation(async () => {
      if (blockedRegistrations.has(userId)) return 'skipped';
      const { error } = await supabase.rpc('register_patient_push_token', {
        p_expo_push_token: token,
      });
      if (error) throw new Error(error.message);
      return 'registered';
    });
  } catch {
    // Expo Go and simulators cannot issue push tokens. The app works without them.
    return 'skipped';
  }
}

export async function clearPushToken(userId: string): Promise<void> {
  blockPushTokenRegistration(userId);
  await serializeTokenOperation(async () => {
    const { error } = await supabase.from('patient_push_tokens').delete().eq('user_id', userId);
    if (error) throw new Error(`The push token could not be cleared: ${error.message}`);
  });
}
