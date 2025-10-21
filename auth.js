// Firebase config file se app, db, aur auth ko import karein
import { app, db, auth } from './firebase-config.js';

// Naye Auth functions ko import karein
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Naye Database functions ko import karein
import { 
    doc, 
    setDoc,
    Timestamp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// DOM Elements
const loader = document.getElementById('loader');
const toast = document.getElementById('toast');
const loginContainer = document.getElementById('login-container');
const registerContainer = document.getElementById('register-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');

// --- Utility Functions ---
function showLoader(show) {
    loader.classList.toggle('hidden', !show);
}
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = '';
    toast.classList.add('show', `toast-${type}`);
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
function showLoginError(message) {
    loginError.textContent = message;
    loginError.classList.remove('hidden');
}
function showRegisterError(message) {
    registerError.textContent = message;
    registerError.classList.remove('hidden');
}

// --- Form Toggling ---
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginContainer.classList.add('hidden');
    registerContainer.classList.remove('hidden');
});
showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerContainer.classList.add('hidden');
    loginContainer.classList.remove('hidden');
});

// --- Authentication Logic ---

// 1. Handle Registration
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoader(true);
    registerError.classList.add('hidden');
    
    alert("DEBUG: 'Register' button clicked. Step 1 shuru."); // <-- ALERT 1

    const name = document.getElementById('reg-name').value;
    const dob = document.getElementById('reg-dob').value;
    const contact = document.getElementById('reg-contact').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    if (password !== confirmPassword) {
        showRegisterError("Passwords do not match!");
        showLoader(false);
        return;
    }

    try {
        // Step 1: Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        alert("DEBUG: Step 2 - Authentication successful. Ab database mein save kar rahe hain."); // <-- ALERT 2

        // Step 2: Save additional user data in Firestore
        const userDocRef = doc(db, 'users', user.uid); 
        await setDoc(userDocRef, {
            uid: user.uid,
            name: name,
            email: email,
            dob: dob,
            contact: contact,
            createdAt: Timestamp.now(),
            groups: [],
            role: "User"
        });
        
        alert("DEBUG: Step 3 - Database mein save ho gaya! Ab home page par jaa rahe hain."); // <-- ALERT 3

        // Step 3: Sabkuch save hone ke BAAD redirect karein
        showToast('Account created successfully!', 'success');
        window.location.href = 'home.html';

    } catch (error) {
        
        alert("DEBUG: ERROR! Kuch fail ho gaya: " + error.message); // <-- ALERT 4 (Error)
        
        console.error(error);
        showRegisterError(error.message);
        showLoader(false);
    }
});

// 2. Handle Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoader(true);
    loginError.classList.add('hidden');

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('Logged in successfully!', 'success');
        window.location.href = 'home.html';

    } catch (error) {
        console.error(error);
        showLoginError(error.message);
        showLoader(false);
    }
});

// 3. Auth State Observer
let isCheckingAuth = true;
onAuthStateChanged(auth, (user) => {
    if (isCheckingAuth) {
        if (user) {
            window.location.href = 'home.html';
        } else {
            showLoader(false);
        }
        isCheckingAuth = false;
    }
});
