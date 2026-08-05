import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDf6DOoTSSoq0GPeaM-F73nix4G64UDYDA",
  authDomain: "managementstarfx.firebaseapp.com",
  projectId: "managementstarfx",
  storageBucket: "managementstarfx.firebasestorage.app",
  messagingSenderId: "649505848912",
  appId: "1:649505848912:web:d77ebd568ddc22a64d9b55",
  measurementId: "G-4KW0Q0VWYX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export db Firestore untuk dipakai di App.jsx
export const db = getFirestore(app);