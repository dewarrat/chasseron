import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, deleteToken, isSupported } from 'firebase/messaging';
import { supabase } from './supabase';

const firebaseConfig = {
  apiKey: "AIzaSyAEbneS-Dst0z5Jg4Tzy59RQ-jnjB_0hJw",
  authDomain: "alpi-dufour.firebaseapp.com",
  projectId: "alpi-dufour",
  storageBucket: "alpi-dufour.firebasestorage.app",
  messagingSenderId: "800534829840",
  appId: "1:800534829840:web:8565e78f98eb5b0795a395",
  measurementId: "G-36Z5YQKXGZ"
};

const app = initializeApp(firebaseConfig);

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

async function getMessagingInstance() {
  const supported = await isSupported();
  if (!supported) {
    return null;
  }
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
}

export async function registerFcmToken(userId: string) {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      return;
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('VITE_FIREBASE_VAPID_KEY not set. Push notifications will not work.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return;
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });

    const { error } = await supabase
      .from('fcm_tokens')
      .upsert({ user_id: userId, token }, { onConflict: 'user_id,token' });

    if (error) {
      console.error('Failed to save FCM token:', error);
    }
  } catch (error) {
    console.error('FCM registration error:', error);
  }
}

export async function unregisterCurrentToken() {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      return;
    }
    await deleteToken(messaging);
  } catch (error) {
    console.error('FCM unregister error:', error);
  }
}

export function setupForegroundMessages(callback: (payload: { title: string; body: string }) => void) {
  (async () => {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      return;
    }
    onMessage(messaging, (payload) => {
      const title = payload.notification?.title || 'Alpi';
      const body = payload.notification?.body || '';
      callback({ title, body });
    });
  })();

  return () => {};
}
