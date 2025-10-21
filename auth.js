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

// Form Containers
const loginContainer = document.getElementById('login-container');
const registerContainer = document.getElementById('register-container');

// Forms
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

// Error Messages
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');

// Toggle Links
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

    // Get form data
    const name = document.getElementById('reg-name').value;
    const dob = document.getElementById('reg-dob').value;
    const contact = document.getElementById('reg-contact').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    // Validation
    if (password !== confirmPassword) {
        showRegisterError("Passwords do not match!");
        showLoader(false);
        return;
    }
    if (password.length < 6) {
        showRegisterError("Password must be at least 6 characters long.");
        showLoader(false);
        return;
    }

    try {
        // Step 1: Create user in Firebase Auth (Email/Password)
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Step 2: Save additional user data in Firestore (Database)
        // Yahaan hum naya 'users' collection bana rahe hain
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
            uid: user.uid,
            name: name,
            email: email,
            dob: dob,
            contact: contact,
            createdAt: Timestamp.now(),
            groups: [] // Shuruaat mein user kisi group mein nahi hai
        });

        showLoader(false);
        showToast('Account created successfully! Logging in...', 'success');
        
        // Registration ke baad seedha 'home.html' par bhej do
        window.location.href = 'home.html';

    } catch (error) {
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
        // Sign in user with email and password
        await signInWithEmailAndPassword(auth, email, password);
        
        showLoader(false);
        showToast('Logged in successfully!', 'success');
        
        // Login ke baad seedha 'home.html' par bhej do
        window.location.href = 'home.html';

    } catch (error) {
        console.error(error);
        showLoginError(error.message);
        showLoader(false);
    }
});

// 3. Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User pehle se logged in hai
        console.log("User is already logged in, redirecting to home...");
        // Agar user login page par hai, toh use home bhej do
        if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
            window.location.href = 'home.html';
        }
    } else {
        // User logged out hai
        console.log("User is logged out, showing auth forms.");
        // Loader chhupa do (agar dikh raha ho)
        showLoader(false);
    }
});
