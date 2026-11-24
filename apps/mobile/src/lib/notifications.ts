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

// Asks for permission and stores this device's token in the owner-private token table.
export async function registerPushToken(userId: string): Promise<PushRegistration> {
  if (Platform.OS === 'web' || !PROJECT_ID) return 'skipped';
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
    const { error } = await supabase.from('patient_push_tokens').upsert({
      user_id: userId,
      expo_push_token: token,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw new Error(error.message);
    return 'registered';
  } catch {
    // Expo Go and simulators cannot issue push tokens. The app works without them.
    return 'skipped';
  }
}

export async function clearPushToken(userId: string): Promise<void> {
  const { error } = await supabase.from('patient_push_tokens').delete().eq('user_id', userId);
  if (error) throw new Error(`The push token could not be cleared: ${error.message}`);
}
