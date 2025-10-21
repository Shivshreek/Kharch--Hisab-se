// Config aur Auth/DB functions import karein
import { app, db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    doc, getDoc, collection, addDoc, Timestamp, serverTimestamp,
    query, where, getDocs, orderBy, onSnapshot // NAYA: onSnapshot import karo
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
const settlementsContainer = document.getElementById('settlements-container');
const membersListContainer = document.getElementById('members-list-container');

// Expense Form Elements
const expenseForm = document.getElementById('expense-form');
const expenseDateInput = document.getElementById('expense-date');
const totalAmountInput = document.getElementById('total-amount');
const descriptionInput = document.getElementById('description');
const categoryInput = document.getElementById('category');
const membersContainer = document.getElementById('members-container');
const addMemberBtn = document.getElementById('add-member-btn');
const splitEquallyBtn = document.getElementById('split-equally-btn');

// NAYA: History Elements
const expenseHistoryContainer = document.getElementById('expense-history-container');
const loadingHistoryMsg = document.getElementById('loading-history-msg');

let currentUser = null;
let currentGroup = null;
let currentGroupId = null;
let currentGroupMembersData = [];
let expenseListener = null; // NAYA: Listener ko track karne ke liye variable

// --- Utility Functions --- (No changes here)
function showLoader(show) { /* ... */ }
function showToast(message, type = 'success') { /* ... */ }
function openModal(modal) { /* ... */ }
function closeModal(modal) { /* ... */ }
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

// --- Page Initialization --- (No changes here)
onAuthStateChanged(auth, async (user) => { /* ... */ });
async function loadGroupData() { /* ... */ }
async function fetchGroupMembersData() { /* ... */ }
// --- Page Initialization ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const urlParams = new URLSearchParams(window.location.search);
        currentGroupId = urlParams.get('id');

        if (!currentGroupId) {
            window.location.href = 'home.html';
            return;
        }
        await loadGroupData();
    } else {
        window.location.href = 'index.html';
    }
});
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

        if (!currentGroup.members.includes(currentUser.uid)) {
            showToast("You are not a member of this group.", "error");
            window.location.href = 'home.html';
            return;
        }

        await fetchGroupMembersData();
        setupGroupPage();

    } catch (error) {
        console.error("Error loading group data:", error);
        showToast("Failed to load group.", "error");
        showLoader(false);
    }
}
async function fetchGroupMembersData() {
    currentGroupMembersData = [];
    try {
        const memberPromises = currentGroup.members.map(uid => getDoc(doc(db, 'users', uid)));
        const memberDocs = await Promise.all(memberPromises);
        currentGroupMembersData = memberDocs.map(docSnap => docSnap.data());
    } catch (error) {
        console.error("Error fetching members data:", error);
    }
}

// --- Setup Group Page --- (No changes here)
function setupGroupPage() { /* ... */ }
// --- Setup Group Page ---
function setupGroupPage() {
    groupNameHeader.textContent = currentGroup.groupName;
    groupMembersCount.textContent = `${currentGroup.members.length} members`;
    logoutBtn.addEventListener('click', handleLogout);
    setupNavigation();
    setupInfoModal();
    setupExpenseForm();
    switchPage('expense'); // Default page expense hai
    showLoader(false);
}

// --- Navigation Logic --- (Minor Update)
function setupNavigation() { /* ... */ }
function switchPage(pageName) {
    Object.values(pages).forEach(page => page.classList.remove('active'));
    Object.values(navButtons).forEach(btn => btn.classList.remove('active'));
    pages[pageName].classList.add('active');
    navButtons[pageName].classList.add('active');

    // NAYA: Stop listening to previous page's data (if applicable)
    if (expenseListener) {
        expenseListener(); // Stop listening to Firestore changes
        expenseListener = null;
        console.log("Stopped expense listener.");
    }

    // NAYA: Load data specific to the active page
    if (pageName === 'expense') {
        loadExpenseForm();
    } else if (pageName === 'history') {
        loadExpenseHistory(); // Naya function call
    }
    // else if (pageName === 'chat') { loadChatMessages(); } // Future
}
// --- Navigation Logic ---
function setupNavigation() {
    navButtons.chat.addEventListener('click', () => switchPage('chat'));
    navButtons.expense.addEventListener('click', () => switchPage('expense'));
    navButtons.history.addEventListener('click', () => switchPage('history'));
}

