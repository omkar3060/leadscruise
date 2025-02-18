import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  FacebookAuthProvider,
  GithubAuthProvider,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  signInWithCredential,
} from "firebase/auth";

// Firebase configuration
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

// Configure providers
provider.addScope("email");
githubProvider.addScope("user:email");
facebookProvider.addScope("email");

export {
  auth,
  provider,
  facebookProvider,
  githubProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  signInWithCredential,
  GoogleAuthProvider,
  GithubAuthProvider,
  FacebookAuthProvider,
};
