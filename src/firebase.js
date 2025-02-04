// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBzHBjR4qMqfV2E_yduiMJnuQpmOh6pyss",
  authDomain: "aws-coding-club-ai.firebaseapp.com",
  projectId: "aws-coding-club-ai",
  storageBucket: "aws-coding-club-ai.firebasestorage.app",
  messagingSenderId: "355550864470",
  appId: "1:355550864470:web:e7d5f9e310ba8c1fc9c7f7"
};

// Initialize Firebase
 const app = initializeApp(firebaseConfig);
 const db = getFirestore(app);
export { db, collection, doc, setDoc, updateDoc, serverTimestamp };