// --- Group Info Modal Logic --- (No changes here)
function setupInfoModal() { /* ... */ }
// --- Group Info Modal Logic ---
function setupInfoModal() {
    groupInfoBtn.addEventListener('click', () => {
        groupShareIdInput.value = currentGroup.uniqueCode;
        membersListContainer.innerHTML = ''; // Clear previous list
        currentGroupMembersData.forEach(member => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'flex items-center gap-3 p-2 bg-gray-50 rounded';
            const isAdmin = (member.uid === currentGroup.admin);
            memberDiv.innerHTML = `
                <i class="fas fa-user-circle text-gray-400 text-2xl"></i>
                <span class="flex-grow font-medium">${member.name}</span>
                ${isAdmin ? '<span class="text-xs text-purple-600 font-bold">ADMIN</span>' : ''}
            `;
            membersListContainer.appendChild(memberDiv);
        });
        settlementsContainer.innerHTML = '<p class="text-gray-500 text-center">Settlements coming soon...</p>';
        openModal(groupInfoModal);
    });
    closeInfoModalBtn.addEventListener('click', () => closeModal(groupInfoModal));
    copyGroupIdBtn.addEventListener('click', () => {
        groupShareIdInput.select();
        document.execCommand('copy');
        showToast("Group ID copied!", "success");
    });
}

// --- Expense Form Logic --- (No changes here)
function setupExpenseForm() { /* ... */ }
function loadExpenseForm() { /* ... */ }
function addMemberRow(name = '', amount = '') { /* ... */ }
function splitEqually() { /* ... */ }
async function handleExpenseSubmit(e) { /* ... */ }
// --- Expense Form Logic ---
function setupExpenseForm() {
    expenseForm.addEventListener('submit', handleExpenseSubmit);
    addMemberBtn.addEventListener('click', () => addMemberRow());
    splitEquallyBtn.addEventListener('click', splitEqually);
}
function loadExpenseForm() {
    expenseForm.reset();
    expenseDateInput.valueAsDate = new Date();
    membersContainer.innerHTML = '';
    currentGroupMembersData.forEach(member => {
        addMemberRow(member.name, '');
    });
}
function addMemberRow(name = '', amount = '') {
    const memberDiv = document.createElement('div');
    memberDiv.className = 'member-row'; // Use class for styling
    memberDiv.innerHTML = `
        <input type="text" value="${name}" class="form-input flex-grow member-name" placeholder="Member Name" required>
        <input type="number" value="${amount}" class="form-input w-28 member-amount" placeholder="Amount" step="0.01" required>
        <button type="button" class="remove-member-btn">&times;</button>
    `;
    membersContainer.appendChild(memberDiv);
    memberDiv.querySelector('.remove-member-btn').addEventListener('click', () => {
        memberDiv.remove();
    });
}
function splitEqually() {
    const totalAmount = parseFloat(totalAmountInput.value);
    const memberRows = document.querySelectorAll('.member-row');
    if (isNaN(totalAmount) || totalAmount <= 0) {
        showToast('Please enter a valid total amount first', 'error');
        return;
    }
    if (memberRows.length === 0) {
        showToast('Please add members first', 'error');
        return;
    }
    const amountPerPerson = (totalAmount / memberRows.length).toFixed(2);
    memberRows.forEach(row => {
        row.querySelector('.member-amount').value = amountPerPerson;
    });
    showToast(`Split equally: ₹${amountPerPerson} per person`);
}
async function handleExpenseSubmit(e) {
    e.preventDefault();
    showLoader(true);
    try {
        const totalAmount = parseFloat(totalAmountInput.value);
        const memberRows = document.querySelectorAll('.member-row');
        const membersArray = [];
        let totalSplit = 0;
        for (const row of memberRows) {
            const name = row.querySelector('.member-name').value;
            const amount = parseFloat(row.querySelector('.member-amount').value);
            if (!name || isNaN(amount)) throw new Error("All member fields must be filled correctly.");
            const memberData = currentGroupMembersData.find(m => m.name === name);
            membersArray.push({ uid: memberData ? memberData.uid : null, name: name, amount: amount });
            totalSplit += amount;
        }
        if (membersArray.length === 0) throw new Error("You must split the expense with at least one member.");
        if (Math.abs(totalSplit - totalAmount) > 0.01) throw new Error(`Split total (₹${totalSplit.toFixed(2)}) doesn't match total amount (₹${totalAmount.toFixed(2)}).`);
        const expenseData = {
            description: descriptionInput.value,
            totalAmount: totalAmount,
            category: categoryInput.value,
            expenseDate: Timestamp.fromDate(new Date(expenseDateInput.value)),
            createdAt: serverTimestamp(),
            addedBy: {
                uid: currentUser.uid,
                name: currentGroupMembersData.find(m => m.uid === currentUser.uid)?.name || 'Unknown User' // Payer ka naam
            },
            splitWith: membersArray
        };
        const expensesColRef = collection(db, 'groups', currentGroupId, 'expenses');
        await addDoc(expensesColRef, expenseData);
        showToast("Expense added successfully!", "success");
        switchPage('history'); // Switch to history page
    } catch (error) {
        console.error("Error adding expense:", error);
        showToast(error.message, "error");
    } finally {
        showLoader(false);
    }
}


