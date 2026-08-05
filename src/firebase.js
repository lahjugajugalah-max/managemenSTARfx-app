import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Config firebase milik kamu
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// BAHAN PENTING YANG KURANG:
export const db = getFirestore(app);