// Config aur Auth/DB functions import karein
import { app, db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    doc, getDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM Elements
const loader = document.getElementById('loader');
const toast = document.getElementById('toast');
const appContainer = document.getElementById('app-container');
const groupNameHeader = document.getElementById('group-name-header');
const groupMembersCount = document.getElementById('group-members-count');
const logoutBtn = document.getElementById('logout-btn');

// Page Sections
const pages = {
    chat: document.getElementById('chat-page'),
    expense: document.getElementById('expense-page'),
    history: document.getElementById('history-page')
};

// Navigation Buttons
const navButtons = {
    chat: document.getElementById('nav-chat'),
    expense: document.getElementById('nav-expense'),
    history: document.getElementById('nav-history')
};

// Group Info Modal
const groupInfoBtn = document.getElementById('group-info-btn');
const groupInfoModal = document.getElementById('group-info-modal');
const closeInfoModalBtn = document.getElementById('close-info-modal-btn');
const groupShareIdInput = document.getElementById('group-share-id');
const copyGroupIdBtn = document.getElementById('copy-group-id-btn');

let currentUser = null;
let currentGroup = null;
let currentGroupId = null;

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

function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}

// --- Page Initialization ---

// 1. Check Auth State
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // 2. Get Group ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        currentGroupId = urlParams.get('id');

        if (!currentGroupId) {
            // Agar URL mein ID nahi hai, toh home bhej do
            window.location.href = 'home.html';
            return;
        }

        // 3. Load Group Data
        await loadGroupData();
    } else {
        // User logged in nahi hai
        window.location.href = 'index.html';
    }
});

// 4. Load Group Data
async function loadGroupData() {
    try {
        const groupDocRef = doc(db, 'groups', currentGroupId);
        const groupDoc = await getDoc(groupDocRef);

        if (!groupDoc.exists()) {
            showToast("Group not found.", "error");
            window.location.href = 'home.html';
            return;
        }

        currentGroup = groupDoc.data();

        // 5. Security Check: Kya user is group ka member hai?
        if (!currentGroup.members.includes(currentUser.uid)) {
            showToast("You are not a member of this group.", "error");
            window.location.href = 'home.html';
            return;
        }

        // 6. Sab theek hai, page setup karo
        setupGroupPage();

    } catch (error) {
        console.error("Error loading group data:", error);
        showToast("Failed to load group.", "error");
        showLoader(false);
    }
}

// 7. Setup Group Page
function setupGroupPage() {
    // Header update karo
    groupNameHeader.textContent = currentGroup.groupName;
    groupMembersCount.textContent = `${currentGroup.members.length} members`;

    // Logout button
    logoutBtn.addEventListener('click', handleLogout);

    // Navigation setup
    setupNavigation();

    // Group Info Modal setup
    setupInfoModal();

    // Default page dikhao
    switchPage('expense'); // Default 'Expense' page khulega
    
    showLoader(false);
}

// --- Navigation Logic ---

function setupNavigation() {
    navButtons.chat.addEventListener('click', () => switchPage('chat'));
    navButtons.expense.addEventListener('click', () => switchPage('expense'));
    navButtons.history.addEventListener('click', () => switchPage('history'));
}

function switchPage(pageName) {
    // Sabhi pages ko hide karo
    Object.values(pages).forEach(page => page.classList.remove('active'));
    // Sabhi buttons se 'active' class hatao
    Object.values(navButtons).forEach(btn => btn.classList.remove('active'));

    // Target page aur button ko active karo
    pages[pageName].classList.add('active');
    navButtons[pageName].classList.add('active');

    // Har page ke data ko load karne ka function yahaan call hoga
    // (Abhi humne banaya nahi hai)
    /*
    if (pageName === 'chat') loadChatMessages();
    if (pageName === 'expense') loadExpenseForm();
    if (pageName === 'history') loadExpenseHistory();
    */
}

// --- Group Info Modal Logic ---

function setupInfoModal() {
    groupInfoBtn.addEventListener('click', () => {
        // Modal kholne se pehle info fill karo
        groupShareIdInput.value = currentGroup.uniqueCode;
        // Settlements aur Members data bhi yahaan load hoga (baad mein)
        openModal(groupInfoModal);
    });

    closeInfoModalBtn.addEventListener('click', () => closeModal(groupInfoModal));

    copyGroupIdBtn.addEventListener('click', () => {
        groupShareIdInput.select();
        document.execCommand('copy');
        showToast("Group ID copied!", "success");
    });
}

// --- Logout ---
async function handleLogout() {
    showLoader(true);
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Error logging out:", error);
        showToast("Logout failed", "error");
        showLoader(false);
    }
}
