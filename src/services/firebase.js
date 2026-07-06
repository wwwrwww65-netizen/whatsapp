import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyABv_xTMP4Od2eyzugAyvUR1mTUBEM0HIk",
  authDomain: "hash-11e5f.firebaseapp.com",
  projectId: "hash-11e5f",
  storageBucket: "hash-11e5f.firebasestorage.app",
  messagingSenderId: "811879615022",
  appId: "1:811879615022:web:716eca9c9b1120d70dadbf",
  measurementId: "G-YKHECJ3ZR4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const rtdb = getDatabase(app);

export { auth, db, storage, rtdb };
