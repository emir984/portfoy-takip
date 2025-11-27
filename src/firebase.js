import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Ekran görüntüsünden aldığım SENİN GERÇEK AYARLARIN:
const firebaseConfig = {
  apiKey: "AIzaSyDt3yZL5GR_IIxSBfrfGr3jvb3p4e7gaRI",
  authDomain: "portfoy-takip-b64b1.firebaseapp.com",
  projectId: "portfoy-takip-b64b1",
  storageBucket: "portfoy-takip-b64b1.firebasestorage.app",
  messagingSenderId: "302915267032",
  appId: "1:302915267032:web:0fa0dbe821040120cbaaad",
  measurementId: "G-6VE5TJ1MTC"
};

// Uygulamayı başlat
const app = initializeApp(firebaseConfig);

// Analytics servisini başlat (Ekran görüntüsündeki gibi)
const analytics = getAnalytics(app);

// Veritabanını dışarı aktar (App.jsx'te kullanacağız)
export const db = getFirestore(app);