// Config aur Auth/DB functions import karein
import { app, db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    doc, getDoc, collection, addDoc, Timestamp, serverTimestamp,
    query, where, getDocs, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM Elements - Single query selector for better performance
const elements = {
    loader: document.getElementById('loader'),
    toast: document.getElementById('toast'),
    appContainer: document.getElementById('app-container'),
    groupNameHeader: document.getElementById('group-name-header'),
    groupMembersCount: document.getElementById('group-members-count'),
    logoutBtn: document.getElementById('logout-btn'),
    pages: {
        chat: document.getElementById('chat-page'),
        expense: document.getElementById('expense-page'),
        history: document.getElementById('history-page')
    },
    navButtons: {
        chat: document.getElementById('nav-chat'),
        expense: document.getElementById('nav-expense'),
        history: document.getElementById('nav-history')
    },
    groupInfoBtn: document.getElementById('group-info-btn'),
    groupInfoModal: document.getElementById('group-info-modal'),
    closeInfoModalBtn: document.getElementById('close-info-modal-btn'),
    groupShareIdInput: document.getElementById('group-share-id'),
    copyGroupIdBtn: document.getElementById('copy-group-id-btn'),
    settlementsContainer: document.getElementById('settlements-container'),
    membersListContainer: document.getElementById('members-list-container'),
    expenseForm: document.getElementById('expense-form'),
    expenseDateInput: document.getElementById('expense-date'),
    totalAmountInput: document.getElementById('total-amount'),
    descriptionInput: document.getElementById('description'),
    categoryInput: document.getElementById('category'),
    membersContainer: document.getElementById('members-container'),
    addMemberBtn: document.getElementById('add-member-btn'),
    splitEquallyBtn: document.getElementById('split-equally-btn'),
    expenseHistoryContainer: document.getElementById('expense-history-container'),
    loadingHistoryMsg: document.getElementById('loading-history-msg')
};

// Application State
const state = {
    currentUser: null,
    currentGroup: null,
    currentGroupId: null,
    currentGroupMembersData: [],
    expenseListener: null
};

// --- Utility Functions ---
const utils = {
    showLoader: (show) => {
        elements.loader.classList.toggle('hidden', !show);
    },
    
    showToast: (message, type = 'success') => {
        elements.toast.textContent = message;
        elements.toast.className = '';
        elements.toast.classList.add('show', `toast-${type}`);
        setTimeout(() => {
            elements.toast.classList.remove('show');
        }, 3000);
    },
    
    openModal: (modal) => {
        modal.classList.add('active');
    },
    
    closeModal: (modal) => {
        modal.classList.remove('active');
    },
    
    formatCurrency: (amount) => {
        return `₹${parseFloat(amount).toFixed(2)}`;
    },
    
    formatDate: (timestamp) => {
        if (!timestamp?.toDate) return 'Date Missing';
        try {
            const date = timestamp.toDate();
            return date.toLocaleDateString('en-IN', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
            });
        } catch (e) {
            console.error("Error formatting date:", e);
            return 'Invalid Date';
        }
    }
};

// --- Authentication and Initialization ---
const initApp = () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            state.currentUser = user;
            await initializeGroup();
        } else {
            window.location.href = 'index.html';
        }
    });
};

const initializeGroup = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    state.currentGroupId = urlParams.get('id');
    
    if (!state.currentGroupId) {
        window.location.href = 'home.html';
        return;
    }
    
    await loadGroupData();
};

// --- Group Data Management ---
const loadGroupData = async () => {
    try {
        utils.showLoader(true);
        
        const groupDocRef = doc(db, 'groups', state.currentGroupId);
        const groupDoc = await getDoc(groupDocRef);
        
        if (!groupDoc.exists()) {
            utils.showToast("Group not found.", "error");
            window.location.href = 'home.html';
            return;
        }
        
        state.currentGroup = groupDoc.data();
        
        // Check if user is a member of the group
        if (!state.currentGroup.members.includes(state.currentUser.uid)) {
            utils.showToast("You are not a member of this group.", "error");
            window.location.href = 'home.html';
            return;
        }
        
        await fetchGroupMembersData();
        setupGroupPage();
        
    } catch (error) {
        console.error("Error loading group data:", error);
        utils.showToast("Failed to load group.", "error");
    } finally {
        utils.showLoader(false);
    }
};

