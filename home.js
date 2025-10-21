// Config aur Auth/DB functions import karein
import { app, db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    doc, getDoc, setDoc, updateDoc, arrayUnion, 
    collection, query, where, getDocs, Timestamp, serverTimestamp, arrayRemove
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM Elements
const loader = document.getElementById('loader');
const userDisplayName = document.getElementById('user-display-name');
const logoutBtn = document.getElementById('logout-btn');
const groupListContainer = document.getElementById('group-list-container');
const loadingGroupsMsg = document.getElementById('loading-groups-msg');
const toast = document.getElementById('toast');

// Modals and Buttons
const createGroupModal = document.getElementById('create-group-modal');
const joinGroupModal = document.getElementById('join-group-modal');
const createGroupBtn = document.getElementById('create-group-btn');
const joinGroupBtn = document.getElementById('join-group-btn');
const cancelCreateBtn = document.getElementById('cancel-create-btn');
const cancelJoinBtn = document.getElementById('cancel-join-btn');
const createGroupForm = document.getElementById('create-group-form');
const joinGroupForm = document.getElementById('join-group-form');

let currentUser = null; // Logged in user ka object yahaan save hoga

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

// --- Auth Management ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User logged in hai
        await fetchUserData(user.uid);
        if (currentUser) {
            setupHomePage();
            await fetchUserGroups();
        } else {
            // User Auth mein hai par DB mein nahi (error case)
            handleLogout();
        }
    } else {
        // User logged in nahi hai, wapas login page par bhejo
        window.location.href = 'index.html';
    }
});

async function fetchUserData(uid) {
    try {
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            currentUser = userDoc.data();
        } else {
            console.error("No user data found in Firestore!");
            showToast("Error loading user data.", "error");
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
    }
}

function setupHomePage() {
    userDisplayName.textContent = `Welcome, ${currentUser.name.split(' ')[0]}`; // Pehla naam dikhao
    logoutBtn.addEventListener('click', handleLogout);
    showLoader(false); // Ab loader hata sakte hain
}

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

// --- Group Management ---

async function fetchUserGroups() {
    if (!currentUser.groups || currentUser.groups.length === 0) {
        loadingGroupsMsg.textContent = "You are not in any groups. Create or join one!";
        return;
    }

    loadingGroupsMsg.style.display = 'none'; // Loading message hatao
    groupListContainer.innerHTML = ''; // List ko clear karo

    try {
        // Har group ID ke liye, group ka data fetch karo
        for (const groupId of currentUser.groups) {
            const groupDocRef = doc(db, 'groups', groupId);
            const groupDoc = await getDoc(groupDocRef);
            if (groupDoc.exists()) {
                renderGroupCard(groupDoc.data());
            } else {
                console.warn(`Group with ID ${groupId} not found, removing from user list.`);
                // Agar group exist nahi karta toh user ki list se hata do (optional cleanup)
                const userRef = doc(db, 'users', currentUser.uid);
                await updateDoc(userRef, {
                    groups: arrayRemove(groupId)
                });
            }
        }
    } catch (error) {
        console.error("Error fetching groups:", error);
        showToast("Could not load your groups.", "error");
        loadingGroupsMsg.style.display = 'block';
        loadingGroupsMsg.textContent = 'Error loading groups.';
    }
}

function renderGroupCard(groupData) {
    const card = document.createElement('a');
    card.href = `group.html?id=${groupData.groupId}`; // Agla page jise hum banayenge
    card.className = 'card p-6 block transform hover:-translate-y-1 transition-transform duration-300';
    
    card.innerHTML = `
        <div class="flex items-center gap-4 mb-3">
            <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <i class="fas fa-users text-purple-600 text-xl"></i>
            </div>
            <div>
                <h2 class="text-xl font-bold text-gray-800">${groupData.groupName}</h2>
                <p class="text-sm text-gray-500">${groupData.members.length} Members</p>
            </div>
        </div>
        <p class="text-xs text-gray-400">Unique ID: ${groupData.uniqueCode}</p>
    `;
    groupListContainer.appendChild(card);
}

// --- Modal Event Listeners ---

createGroupBtn.addEventListener('click', () => openModal(createGroupModal));
joinGroupBtn.addEventListener('click', () => openModal(joinGroupModal));
cancelCreateBtn.addEventListener('click', () => closeModal(createGroupModal));
cancelJoinBtn.addEventListener('click', () => closeModal(joinGroupModal));

// Form Submission
createGroupForm.addEventListener('submit', handleCreateGroup);
joinGroupForm.addEventListener('submit', handleJoinGroup);

// --- Form Handlers ---

async function handleCreateGroup(e) {
    e.preventDefault();
    const groupName = document.getElementById('group-name').value;
    if (!groupName) return;

    showLoader(true);

    try {
        // 1. Ek unique 10-digit ID banao
        const uniqueCode = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        
        // 2. Naya group document reference banao (is point par ID generate hoti hai)
        const newGroupRef = doc(collection(db, 'groups'));
        
        // 3. Naya group data object banao
        const newGroupData = {
            groupId: newGroupRef.id, // Firestore ki generated ID
            groupName: groupName,
            uniqueCode: uniqueCode, // Aapka 10-digit code
            admin: currentUser.uid, // Group banane wala admin hai
            members: [currentUser.uid], // Admin pehla member hai
            createdAt: serverTimestamp()
        };

        // 4. Group ko database mein save karo
        await setDoc(newGroupRef, newGroupData);

        // 5. User ke document mein is group ki ID add karo
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            groups: arrayUnion(newGroupRef.id)
        });

        // 6. UI Update karo
        showToast("Group created successfully!", "success");
        renderGroupCard(newGroupData); // Naya card UI mein add karo
        currentUser.groups.push(newGroupRef.id); // Local state update karo
        closeModal(createGroupModal);
        createGroupForm.reset();
        loadingGroupsMsg.style.display = 'none';

    } catch (error) {
        console.error("Error creating group:", error);
        showToast("Failed to create group. Please try again.", "error");
    } finally {
        showLoader(false);
    }
}

async function handleJoinGroup(e) {
    e.preventDefault();
    const uniqueCode = document.getElementById('group-id-input').value;
    if (!uniqueCode) return;

    showLoader(true);

    try {
        // 1. Is 'uniqueCode' se group ko dhoondo
        const groupsRef = collection(db, 'groups');
        const q = query(groupsRef, where("uniqueCode", "==", uniqueCode));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showToast("Invalid Group ID. No group found.", "error");
            showLoader(false);
            return;
        }

        // 2. Group mil gaya
        const groupDoc = querySnapshot.docs[0];
        const groupData = groupDoc.data();
        const groupId = groupData.groupId;

        // 3. Check karo kahin user pehle se member toh nahi hai
        if (groupData.members.includes(currentUser.uid)) {
            showToast("You are already a member of this group.", "warning");
            showLoader(false);
            return;
        }

        // 4. User ko group ke 'members' array mein add karo
        const groupRef = doc(db, 'groups', groupId);
        await updateDoc(groupRef, {
            members: arrayUnion(currentUser.uid)
        });

        // 5. Group ko user ke 'groups' array mein add karo
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            groups: arrayUnion(groupId)
        });

        // 6. UI Update karo
        showToast(`Joined group "${groupData.groupName}"!`, "success");
        renderGroupCard(groupData); // Naya card UI mein add karo
        currentUser.groups.push(groupId); // Local state update karo
        closeModal(joinGroupModal);
        joinGroupForm.reset();

    } catch (error) {
        console.error("Error joining group:", error);
        showToast("Failed to join group. Please try again.", "error");
    } finally {
        showLoader(false);
    }
}
