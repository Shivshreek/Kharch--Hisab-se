// Config aur Auth/DB functions import karein
import { app, db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    doc, getDoc, collection, addDoc, Timestamp, serverTimestamp,
    query, where, getDocs
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


// Expense Form Elements (NAYA)
const expenseForm = document.getElementById('expense-form');
const expenseDateInput = document.getElementById('expense-date');
const totalAmountInput = document.getElementById('total-amount');
const descriptionInput = document.getElementById('description');
const categoryInput = document.getElementById('category');
const membersContainer = document.getElementById('members-container');
const addMemberBtn = document.getElementById('add-member-btn');
const splitEquallyBtn = document.getElementById('split-equally-btn');

let currentUser = null;
let currentGroup = null;
let currentGroupId = null;
let currentGroupMembersData = []; // NAYA: Group members ka data (naam, uid) save karne ke liye

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

        // NAYA: Group ke members ka data fetch karo
        await fetchGroupMembersData();

        setupGroupPage();

    } catch (error) {
        console.error("Error loading group data:", error);
        showToast("Failed to load group.", "error");
        showLoader(false);
    }
}

// NAYA: Group members ke UIDs se unka Naam fetch karna
async function fetchGroupMembersData() {
    currentGroupMembersData = []; // Pehle clear karo
    try {
        const memberPromises = currentGroup.members.map(uid => {
            return getDoc(doc(db, 'users', uid));
        });
        const memberDocs = await Promise.all(memberPromises);
        
        currentGroupMembersData = memberDocs.map(doc => doc.data());
        console.log("Group Members:", currentGroupMembersData);

    } catch (error) {
        console.error("Error fetching members data:", error);
    }
}


function setupGroupPage() {
    groupNameHeader.textContent = currentGroup.groupName;
    groupMembersCount.textContent = `${currentGroup.members.length} members`;
    logoutBtn.addEventListener('click', handleLogout);
    setupNavigation();
    setupInfoModal();
    
    // NAYA: Expense form ke listeners ko setup karo
    setupExpenseForm();

    switchPage('expense');
    showLoader(false);
}

// --- Navigation Logic ---

function setupNavigation() {
    navButtons.chat.addEventListener('click', () => switchPage('chat'));
    navButtons.expense.addEventListener('click', () => switchPage('expense'));
    navButtons.history.addEventListener('click', () => switchPage('history'));
}

function switchPage(pageName) {
    Object.values(pages).forEach(page => page.classList.remove('active'));
    Object.values(navButtons).forEach(btn => btn.classList.remove('active'));
    pages[pageName].classList.add('active');
    navButtons[pageName].classList.add('active');

    // NAYA: Jab bhi expense page par aao, form ko load/reset karo
    if (pageName === 'expense') {
        loadExpenseForm();
    }
}

// --- Group Info Modal Logic ---

function setupInfoModal() {
    groupInfoBtn.addEventListener('click', () => {
        groupShareIdInput.value = currentGroup.uniqueCode;
        
        // NAYA: Members list ko modal mein dikhao
        membersListContainer.innerHTML = '';
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

        // Settlements data yahaan load hoga (baad mein)
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

// --- NAYA: Expense Form Logic ---

function setupExpenseForm() {
    // Form submit hone par
    expenseForm.addEventListener('submit', handleExpenseSubmit);
    // Buttons par click hone par
    addMemberBtn.addEventListener('click', () => addMemberRow());
    splitEquallyBtn.addEventListener('click', splitEqually);
}

// Form ko group members ke saath load/reset karta hai
function loadExpenseForm() {
    expenseForm.reset(); // Form ko reset karo
    expenseDateInput.valueAsDate = new Date(); // Aaj ki date set karo
    membersContainer.innerHTML = ''; // Members ki list clear karo

    // Group ke sabhi members ko form mein add karo
    currentGroupMembersData.forEach(member => {
        addMemberRow(member.name, ''); // Default amount khaali rakho
    });
}

// Form mein member add karne ke liye HTML banata hai
function addMemberRow(name = '', amount = '') {
    const memberDiv = document.createElement('div');
    memberDiv.className = 'member-row';
    memberDiv.innerHTML = `
        <input type="text" value="${name}" class="form-input flex-grow member-name" placeholder="Member Name" required>
        <input type="number" value="${amount}" class="form-input w-28 member-amount" placeholder="Amount" step="0.01" required>
        <button type="button" class="remove-member-btn">&times;</button>
    `;
    membersContainer.appendChild(memberDiv);
    
    // Remove button ka logic
    memberDiv.querySelector('.remove-member-btn').addEventListener('click', () => {
        memberDiv.remove();
    });
}

// "Split Equally" button ka logic
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
        const amountInput = row.querySelector('.member-amount');
        amountInput.value = amountPerPerson;
    });
    
    showToast(`Split equally: ₹${amountPerPerson} per person`);
}

// "Save Expense" button (Form Submit) ka logic
async function handleExpenseSubmit(e) {
    e.preventDefault();
    showLoader(true);

    try {
        const totalAmount = parseFloat(totalAmountInput.value);
        
        // 1. Members aur unka amount array mein collect karo
        const memberRows = document.querySelectorAll('.member-row');
        const membersArray = [];
        let totalSplit = 0;

        for (const row of memberRows) {
            const name = row.querySelector('.member-name').value;
            const amount = parseFloat(row.querySelector('.member-amount').value);

            if (!name || isNaN(amount)) {
                throw new Error("All member fields must be filled correctly.");
            }
            
            // Member ka UID dhoondo (taaki data link rahe)
            const memberData = currentGroupMembersData.find(m => m.name === name);
            
            membersArray.push({
                uid: memberData ? memberData.uid : null, // Agar manual add kiya toh null
                name: name,
                amount: amount
            });
            totalSplit += amount;
        }

        // 2. Validate karo ki amount match ho raha hai
        if (membersArray.length === 0) {
            throw new Error("You must split the expense with at least one member.");
        }
        if (Math.abs(totalSplit - totalAmount) > 0.01) {
            throw new Error(`Split total (₹${totalSplit}) doesn't match total amount (₹${totalAmount}).`);
        }

        // 3. Expense object banao
        const expenseData = {
            description: descriptionInput.value,
            totalAmount: totalAmount,
            category: categoryInput.value,
            expenseDate: Timestamp.fromDate(new Date(expenseDateInput.value)),
            createdAt: serverTimestamp(),
            addedBy: {
                uid: currentUser.uid,
                name: currentGroupMembersData.find(m => m.uid === currentUser.uid).name // Payer ka naam
            },
            splitWith: membersArray
        };

        // 4. Database mein save karo (sub-collection ke andar)
        const expensesColRef = collection(db, 'groups', currentGroupId, 'expenses');
        await addDoc(expensesColRef, expenseData);

        showToast("Expense added successfully!", "success");
        switchPage('history'); // User ko history page par bhej do
        // Form apne aap reset ho jaayega jab user waapas aayega

    } catch (error) {
        console.error("Error adding expense:", error);
        showToast(error.message, "error");
    } finally {
        showLoader(false);
    }
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
    }
}