const fetchGroupMembersData = async () => {
    state.currentGroupMembersData = [];
    try {
        const memberPromises = state.currentGroup.members.map(uid => 
            getDoc(doc(db, 'users', uid))
        );
        const memberDocs = await Promise.all(memberPromises);
        state.currentGroupMembersData = memberDocs.map(docSnap => docSnap.data());
        console.log("Group Members:", state.currentGroupMembersData);
    } catch (error) {
        console.error("Error fetching members data:", error);
    }
};

// --- Page Setup ---
const setupGroupPage = () => {
    // Update header
    elements.groupNameHeader.textContent = state.currentGroup.groupName;
    elements.groupMembersCount.textContent = `${state.currentGroup.members.length} members`;
    
    // Setup event listeners
    setupEventListeners();
    setupNavigation();
    setupInfoModal();
    setupExpenseForm();
    
    // Show default page
    switchPage('expense');
};

const setupEventListeners = () => {
    elements.logoutBtn.addEventListener('click', handleLogout);
};

// --- Navigation Logic ---
const setupNavigation = () => {
    Object.entries(elements.navButtons).forEach(([pageName, button]) => {
        button.addEventListener('click', () => switchPage(pageName));
    });
};

const switchPage = (pageName) => {
    // Hide all pages and remove active states
    Object.values(elements.pages).forEach(page => page.classList.remove('active'));
    Object.values(elements.navButtons).forEach(btn => btn.classList.remove('active'));
    
    // Show selected page
    elements.pages[pageName].classList.add('active');
    elements.navButtons[pageName].classList.add('active');
    
    // Cleanup previous listeners
    if (state.expenseListener) {
        state.expenseListener();
        state.expenseListener = null;
        console.log("Stopped expense listener.");
    }
    
    // Load page-specific content
    const pageHandlers = {
        expense: loadExpenseForm,
        history: loadExpenseHistory
    };
    
    if (pageHandlers[pageName]) {
        pageHandlers[pageName]();
    }
};

// --- Group Info Modal Logic ---
const setupInfoModal = () => {
    elements.groupInfoBtn.addEventListener('click', openGroupInfoModal);
    elements.closeInfoModalBtn.addEventListener('click', () => utils.closeModal(elements.groupInfoModal));
    elements.copyGroupIdBtn.addEventListener('click', copyGroupId);
};

const openGroupInfoModal = () => {
    elements.groupShareIdInput.value = state.currentGroup.uniqueCode;
    renderMembersList();
    renderSettlements();
    utils.openModal(elements.groupInfoModal);
};

const renderMembersList = () => {
    elements.membersListContainer.innerHTML = '';
    
    state.currentGroupMembersData.forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'flex items-center gap-3 p-2 bg-gray-50 rounded';
        
        const isAdmin = (member.uid === state.currentGroup.admin);
        memberDiv.innerHTML = `
            <i class="fas fa-user-circle text-gray-400 text-2xl"></i>
            <span class="flex-grow font-medium">${member.name}</span>
            ${isAdmin ? '<span class="text-xs text-purple-600 font-bold">ADMIN</span>' : ''}
        `;
        
        elements.membersListContainer.appendChild(memberDiv);
    });
};

const renderSettlements = () => {
    elements.settlementsContainer.innerHTML = 
        '<p class="text-gray-500 text-center">Settlements coming soon...</p>';
};

const copyGroupId = () => {
    elements.groupShareIdInput.select();
    document.execCommand('copy');
    utils.showToast("Group ID copied!", "success");
};

// --- Expense Form Logic ---
const setupExpenseForm = () => {
    elements.expenseForm.addEventListener('submit', handleExpenseSubmit);
    elements.addMemberBtn.addEventListener('click', () => addMemberRow());
    elements.splitEquallyBtn.addEventListener('click', splitEqually);
};

const loadExpenseForm = () => {
    elements.expenseForm.reset();
    elements.expenseDateInput.valueAsDate = new Date();
    elements.membersContainer.innerHTML = '';
    
    state.currentGroupMembersData.forEach(member => {
        addMemberRow(member.name, '');
    });
};

