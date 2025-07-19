import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCG2ZKCJDHCyXehaqOL66S7gb44o6wu7ow",
  authDomain: "balagh-adbc4.firebaseapp.com",
  projectId: "balagh-adbc4",
  storageBucket: "balagh-adbc4.firebasestorage.app",
  messagingSenderId: "849348028193",
  appId: "1:849348028193:web:66c65700b9454efe22c060",
  measurementId: "G-FG3Q3B40C8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app; 