// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  FacebookAuthProvider,
  GithubAuthProvider,
} from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA58JjOoA5J9aB0shbos93kfVsoz9NKqH8",
  authDomain: "leads-cruise.firebaseapp.com",
  projectId: "leads-cruise",
  storageBucket: "leads-cruise.firebasestorage.app",
  messagingSenderId: "708450124475",
  appId: "1:708450124475:web:7c06fe53f285a639e89f9e",
  measurementId: "G-GDZGESVFJL",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();
const githubProvider = new GithubAuthProvider();

export { auth, provider, facebookProvider, githubProvider, signInWithPopup };