const addMemberRow = (name = '', amount = '') => {
    const memberDiv = document.createElement('div');
    memberDiv.className = 'member-row flex gap-2 items-center mb-2';
    
    memberDiv.innerHTML = `
        <input type="text" value="${name}" class="form-input flex-grow member-name" 
               placeholder="Member Name" required>
        <input type="number" value="${amount}" class="form-input w-28 member-amount" 
               placeholder="Amount" step="0.01" required>
        <button type="button" class="remove-member-btn px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600">
            &times;
        </button>
    `;
    
    elements.membersContainer.appendChild(memberDiv);
    
    memberDiv.querySelector('.remove-member-btn').addEventListener('click', () => {
        memberDiv.remove();
    });
};

const splitEqually = () => {
    const totalAmount = parseFloat(elements.totalAmountInput.value);
    const memberRows = document.querySelectorAll('.member-row');
    
    if (isNaN(totalAmount) || totalAmount <= 0) {
        utils.showToast('Please enter a valid total amount first', 'error');
        return;
    }
    
    if (memberRows.length === 0) {
        utils.showToast('Please add members first', 'error');
        return;
    }
    
    const amountPerPerson = (totalAmount / memberRows.length).toFixed(2);
    
    memberRows.forEach(row => {
        row.querySelector('.member-amount').value = amountPerPerson;
    });
    
    utils.showToast(`Split equally: ${utils.formatCurrency(amountPerPerson)} per person`);
};

const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    utils.showLoader(true);
    
    try {
        const expenseData = validateAndPrepareExpenseData();
        await saveExpenseToFirestore(expenseData);
        
        utils.showToast("Expense added successfully!", "success");
        switchPage('history');
        
    } catch (error) {
        console.error("Error adding expense:", error);
        utils.showToast(error.message, "error");
    } finally {
        utils.showLoader(false);
    }
};

const validateAndPrepareExpenseData = () => {
    const totalAmount = parseFloat(elements.totalAmountInput.value);
    const memberRows = document.querySelectorAll('.member-row');
    const membersArray = [];
    let totalSplit = 0;
    
    // Validate member data
    for (const row of memberRows) {
        const name = row.querySelector('.member-name').value.trim();
        const amount = parseFloat(row.querySelector('.member-amount').value);
        
        if (!name || isNaN(amount)) {
            throw new Error("All member fields must be filled correctly.");
        }
        
        const memberData = state.currentGroupMembersData.find(m => m.name === name);
        membersArray.push({
            uid: memberData ? memberData.uid : null,
            name: name,
            amount: amount
        });
        
        totalSplit += amount;
    }
    
    // Validate split data
    if (membersArray.length === 0) {
        throw new Error("You must split the expense with at least one member.");
    }
    
    if (Math.abs(totalSplit - totalAmount) > 0.01) {
        throw new Error(`Split total (${utils.formatCurrency(totalSplit)}) doesn't match total amount (${utils.formatCurrency(totalAmount)}).`);
    }
    
    // Prepare expense data
    return {
        description: elements.descriptionInput.value,
        totalAmount: totalAmount,
        category: elements.categoryInput.value,
        expenseDate: Timestamp.fromDate(new Date(elements.expenseDateInput.value)),
        createdAt: serverTimestamp(),
        addedBy: {
            uid: state.currentUser.uid,
            name: state.currentGroupMembersData.find(m => m.uid === state.currentUser.uid)?.name || 'Unknown User'
        },
        splitWith: membersArray
    };
};

const saveExpenseToFirestore = async (expenseData) => {
    const expensesColRef = collection(db, 'groups', state.currentGroupId, 'expenses');
    await addDoc(expensesColRef, expenseData);
};

// --- Expense History Logic ---
const loadExpenseHistory = () => {
    console.log("DEBUG: loadExpenseHistory() called.");
    
    elements.loadingHistoryMsg.textContent = "Loading history...";
    elements.expenseHistoryContainer.innerHTML = '';
    elements.expenseHistoryContainer.appendChild(elements.loadingHistoryMsg);
    elements.loadingHistoryMsg.style.display = 'block';
    
    const expensesColRef = collection(db, 'groups', state.currentGroupId, 'expenses');
    const q = query(expensesColRef, orderBy("createdAt", "desc"));
    
    console.log(`DEBUG: Setting up listener for group ${state.currentGroupId}`);
    
    state.expenseListener = onSnapshot(q, 
        (snapshot) => handleExpenseSnapshot(snapshot),
        (error) => handleExpenseError(error)
    );
};

