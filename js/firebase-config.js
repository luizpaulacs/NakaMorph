import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, set, onValue, onDisconnect, update, remove } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyBBA3TUp8fgdtoS9BLqG16yYM1zy_2BTVQ",
    authDomain: "nakamorph.firebaseapp.com",
    projectId: "nakamorph",
    storageBucket: "nakamorph.firebasestorage.app",
    messagingSenderId: "868906029912",
    appId: "1:868906029912:web:404449a1a2bb2ce92f0b2d"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

export { db, auth, signInAnonymously, ref, set, onValue, onDisconnect, update, remove };