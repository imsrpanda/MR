import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

import { getStorage } from "firebase/storage";

// TODO: Replace the following with your app's Firebase project configuration
export const firebaseConfig = {
    apiKey: "AIzaSyAo1oC0cRvfSXZbPvw5zNF72Aov9MSIzEY",
    authDomain: "mr-app-f59e5.firebaseapp.com",
    projectId: "mr-app-f59e5",
    storageBucket: "mr-app-f59e5.firebasestorage.app",
    messagingSenderId: "83134588930",
    appId: "1:83134588930:web:6a405df74e386d800fdf1b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
