importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAEbneS-Dst0z5Jg4Tzy59RQ-jnjB_0hJw",
  authDomain: "alpi-dufour.firebaseapp.com",
  projectId: "alpi-dufour",
  storageBucket: "alpi-dufour.firebasestorage.app",
  messagingSenderId: "800534829840",
  appId: "1:800534829840:web:8565e78f98eb5b0795a395"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'Alpi';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/vite.svg',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const ticketId = event.notification.data?.ticket_id;
  const url = ticketId ? `/tickets/${ticketId}` : '/';
  event.waitUntil(clients.openWindow(url));
});