const handleExpenseSnapshot = (snapshot) => {
    console.log(`DEBUG: onSnapshot triggered. Empty: ${snapshot.empty}, Size: ${snapshot.size}`);
    
    elements.expenseHistoryContainer.innerHTML = '';
    
    if (snapshot.empty) {
        elements.loadingHistoryMsg.textContent = "No expenses recorded yet.";
        elements.expenseHistoryContainer.appendChild(elements.loadingHistoryMsg);
        elements.loadingHistoryMsg.style.display = 'block';
        return;
    }
    
    elements.loadingHistoryMsg.style.display = 'none';
    
    snapshot.forEach(doc => {
        const expense = doc.data();
        expense.id = doc.id;
        console.log("DEBUG: Rendering expense:", expense.description, expense.id);
        renderExpenseCard(expense);
    });
};

const handleExpenseError = (error) => {
    console.error("DEBUG: Error in onSnapshot listener:", error);
    elements.expenseHistoryContainer.innerHTML = '';
    elements.loadingHistoryMsg.textContent = "Error loading history.";
    elements.expenseHistoryContainer.appendChild(elements.loadingHistoryMsg);
    elements.loadingHistoryMsg.style.display = 'block';
    utils.showToast("Could not load expense history.", "error");
};

const renderExpenseCard = (expense) => {
    console.log("DEBUG: renderExpenseCard called for:", expense.description, expense.id);
    
    const card = document.createElement('div');
    card.className = 'card p-4 expense-item mb-4';
    
    const formattedDate = utils.formatDate(expense.expenseDate);
    const payerName = expense.addedBy?.name || 'Unknown Payer';
    
    const innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <div>
                <h3 class="font-semibold text-lg text-gray-800">${expense.description || 'No Description'}</h3>
                <p class="text-gray-500 text-sm">${formattedDate} • ${expense.category || 'Uncategorized'}</p>
            </div>
            <div class="text-right">
                <p class="font-bold text-xl text-purple-600">${utils.formatCurrency(expense.totalAmount)}</p>
                <p class="text-gray-500 text-sm">Paid by ${payerName}</p>
            </div>
        </div>
        <div class="border-t pt-3 mt-3">
            <p class="text-xs font-semibold text-gray-500 mb-1 uppercase">Split Between:</p>
            ${renderSplitDetails(expense)}
        </div>
    `;
    
    try {
        card.innerHTML = innerHTML;
        if (elements.expenseHistoryContainer) {
            elements.expenseHistoryContainer.appendChild(card);
        } else {
            console.error("DEBUG: expenseHistoryContainer not found!");
        }
    } catch (e) {
        console.error("DEBUG: Error rendering card:", e, expense.id);
        renderErrorCard(expense.id);
    }
};

const renderSplitDetails = (expense) => {
    if (!expense.splitWith || !Array.isArray(expense.splitWith)) {
        return '<p class="text-xs text-red-500">Error: Split data missing</p>';
    }
    
    return expense.splitWith.map(member => `
        <div class="flex justify-between text-sm text-gray-600">
            <span>${member.name || 'Unknown'}</span>
            <span class="font-medium">${utils.formatCurrency(member.amount)}</span>
        </div>
    `).join('');
};

const renderErrorCard = (expenseId) => {
    const errorCard = document.createElement('div');
    errorCard.className = 'card p-4 mb-4 bg-red-100 text-red-700';
    errorCard.textContent = `Error rendering expense: ${expenseId}`;
    
    if (elements.expenseHistoryContainer) {
        elements.expenseHistoryContainer.appendChild(errorCard);
    }
};

// --- Logout ---
const handleLogout = async () => {
    utils.showLoader(true);
    
    // Cleanup listeners
    if (state.expenseListener) {
        state.expenseListener();
        state.expenseListener = null;
        console.log("Stopped expense listener before logout.");
    }
    
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Error logging out:", error);
        utils.showToast("Logout failed", "error");
        utils.showLoader(false);
    }
};

// Initialize the application
initApp();
