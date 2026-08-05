// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const analytics = getAnalytics(app);