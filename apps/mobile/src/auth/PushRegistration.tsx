import { useEffect } from 'react';
import { registerPushToken } from '../lib/notifications';
import { useAuth } from './AuthProvider';

// Registers this device's push token each time a patient signs in. Renders nothing.
export function PushRegistration() {
  const { status, session } = useAuth();
  const userId = session?.user.id;
  useEffect(() => {
    if (status !== 'signed-in' || !userId) return;
    registerPushToken(userId).catch(() => undefined);
  }, [status, userId]);
  return null;
}