// --- NAYA: Expense History Logic ---

function loadExpenseHistory() {
    loadingHistoryMsg.textContent = "Loading history...";
    expenseHistoryContainer.innerHTML = ''; // Clear previous history
    expenseHistoryContainer.appendChild(loadingHistoryMsg); // Show loading message again

    const expensesColRef = collection(db, 'groups', currentGroupId, 'expenses');
    // Sabse naye expense ko upar dikhane ke liye 'createdAt' se sort karo
    const q = query(expensesColRef, orderBy("createdAt", "desc"));

    // onSnapshot real-time listener hai. Jab bhi data badlega, yeh function run hoga.
    expenseListener = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            loadingHistoryMsg.textContent = "No expenses recorded yet.";
            return;
        }

        loadingHistoryMsg.style.display = 'none'; // Hide loading message
        expenseHistoryContainer.innerHTML = ''; // Clear container

        snapshot.forEach(doc => {
            const expense = doc.data();
            expense.id = doc.id; // Document ID ko data mein add karo (delete ke liye)
            renderExpenseCard(expense);
        });

    }, (error) => { // Error handling for the listener
        console.error("Error fetching expense history:", error);
        loadingHistoryMsg.textContent = "Error loading history.";
        loadingHistoryMsg.style.display = 'block';
        showToast("Could not load expense history.", "error");
    });
    console.log("Started expense listener.");
}

// Ek expense ko display karne ke liye HTML card banata hai
function renderExpenseCard(expense) {
    const card = document.createElement('div');
    card.className = 'card p-4 expense-item'; // expense-item class rehne do agar koi styling hai

    // Date formatting
    const date = expense.expenseDate?.toDate ? expense.expenseDate.toDate() : new Date();
    const formattedDate = date.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });

    // Split details
    const splitDetails = expense.splitWith.map(member => `
        <div class="flex justify-between text-sm text-gray-600">
            <span>${member.name}</span>
            <span class="font-medium">₹${member.amount.toFixed(2)}</span>
        </div>
    `).join('');

    card.innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <div>
                <h3 class="font-semibold text-lg text-gray-800">${expense.description}</h3>
                <p class="text-gray-500 text-sm">${formattedDate} • ${expense.category}</p>
            </div>
            <div class="text-right">
                <p class="font-bold text-xl text-purple-600">₹${expense.totalAmount.toFixed(2)}</p>
                <p class="text-gray-500 text-sm">Paid by ${expense.addedBy.name}</p>
            </div>
        </div>
        <div class="border-t pt-3 mt-3">
            <p class="text-xs font-semibold text-gray-500 mb-1 uppercase">Split Between:</p>
            ${splitDetails}
        </div>
        `;
    expenseHistoryContainer.appendChild(card);
}


// --- Logout --- (No changes here)
async function handleLogout() { /* ... */ }
// --- Logout ---
async function handleLogout() {
    showLoader(true);
    // Stop listening before logging out
    if (expenseListener) {
        expenseListener();
        expenseListener = null;
        console.log("Stopped expense listener before logout.");
    }
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Error logging out:", error);
        showToast("Logout failed", "error");
        showLoader(false);
    }
}
