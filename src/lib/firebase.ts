import { initializeApp, FirebaseApp } from 'firebase/app';
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

let firebaseApp: FirebaseApp | null = null;
let messagingInstance: ReturnType<typeof getMessaging> | null = null;
let firebaseEnabled = false;

function initializeFirebase() {
  try {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      return false;
    }

    if (!firebaseApp) {
      firebaseApp = initializeApp(firebaseConfig);
      firebaseEnabled = true;
    }
    return true;
  } catch (error) {
    firebaseEnabled = false;
    return false;
  }
}

async function getMessagingInstance() {
  try {
    if (!firebaseEnabled && !initializeFirebase()) {
      return null;
    }

    const supported = await isSupported();
    if (!supported) {
      return null;
    }

    if (!messagingInstance && firebaseApp) {
      messagingInstance = getMessaging(firebaseApp);
    }
    return messagingInstance;
  } catch (error) {
    return null;
  }
}

export async function registerFcmToken(userId: string) {
  try {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      return;
    }

    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      return;
    }

    const messaging = await getMessagingInstance();
    if (!messaging) {
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return;
    }

    let registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');

    if (!registration) {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
    }

    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });

    if (!token) {
      return;
    }

    await supabase
      .from('fcm_tokens')
      .upsert({ user_id: userId, token }, { onConflict: 'user_id,token' });

  } catch (error) {
    // Silently fail if Firebase is not configured or has permission issues
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
    // Silently fail
  }
}

export function setupForegroundMessages(callback: (payload: { title: string; body: string }) => void) {
  let unsubscribe: (() => void) | null = null;

  (async () => {
    try {
      const messaging = await getMessagingInstance();
      if (!messaging) {
        return;
      }

      unsubscribe = onMessage(messaging, (payload) => {
        try {
          const title = payload.notification?.title || 'Alpi';
          const body = payload.notification?.body || '';
          callback({ title, body });
        } catch (err) {
          // Silently fail
        }
      });
    } catch (err) {
      // Silently fail
    }
  })();

  return () => {
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch (err) {
        // Silently fail
      }
    }
  };
}
