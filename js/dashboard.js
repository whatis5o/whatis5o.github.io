/**
 * AFRI-STAY ADMIN - UNIFIED DASHBOARD
 * Features: Authentication, Role-based UI, Navigation, Modals, Data Management
 * 
 * Assumes:
 *  - Supabase client available as global `window.supabaseClient` (via config.js)
 *  - DEMO_MODE can be toggled for testing without real payments
 */

console.log("🚀 [ADMIN] Loading dashboard.js...");

/* ===========================
   CONFIG
   =========================== */
const DEMO_MODE = true; // Set to false for production

/* ═══════════════════════════════════════════════
   EMAILJS CONFIG  — fill in after creating your account at emailjs.com
   See EMAIL_SETUP.md for step-by-step instructions
   ═══════════════════════════════════════════════ */
const EMAILJS_CONFIG = {
    SERVICE_ID:               'service_XXXXXXX',   // EmailJS Dashboard → Email Services → your service ID
    TEMPLATE_BOOKING_REQUEST: 'template_XXXXXXX',  // Template that emails the OWNER on new booking
    TEMPLATE_BOOKING_APPROVED:'template_XXXXXXX',  // Template that emails the BOOKER on approval
    PUBLIC_KEY:               'XXXXXXXXXXXXXXXXXXXX' // EmailJS Dashboard → Account → Public Key
};

console.log("🎯 [ADMIN] Demo mode:", DEMO_MODE ? "ENABLED" : "DISABLED");

// Get Supabase client from window (created by config.js)
let _supabase = null;

// Utility selectors
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// Global state
let CURRENT_USER = null;
let CURRENT_PROFILE = null;
let CURRENT_ROLE = null; // 'admin' | 'owner' | 'user'

/* ===========================
   TOAST NOTIFICATIONS
   =========================== */
function toast(message, type = 'success', duration = 3500) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
        document.body.appendChild(container);
    }
    const cfg = {
        success: { bg: '#2ecc71', icon: 'fa-circle-check' },
        error:   { bg: '#e74c3c', icon: 'fa-circle-xmark' },
        info:    { bg: '#3498db', icon: 'fa-circle-info' },
        warning: { bg: '#f39c12', icon: 'fa-triangle-exclamation' }
    };
    const { bg, icon } = cfg[type] || cfg.info;
    if (!document.getElementById('toastStyle')) {
        const s = document.createElement('style');
        s.id = 'toastStyle';
        s.textContent = `@keyframes slideInT{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}@keyframes fadeOutT{from{opacity:1}to{opacity:0;transform:translateX(60px)}}`;
        document.head.appendChild(s);
    }
    const t = document.createElement('div');
    t.style.cssText = `background:${bg};color:#fff;padding:14px 20px;border-radius:10px;display:flex;align-items:center;gap:12px;font-size:14px;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,0.18);pointer-events:all;min-width:260px;max-width:380px;animation:slideInT 0.3s ease;font-family:'Inter',sans-serif;`;
    t.innerHTML = `<i class="fa-solid ${icon}" style="font-size:18px;flex-shrink:0;"></i><span>${message}</span>`;
    container.appendChild(t);
    setTimeout(() => { t.style.animation = 'fadeOutT 0.3s ease forwards'; setTimeout(() => t.remove(), 350); }, duration);
}
window.toast = toast;

/* ===========================
   INITIALIZATION
   =========================== */
document.addEventListener('DOMContentLoaded', async () => {
    console.log("📱 [ADMIN] DOM loaded, initializing...");
    
    // Step 0: Get Supabase client
    if (window.supabaseClient) {
        _supabase = window.supabaseClient;
        console.log("✅ [ADMIN] Supabase client found!");
    } else {
        console.error("❌ [ADMIN] Supabase client not found! Make sure config.js loaded properly.");
        alert("⚠️ Database connection failed. Check console for details.");
        return;
    }
    
    // Step 1: Re-parent modals and quick actions to body
    reparentModalsAndQuickActions();
    
    // Step 2: Bind all UI interactions
    bindUIInteractions();
    
    // Step 3: Authentication & role-based setup
    await initAuthAndRole();
    
    // Step 4: Load data based on role
    await loadAllCountsAndTables();
    
    // Step 5: Make quick actions visible
    const qa = $('.quick-actions');
    if (qa) {
        qa.style.display = 'flex';
        console.log("✅ [SPECIAL USER] Quick actions initialized");
    }
    
    // Step 6: Show default panel (dashboard)
    togglePanels('dashboardPanel');
    
    console.log("✨ [SPECIAL USER] Initialization complete!");
});

/* ===========================
   DOM REPARENTING
   =========================== */
function injectDashboardStyles() {
    if (document.getElementById('_dashV2Styles')) return;
    const s = document.createElement('style');
    s.id = '_dashV2Styles';
    s.textContent = `
        /* Settings panel centered */
        #settingsPanel .settings-inner,
        #settingsPanel > div:not(.panel-header) {
            max-width: 560px;
            margin-left: auto;
            margin-right: auto;
        }
        /* Users table fixed columns */
        #usersTable th, #usersTable td {
            min-width: 140px;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            vertical-align: middle;
        }
        #usersTable th:first-child, #usersTable td:first-child { min-width:40px;max-width:50px; }
        #usersTable { table-layout: fixed; width: 100%; }
        #usersTable th:nth-child(2), #usersTable td:nth-child(2) { min-width:160px; } /* name */
        #usersTable th:nth-child(3), #usersTable td:nth-child(3) { min-width:200px; } /* email */
        #usersTable th:nth-child(4), #usersTable td:nth-child(4) { min-width:130px; } /* phone */
        #usersTable th:nth-child(5), #usersTable td:nth-child(5) { min-width:100px; } /* role */
        #usersTable th:nth-child(6), #usersTable td:nth-child(6) { min-width:130px; } /* status */
        #usersTable th:nth-child(7), #usersTable td:nth-child(7) { min-width:160px; } /* actions */
        /* Promo price strikethrough on cards */
        .promo-original { text-decoration: line-through; color: #aaa !important; font-size: 14px !important; font-weight: 400 !important; }
        .promo-badge { background:#EB6753;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:6px;vertical-align:middle; }
        /* New bookings container */
        #newBookingsContainer { min-height: 100px; }
    `;
    document.head.appendChild(s);
}

function reparentModalsAndQuickActions() {
    console.log("🔄 [ADMIN] Reparenting modals and quick actions...");
    injectDashboardStyles();
    
    const move = (selector) => {
        const elements = $$(selector);
        console.log(`  Moving ${elements.length} ${selector} elements to body`);
        elements.forEach(node => {
            if (node && node.parentElement !== document.body) {
                document.body.appendChild(node);
            }
        });
    };

    move('.form-modal');
    move('.modal');
    move('.quick-actions');
}

/* ===========================
   UI EVENT BINDINGS
   =========================== */
function bindUIInteractions() {
    console.log("🎛️ [ADMIN] Binding UI interactions...");
    
    const navButtons = $$('.nav-btn');
    const mobileMenuBtn = $('#mobileMenuBtn');
    const sidebar = $('#sidebar');
    const overlay = $('#sidebarOverlay');
    const toggleSidebarBtn = $('#toggleSidebarBtn');
    const quickMainBtn = $('#quickMainBtn');
    const backBtn = $('#backToChats');
    const logoutBtn = $('#logoutBtn');

    console.log("  Found", navButtons.length, "navigation buttons");

    // === Navigation Buttons ===
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            console.log("🔘 [NAV] Clicked tab:", tabName);
            
            if (!tabName) return;
            
            // Handle logout separately
            if (tabName === 'logout' || btn.id === 'logoutBtn') {
                handleLogout();
                return;
            }
            
            // Switch to the selected panel
            togglePanels(`${tabName}Panel`);
            // Auto-load data when switching tabs
            if (tabName === 'listings')         { filterListings(); }
            if (tabName === 'events')           { loadEventsCards(); }
            if (tabName === 'promotions')       { loadPromotionsCards(); }
            if (tabName === 'messages')         { loadMessagesPreview(); }
            if (tabName === 'listing-requests') { loadListingRequests(); }
            if (tabName === 'bookings')         { loadBookingsTable(); }
            
            // Update active states
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Close mobile sidebar
            if (sidebar) sidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
        });
    });

    // === Mobile Menu Toggle ===
    if (mobileMenuBtn && sidebar && overlay) {
        mobileMenuBtn.addEventListener('click', () => {
            console.log("📱 [MOBILE] Toggling menu");
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });
    }

    // === Overlay Click (close sidebar) ===
    if (overlay && sidebar) {
        overlay.addEventListener('click', () => {
            console.log("📱 [MOBILE] Closing sidebar via overlay");
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    // === Desktop Sidebar Collapse ===
    if (toggleSidebarBtn && sidebar) {
        toggleSidebarBtn.addEventListener('click', () => {
            console.log("💻 [DESKTOP] Toggling sidebar collapse");
            sidebar.classList.toggle('collapsed');
        });
    }

    // === Quick Actions Toggle ===
    if (quickMainBtn) {
        quickMainBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log("⚡ [QUICK] Toggling quick actions");
            const qa = $('.quick-actions');
            if (qa) qa.classList.toggle('active');
        });
    }

    // Close quick actions when clicking outside
    document.addEventListener('click', (e) => {
        const qa = $('.quick-actions');
        if (qa && !e.target.closest('.quick-actions') && !e.target.closest('#quickMainBtn')) {
            qa.classList.remove('active');
        }
    });

    // === Modal Close on Overlay Click ===
    $$('.form-modal, .modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log("🚪 [MODAL] Closing via overlay click");
                modal.classList.remove('active');
            }
        });
    });

    // === Create Listing Button ===
    const openCreateListingBtn = $('#openCreateListingBtn');
    if (openCreateListingBtn) {
        openCreateListingBtn.addEventListener('click', () => {
            console.log("➕ [LISTING] Opening create listing modal");
            openModal('listingModal');
        });
    }

    // === Listing Form Submit ===
    const listingForm = $('#listingForm');
    if (listingForm) {
        listingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("📝 [LISTING] Submitting listing form");
            await handleCreateListing();
            closeModal('listingModal');
            await loadListingsTable();
        });
    }

    // === Chat User Items ===
    const chatItems = $$('.chat-user-item');
    const chatHeader = $('#chatWindowHeader');
    
    chatItems.forEach(item => {
        item.addEventListener('click', () => {
            console.log("💬 [CHAT] Selecting chat user");
            chatItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const name = item.querySelector('h4')?.innerText;
            if (chatHeader && name) {
                chatHeader.innerText = name;
            }

            // Mobile: show chat window
            if (window.innerWidth <= 768) {
                const chatWindow = $('.chat-window');
                if (chatWindow) chatWindow.classList.add('active');
            }
        });
    });

    // === Back to Chats (Mobile) ===
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            console.log("⬅️ [CHAT] Back to chats list");
            const chatWindow = $('.chat-window');
            if (chatWindow) chatWindow.classList.remove('active');
        });
    }

    // === Window Resize Handler ===
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            const chatWindow = $('.chat-window');
            if (chatWindow) chatWindow.classList.remove('active');
        }
    });

    // === Event Form Submit ===
    document.getElementById('eventForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleCreateEvent();
    });

    // Promo form submit — modal is now self-built, listener kept harmless
    document.getElementById('promoForm')?.addEventListener('submit', async (e) => { e.preventDefault(); await handleCreatePromo(); });

    // === Settings Form Submit ===
    document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleSaveSettings();
    });

    // === Logout Button ===
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("🚪 [AUTH] Logout button clicked");
            handleLogout();
        });
    }
    const listingSearchInput = document.getElementById('listingSearchInput');

    if (listingSearchInput) {
        listingSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
            e.preventDefault();
            filterListings();
            }
        });
    }
    document.getElementById('searchIcon')?.addEventListener('click', filterListings);
    // Add to bindUIInteractions() after other bindings
    $('#fetchUsersBtn')?.addEventListener('click', () => loadUsersTable());
    const userSearchInput = document.getElementById('userSearchInput');
    if (userSearchInput) {
        let t;
        userSearchInput.addEventListener('input', (e) => {
            clearTimeout(t);
            t = setTimeout(()=> loadUsersTable(e.target.value.trim()), 300); // debounce search
        });
        userSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); loadUsersTable(userSearchInput.value.trim()); }
        });
    }

    // in bindUIInteractions()
    document.getElementById('filterProvince')?.addEventListener('change', async () => { await loadFilterDistricts(); });
    document.getElementById('filterDistrict')?.addEventListener('change', async () => { await loadFilterSectors(); });
    document.getElementById('filterSector')?.addEventListener('change', filterListings);

    // reset filters
    document.getElementById('resetFiltersBtn')?.addEventListener('click', async () => {
        document.getElementById('listingSearchInput').value = '';
        document.getElementById('filterProvince').value = '';
        document.getElementById('filterDistrict').innerHTML = '<option value="">District</option>'; document.getElementById('filterDistrict').disabled = true;
        document.getElementById('filterSector').innerHTML = '<option value="">Sector</option>'; document.getElementById('filterSector').disabled = true;
        await loadFilterProvinces();
        await filterListings();
    });
    // owner search (debounced)
    const ownerSearchEl = document.getElementById('ownerSearch');
    if (ownerSearchEl) {
    let ownerTimer = null;
    ownerSearchEl.addEventListener('input', (e) => {
        clearTimeout(ownerTimer);
        ownerTimer = setTimeout(() => {
        const ev = { target: { value: e.target.value } };
        _searchOwners(ev); // uses your existing _searchOwners implementation
        }, 260);
    });
    }

    // USERS
    $('#fetchUsersBtn')?.addEventListener('click', () => loadUsersTable());
    const userSearch = document.getElementById('userSearchInput');
    if (userSearch) {
    let ut;
    userSearch.addEventListener('input', (e)=> {
        clearTimeout(ut);
        ut = setTimeout(()=> loadUsersTable(e.target.value.trim()), 300);
    });
    userSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); loadUsersTable(userSearch.value.trim()); }
    });
    }

    // LISTINGS filters + search binding
    document.getElementById('searchIcon')?.addEventListener('click', filterListings);
    document.getElementById('listingSearchInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); filterListings(); }
    });

    // load filter selects initially (call after auth)
    loadFilterProvinces();


    console.log("✅ [ADMIN] All UI interactions bound");
}
function updateFormLabels() {
    const cat = document.getElementById('listCategory')?.value;
    const priceLabel = document.getElementById('priceLabel');
    const locationBox = document.querySelector('.location-box');
    const locationInputs = locationBox ? locationBox.querySelectorAll('select, input') : [];

    if (cat === 'vehicle') {
        if (locationBox) {
            locationBox.style.opacity = '0.4';
            locationBox.style.pointerEvents = 'none';
            locationBox.style.position = 'relative';
            // Add overlay label
            let lbl = locationBox.querySelector('.vehicle-note');
            if (!lbl) {
                lbl = document.createElement('p');
                lbl.className = 'vehicle-note';
                lbl.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(235,103,83,0.12);color:var(--primary,#EB6753);font-weight:600;font-size:13px;padding:6px 14px;border-radius:8px;white-space:nowrap;pointer-events:none;';
                lbl.textContent = '📍 Location not required for vehicles';
                locationBox.appendChild(lbl);
            }
        }
        if (priceLabel) priceLabel.innerText = 'Price per Day (RWF)';
        locationInputs.forEach(el => el.removeAttribute('required'));
    } else {
        if (locationBox) {
            locationBox.style.opacity = '';
            locationBox.style.pointerEvents = '';
            const lbl = locationBox.querySelector('.vehicle-note');
            if (lbl) lbl.remove();
        }
        if (priceLabel) priceLabel.innerText = 'Price per Night (RWF)';
    }
}
window.updateFormLabels = updateFormLabels;

// populate filterProvince (for toolbar)
async function loadFilterProvinces() {
    const sel = document.getElementById('filterProvince');
    if (!sel) return;
    sel.innerHTML = '<option value="">Province</option>';
    const { data, error } = await _supabase.from('provinces').select('id, name').order('name');
    if (error) return console.error('loadFilterProvinces', error);
    (data || []).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.text = p.name;
        sel.appendChild(opt);
    });
    sel.disabled = false;
}

// load districts for filter toolbar and auto-trigger filtering
async function loadFilterDistricts() {
    const prov = document.getElementById('filterProvince').value;
    const sel = document.getElementById('filterDistrict');
    sel.innerHTML = '<option value="">District</option>';
    document.getElementById('filterSector').innerHTML = '<option value="">Sector</option>';
    document.getElementById('filterSector').disabled = true;
    if (!prov) { sel.disabled = true; filterListings(); return; }
    const { data, error } = await _supabase.from('districts').select('id, name').eq('province_id', prov).order('name');
    if (error) return console.error('loadFilterDistricts', error);
    (data || []).forEach(d => {
        const opt = document.createElement('option'); opt.value = d.id; opt.text = d.name; sel.appendChild(opt);
    });
    sel.disabled = false;
    // Immediately update listings for province-level selection
    await filterListings();
}

// load sectors for filter toolbar and trigger listings update
async function loadFilterSectors() {
    const dist = document.getElementById('filterDistrict').value;
    const sel = document.getElementById('filterSector');
    sel.innerHTML = '<option value="">Sector</option>';
    if (!dist) { sel.disabled = true; filterListings(); return; }
    const { data, error } = await _supabase.from('sectors').select('id, name').eq('district_id', dist).order('name');
    if (error) return console.error('loadFilterSectors', error);
    (data || []).forEach(s => {
        const opt = document.createElement('option'); opt.value = s.id; opt.text = s.name; sel.appendChild(opt);
    });
    sel.disabled = false;
    await filterListings();
}


/* ===========================
   PANEL SWITCHING
   =========================== */
function togglePanels(panelId) {
    console.log("📄 [PANEL] Switching to:", panelId);
    
    const panels = $$('.content-panel');
    panels.forEach(p => p.classList.remove('active'));
    
    const target = document.getElementById(panelId);
    if (target) {
        target.classList.add('active');
        console.log("✅ [PANEL] Panel activated:", panelId);
    } else {
        console.warn("⚠️ [PANEL] Panel not found:", panelId);
    }
}

/* ===========================
   MODAL MANAGEMENT
   =========================== */
function openModal(modalId) {
    console.log("🔓 [MODAL] Opening:", modalId);
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    } else {
        console.warn("⚠️ [MODAL] Modal not found:", modalId);
    }
}

function closeModal(modalId) {
    console.log("🔒 [MODAL] Closing:", modalId);
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

/* ===========================
   AUTHENTICATION & ROLE
   =========================== */
async function initAuthAndRole() {
    console.log("🔐 [AUTH] Initializing authentication...");
    
    try {
        const { data: userData, error: userErr } = await _supabase.auth.getUser();
        
        if (userErr) {
            console.error("❌ [AUTH] Error getting user:", userErr);
            applyRoleToUI(null);
            return;
        }
        
        const user = userData?.user;
        if (!user) {
            console.warn("⚠️ [AUTH] No logged-in user detected");
            applyRoleToUI(null);
            return;
        }

        CURRENT_USER = user;
        console.log("✅ [AUTH] User authenticated:", user.email);
        
        // Fetch profile
        const { data: profile, error: pErr } = await _supabase
            .from('profiles')
            .select('id, full_name, email, role, avatar_seed')
            .eq('id', user.id)
            .single();

        if (pErr) {
            console.error("❌ [AUTH] Failed to load profile:", pErr);
            applyRoleToUI(null);
            return;
        }

        CURRENT_PROFILE = profile;
        CURRENT_ROLE = (profile.role || 'user');
        console.log("✅ [AUTH] Profile loaded. Role:", CURRENT_ROLE);

        // place inside initAuthAndRole() after CURRENT_ROLE set
        if (CURRENT_ROLE !== 'admin' && CURRENT_ROLE !== 'owner') {
        console.warn('Not an admin/owner — redirecting from dashboard');
        // friendly message then redirect
        alert('You do not have permission to access the dashboard.');
        window.location.href = '/index.html';
        return;
        }


        // Update UI with user info
        const adminName = $('#adminName');
        const adminEmailDisplay = $('#adminEmailDisplay');
        const adminAvatar = $('#adminAvatar');

        if (adminName) adminName.innerText = profile.full_name || "No name";
        if (adminEmailDisplay) adminEmailDisplay.innerText = profile.email || user.email || '';
        if (adminAvatar && profile.full_name) {
            adminAvatar.innerText = initials(profile.full_name);
        }

        // Apply role-based UI
        applyRoleToUI(CURRENT_ROLE);

    } catch (err) {
        console.error("❌ [AUTH] Exception in initAuthAndRole:", err);
        applyRoleToUI(null);
    }
    await populatePromoListings();
    // after initAuthAndRole() finishes
    await loadFilterProvinces();

    await loadProvinces();
    await loadDistricts();
    await loadSectors();
}


async function deleteListing(listingId) {
    if (!confirm('Delete this listing permanently? This also removes media.')) return;
    try {
        const { error } = await _supabase.from('listings').delete().eq('id', listingId);
        if (error) throw error;
        toast('Listing deleted successfully.', 'success');
        await filterListings();
        await loadCounts();
    } catch (err) {
        console.error('deleteListing', err);
        toast('Failed to delete listing: ' + err.message, 'error');
    }
}


function initials(name) {
    return name.split(' ').map(s => s[0]?.toUpperCase() || '').slice(0, 2).join('');
}

// change role in profiles table
async function updateUserRole(userId, newRole) {
    if (!confirm(`Change role to "${newRole}" for this user?`)) return;
    try {
        const { error } = await _supabase.from('profiles').update({ role: newRole }).eq('id', userId);
        if (error) throw error;
        toast('Role updated successfully.', 'success');
        await loadUsersTable();
    } catch (err) {
        console.error('updateUserRole', err);
        toast('Failed to update role: ' + (err.message || JSON.stringify(err)), 'error');
    }
}

async function toggleUserBan(userId, action) {
    try {
        const banned = action === 'banned';
        const { error } = await _supabase.from('profiles').update({ banned }).eq('id', userId);
        if (error) throw error;
        toast(banned ? 'User banned.' : 'User unbanned.', banned ? 'warning' : 'success');
        await loadUsersTable();
    } catch (err) {
        console.error('toggleUserBan', err);
        toast('Failed to change user status.', 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('Delete this user and profile? This is permanent.')) return;
    try {
        const { error } = await _supabase.from('profiles').delete().eq('id', userId);
        if (error) throw error;
        toast('User profile deleted.', 'success');
        await loadUsersTable();
        await loadCounts();
    } catch (err) {
        console.error('deleteUser', err);
        toast('Failed to delete user: ' + (err.message || JSON.stringify(err)), 'error');
    }
}

// expose globally (so inline onclick can call them)
window.updateUserRole = updateUserRole;
window.toggleUserBan = toggleUserBan;
window.deleteUser = deleteUser;


/* ===========================
   ROLE-BASED UI CONTROL
   =========================== */
function applyRoleToUI(role) {
    console.log("🎭 [ROLE] Applying role-based UI for:", role || "GUEST");
    
    // Helper functions
    const show = (tabName) => {
        const btn = $(`.nav-btn[data-tab="${tabName}"]`);
        if (btn) {
            btn.style.display = '';
            console.log(`  👁️ Showing tab: ${tabName}`);
        }
    };
    
    const hide = (tabName) => {
        const btn = $(`.nav-btn[data-tab="${tabName}"]`);
        if (btn) {
            btn.style.display = 'none';
            console.log(`  🙈 Hiding tab: ${tabName}`);
        }
    };

    // Reset: show basic tabs
    ['dashboard', 'listings', 'bookings', 'messages', 'settings'].forEach(t => show(t));
    
    // Hide advanced tabs by default
    hide('users');
    hide('events');
    hide('promotions');

    const createListingBtn = $('#openCreateListingBtn');
    const quickMenu = $('#quickMenu');

    // No role (not logged in)
    if (!role) {
        console.log("  🚫 No role - limiting UI");
        hide('bookings');
        hide('messages');
        if (createListingBtn) createListingBtn.style.display = 'none';
        if (quickMenu) quickMenu.querySelectorAll('button').forEach(b => b.style.display = 'none');
        return;
    }

    // ADMIN: sees everything
    if (role === 'admin') {
        console.log("  👑 ADMIN role - showing all features");
        ['users', 'events', 'promotions', 'messages', 'listing-requests'].forEach(t => show(t));
        if (createListingBtn) createListingBtn.style.display = '';
        if (quickMenu) quickMenu.querySelectorAll('button').forEach(b => b.style.display = '');
        // Inject listing-requests nav button if not in HTML
        injectListingRequestsTab();
    } 
    // OWNER: manages listings and bookings
    else if (role === 'owner') {
        console.log("  🏠 OWNER role - showing owner features");
        show('listings');
        show('bookings');
        hide('messages');
        hide('users');
        hide('promotions');
        hide('events');
        // Relabel stat cards for owner
        const userLbl = document.querySelector('#totalUsers')?.closest('.stat-card')?.querySelector('.stat-label, .stat-lbl, p, [class*=label]');
        if (userLbl) userLbl.textContent = 'Total Clients';
        const revLbl = document.querySelector('#totalRevenue')?.closest('.stat-card')?.querySelector('.stat-label, .stat-lbl, p, [class*=label]');
        if (revLbl) revLbl.textContent = 'My Revenue';
        
        if (createListingBtn) createListingBtn.style.display = '';
        
        if (quickMenu) {
            quickMenu.querySelectorAll('button').forEach(b => {
                const txt = b.innerText.toLowerCase();
                if (txt.includes('listing')) {
                    b.style.display = '';
                } else {
                    b.style.display = 'none';
                }
            });
        }
    } 
    // USER: minimal access
    else if (role === 'user') {
        console.log("  👤 USER role - showing user features");
        show('dashboard');
        show('bookings');
        show('messages');
        hide('listings');
        hide('users');
        hide('events');
        hide('promotions');
        
        if (createListingBtn) createListingBtn.style.display = 'none';
        if (quickMenu) quickMenu.querySelectorAll('button').forEach(b => b.style.display = 'none');
    }
}

/* ===========================
   DATA LOADING
   =========================== */
// add near other filters
async function filterListings() {
    const qtext = (document.getElementById('listingSearchInput')?.value || '').trim();
    const province = document.getElementById('filterProvince')?.value;
    const district = document.getElementById('filterDistrict')?.value;
    const sector = document.getElementById('filterSector')?.value;

    // call a more generic listing loader with filters
    await loadListingsGrid({ qtext, province, district, sector });
    }

    // bind Enter to search input (add this in bindUIInteractions())
    const listingSearchInput = document.getElementById('listingSearchInput');
    if (listingSearchInput) {
    listingSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
        e.preventDefault();
        filterListings();
        }
    });
}
// call this from filterListings() or loadListingsTable() when you want grid
async function loadListingsGrid(filters = {}) {
    const container = document.getElementById('listingsGrid');
    if (!container) return;
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    container.innerHTML = '<div style="padding:20px;grid-column:1/-1">Loading...</div>';

    // Build query — no thumbnail_url column
    let q = _supabase
        .from('listings')
        .select('id,title,price,currency,availability_status,status,owner_id,province_id,district_id,sector_id,category_slug,created_at')
        .order('created_at', { ascending: false })
        .limit(200);

    if (filters.qtext) q = q.ilike('title', `%${filters.qtext}%`);
    if (filters.province) q = q.eq('province_id', filters.province);
    if (filters.district) q = q.eq('district_id', filters.district);
    if (filters.sector) q = q.eq('sector_id', filters.sector);
    if (filters.category) q = q.eq('category_slug', filters.category);

    // owner filter for role
    if (CURRENT_ROLE === 'owner') q = q.eq('owner_id', CURRENT_PROFILE.id);

    const { data, error } = await q;
    if (error) { container.innerHTML = `<div style="padding:20px;color:red">Error: ${error.message}</div>`; return; }
    if (!data || data.length === 0) { container.innerHTML = '<div style="padding:20px">No listings match.</div>'; return; }

    // Batch-fetch first image per listing
    const listingIds = data.map(l => l.id);
    const { data: allImages } = await _supabase.from('listing_images').select('listing_id,image_url').in('listing_id', listingIds);
    const imageMap = {};
    (allImages || []).forEach(img => { if (!imageMap[img.listing_id]) imageMap[img.listing_id] = img.image_url; });

    // Fetch owner names
    const ownerIds = [...new Set(data.map(l => l.owner_id).filter(Boolean))];
    const ownerMap = {};
    if (ownerIds.length) {
        const { data: owners } = await _supabase.from('profiles').select('id,full_name').in('id', ownerIds);
        (owners || []).forEach(o => ownerMap[o.id] = o.full_name);
    }

    container.innerHTML = '';
    for (const l of data) {
        const thumb = imageMap[l.id] || null;
        const availBadgeColor = l.availability_status === 'available' ? '#2ecc71' : l.availability_status === 'booked' ? '#e74c3c' : '#95a5a6';
        const statusBadgeColor = l.status === 'approved' ? '#2ecc71' : l.status === 'pending' ? '#f39c12' : '#95a5a6';
        const card = document.createElement('div');
        card.className = 'listing-card';
        card.style.cssText = 'background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);display:flex;flex-direction:column;';
        card.innerHTML = `
            <a href="detail.html?id=${l.id}" style="text-decoration:none;color:inherit;display:block;">
                <div style="height:180px;background:#f0f0f0;overflow:hidden;position:relative;">
                    ${thumb
                        ? `<img src="${thumb}" alt="${escapeHtml(l.title)}" style="width:100%;height:100%;object-fit:cover;">`
                        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-image" style="font-size:32px;color:#ccc;"></i></div>`}
                    <span style="position:absolute;top:8px;left:8px;background:${availBadgeColor};color:#fff;font-size:11px;padding:3px 8px;border-radius:20px;font-weight:600;">${l.availability_status || 'available'}</span>
                    <span style="position:absolute;top:8px;right:8px;background:${statusBadgeColor};color:#fff;font-size:11px;padding:3px 8px;border-radius:20px;font-weight:600;">${l.status || 'pending'}</span>
                </div>
            </a>
            <div style="padding:14px;flex:1;display:flex;flex-direction:column;gap:6px;">
                <a href="detail.html?id=${l.id}" style="text-decoration:none;"><h4 style="margin:0;font-size:15px;font-weight:600;color:#222;">${escapeHtml(l.title)}</h4></a>
                <p style="margin:0;color:#888;font-size:13px;">${l.category_slug || ''} • ${ownerMap[l.owner_id] || 'Unknown'}</p>
                <p style="margin:0;color:var(--primary,#EB6753);font-weight:700;font-size:14px;">${Number(l.price).toLocaleString()} ${l.currency || 'RWF'}</p>
                <div style="display:flex;gap:8px;margin-top:auto;padding-top:10px;flex-wrap:wrap;">
                    ${CURRENT_ROLE === 'admin' ? `
                        <button class="btn-small" onclick="approveListing('${l.id}')" style="flex:1"><i class="fa-solid fa-check"></i> Approve</button>
                        <button class="btn-small" onclick="toggleListingAvailability('${l.id}','${l.availability_status}')" style="flex:1">${l.availability_status === 'available' ? '<i class="fa-solid fa-eye-slash"></i> Disable' : '<i class="fa-solid fa-eye"></i> Enable'}</button>
                        <button class="btn-small btn-danger" onclick="deleteListing('${l.id}')" style="flex:1"><i class="fa-solid fa-trash"></i> Delete</button>
                    ` : ''}
                    ${CURRENT_ROLE === 'owner' && l.availability_status !== 'booked' ? `
                        <button class="btn-small" onclick="toggleListingAvailability('${l.id}','${l.availability_status}')" style="flex:1">${l.availability_status === 'available' ? 'Set Unavailable' : 'Set Available'}</button>
                    ` : ''}
                </div>
            </div>
        `;
        container.appendChild(card);
    }
}


async function loadAllCountsAndTables() {
    console.log("📊 [DATA] Loading all data...");
    await Promise.all([
        loadCounts(),
        loadListingsTable(),
        loadBookingsTable(),
        loadUsersTable(),
        loadEventsCards(),
        loadPromotionsCards(),
        loadMessagesPreview()
    ]);
    // Owner-specific: load new (pending) bookings panel
    if (CURRENT_ROLE === 'owner') {
        loadNewBookings();
    }
    // Admin: inject listing-requests tab
    if (CURRENT_ROLE === 'admin') {
        loadListingRequests();
    }
    console.log("✅ [DATA] All data loaded");
}

async function loadCounts() {
    console.log("🔢 [COUNTS] Loading dashboard counts...");
    
    try {
        if (!CURRENT_ROLE) {
            console.log("  No role - showing zeros");
            setCount('#totalUsers', 0);
            setCount('#totalListings', 0);
            setCount('#totalBookings', 0);
            setCount('#totalRevenue', '0 RWF');
            return;
        }

        if (CURRENT_ROLE === 'admin') {
            console.log("  Loading admin counts...");
            const { count: usersCount, error: e1 } = await _supabase.from('profiles').select('id', { count: 'exact', head: true });
            if (e1) console.error("Error counting users:", e1);
            
            const { count: listingsCount, error: e2 } = await _supabase.from('listings').select('id', { count: 'exact', head: true });
            if (e2) console.error("Error counting listings:", e2);
            
            const { count: bookingsCount, error: e3 } = await _supabase.from('bookings').select('id', { count: 'exact', head: true });
            if (e3) console.error("Error counting bookings:", e3);
            
            // Admin total revenue = sum of all approved bookings
            const { data: revRows } = await _supabase
                .from('bookings')
                .select('total_amount')
                .in('status', ['approved', 'completed']);
            const adminRevenue = (revRows || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);

            setCount('#totalUsers', usersCount || 0);
            setCount('#totalListings', listingsCount || 0);
            setCount('#totalBookings', bookingsCount || 0);
            setCount('#totalRevenue', Number(adminRevenue).toLocaleString('en-RW') + ' RWF');
        } 
        else if (CURRENT_ROLE === 'owner') {
            console.log("  Loading owner counts...");
            const { count: listingsCount } = await _supabase
                .from('listings')
                .select('id', { count: 'exact', head: true })
                .eq('owner_id', CURRENT_PROFILE.id);

            const listingIds = await fetchOwnerListingIds();
            const safeIds = listingIds.length ? listingIds : ['00000000-0000-0000-0000-000000000000'];

            // Total unique clients (distinct user_ids who have ever booked)
            const { data: clientRows } = await _supabase
                .from('bookings')
                .select('user_id')
                .in('listing_id', safeIds);
            const uniqueClients = new Set((clientRows || []).map(r => r.user_id)).size;

            // Total bookings
            const { count: bookingsCount } = await _supabase
                .from('bookings')
                .select('id', { count: 'exact', head: true })
                .in('listing_id', safeIds);

            // Total revenue (sum of approved bookings)
            const { data: revenueRows } = await _supabase
                .from('bookings')
                .select('total_amount')
                .in('listing_id', safeIds)
                .in('status', ['approved', 'completed']);
            const totalRevenue = (revenueRows || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);

            setCount('#totalUsers', uniqueClients);
            setCount('#totalListings', listingsCount || 0);
            setCount('#totalBookings', bookingsCount || 0);
            setCount('#totalRevenue', Number(totalRevenue).toLocaleString('en-RW') + ' RWF');
            console.log(`  Owner stats: ${uniqueClients} clients, ${listingsCount} listings, ${totalRevenue} RWF`);
        } 
        else {
            console.log("  Loading user counts...");
            const { count: bookingsCount, error: e1 } = await _supabase
                .from('bookings')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', CURRENT_PROFILE.id);
            if (e1) console.error("Error counting user bookings:", e1);
            
            setCount('#totalUsers', 0);
            setCount('#totalListings', 0);
            setCount('#totalBookings', bookingsCount || 0);
            setCount('#totalRevenue', '0 RWF');
        }
        
        console.log("✅ [COUNTS] Dashboard counts updated");
    } catch (err) {
        console.error("❌ [COUNTS] Error loading counts:", err);
    }
}

function setCount(selector, value) {
    const el = $(selector);
    if (el) {
        el.innerText = value;
        console.log(`  📝 Set ${selector} = ${value}`);
    }
}

async function fetchOwnerListingIds() {
    if (!CURRENT_PROFILE) return [];
    const { data, error } = await _supabase
        .from('listings')
        .select('id')
        .eq('owner_id', CURRENT_PROFILE.id);
    
    if (error) {
        console.error("Error fetching owner listing IDs:", error);
        return [];
    }
    return data.map(r => r.id);
}
// Add this helper (requires UTILS.debounce if you have it, otherwise simple debounce inline)
window.searchOwners = _searchOwners;

async function _searchOwners(e) {
    const q = (e.target.value || '').trim();
    const resultsEl = document.getElementById('ownerResults');
    if (!resultsEl) return;

    if (!q || q.length < 2) {
        resultsEl.style.display = 'none';
        return;
    }

    // query profiles where role = owner and name matches (case-insensitive)
    const { data, error } = await _supabase
        .from('profiles')
        .select('id, full_name, email')
        .ilike('full_name', `%${q}%`)
        .limit(10);

    if (error) {
        console.error('owner search error', error);
        resultsEl.style.display = 'none';
        return;
    }

    resultsEl.innerHTML = '';
    (data || []).forEach(u => {
        const row = document.createElement('div');
        row.className = 'search-result-item';
        row.innerText = `${u.full_name} — ${u.email || ''}`;
        row.onclick = () => {
        document.getElementById('selectedOwnerId').value = u.id;
        document.getElementById('selectedOwnerName').innerText = `Assigned to: ${u.full_name}`;
        resultsEl.style.display = 'none';
        document.getElementById('ownerSearch').value = u.full_name;
        };
        resultsEl.appendChild(row);
    });

    resultsEl.style.display = (data && data.length) ? 'block' : 'none';
}


// Call loadProvinces() after initAuthAndRole() completes
async function loadProvinces() {
    const sel = document.getElementById('selProvince');
    if (!sel) return;
    sel.innerHTML = '<option value="">Province</option>';
    const { data, error } = await _supabase.from('provinces').select('id, name').order('name');
    if (error) { console.error('loadProvinces', error); return; }
    (data||[]).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.text = p.name;
        sel.appendChild(opt);
    });
    sel.disabled = false;
}

// loadDistricts uses currently selected province
async function loadDistricts() {
    const prov = document.getElementById('selProvince').value;
    const sel = document.getElementById('selDistrict');
    const sectorSel = document.getElementById('selSector');
    sel.innerHTML = '<option value="">District</option>';
    sectorSel.innerHTML = '<option value="">Sector</option>'; sectorSel.disabled = true;

    if (!prov) { sel.disabled = true; return; }

    const { data, error } = await _supabase.from('districts').select('id, name, province_id').eq('province_id', prov).order('name');
    if (error) { console.error('loadDistricts', error); return; }
    (data||[]).forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.text = d.name;
        sel.appendChild(opt);
    });
    sel.disabled = false;
}

// loadSectors uses selected district
async function loadSectors() {
    const dist = document.getElementById('selDistrict').value;
    const sel = document.getElementById('selSector');
    sel.innerHTML = '<option value="">Sector</option>';
    if (!dist) { sel.disabled = true; return; }

    const { data, error } = await _supabase.from('sectors').select('id, name, district_id').eq('district_id', dist).order('name');
    if (error) { console.error('loadSectors', error); return; }
    (data||[]).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.text = s.name;
        sel.appendChild(opt);
    });
    sel.disabled = false;
}


/* ===========================
   LISTINGS TABLE
   =========================== */
async function loadListingsTable() {
    console.log("📋 [LISTINGS] Loading listings table...");
    
    const tbody = $('#listingsTableBody');
    if (!tbody) {
        console.warn("⚠️ [LISTINGS] Table body not found");
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';

    try {
        let q = _supabase.from('listings').select('id, title, price, currency, status, availability_status, owner_id, created_at');

        if (CURRENT_ROLE === 'owner') {
            console.log("  Filtering for owner listings only");
            q = q.eq('owner_id', CURRENT_PROFILE.id);
        } else if (CURRENT_ROLE === 'user') {
            console.log("  User has no permission to manage listings");
            tbody.innerHTML = '<tr><td colspan="7">You do not have permission to manage listings.</td></tr>';
            return;
        }

        const { data, error } = await q.order('created_at', { ascending: false }).limit(200);
        
        if (error) {
            console.error("❌ [LISTINGS] Error loading listings:", error);
            tbody.innerHTML = `<tr><td colspan="7">Error: ${error.message}</td></tr>`;
            return;
        }

        if (!data || data.length === 0) {
            console.log("  No listings found");
            tbody.innerHTML = '<tr><td colspan="7">No listings found.</td></tr>';
            return;
        }

        console.log(`  Found ${data.length} listings`);

        // Fetch owner names
        const ownerIds = Array.from(new Set(data.map(d => d.owner_id).filter(Boolean)));
        const ownersMap = {};
        
        if (ownerIds.length) {
            const { data: owners } = await _supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', ownerIds);
            
            (owners || []).forEach(o => ownersMap[o.id] = o.full_name);
        }

        tbody.innerHTML = '';
        data.forEach((row, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}.</td>
                <td><img src="/assets/img/placeholder.png" alt="" style="width:60px;height:40px;object-fit:cover;border-radius:6px;"></td>
                <td>${escapeHtml(row.title)}</td>
                <td>${row.price} ${row.currency}</td>
                <td>${row.availability_status || 'available'}</td>
                <td>${ownersMap[row.owner_id] || shortId(row.owner_id)}</td>
                <td>
                    ${CURRENT_ROLE === 'admin' ? `<button class="btn-small" onclick="approveListing('${row.id}')">Approve</button>` : ''}
                    ${CURRENT_ROLE === 'owner' && row.availability_status !== 'booked' ? `<button class="btn-small" onclick="toggleListingAvailability('${row.id}', '${row.availability_status}')">
                        ${row.availability_status === 'available' ? 'Set Unavailable' : 'Set Available'}
                    </button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });

        console.log("✅ [LISTINGS] Table populated");

    } catch (err) {
        console.error("❌ [LISTINGS] Exception:", err);
        tbody.innerHTML = '<tr><td colspan="7">Failed to load listings</td></tr>';
    }
}

/* ===========================
   BOOKINGS TABLE
   =========================== */
async function loadBookingsTable() {
    console.log("📅 [BOOKINGS] Loading bookings table...");
    
    const tbody = $('#allBookingsBody');
    if (!tbody) {
        console.warn("⚠️ [BOOKINGS] Table body not found");
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';

    try {
        let q = _supabase.from('bookings').select('id, listing_id, start_date, end_date, total_amount, status, user_id, created_at');

        if (CURRENT_ROLE === 'owner') {
            console.log("  Filtering for owner's listing bookings");
            const listingIds = await fetchOwnerListingIds();
            if (!listingIds.length) {
                tbody.innerHTML = '<tr><td colspan="7">No bookings for your listings.</td></tr>';
                return;
            }
            q = q.in('listing_id', listingIds);
        } else if (CURRENT_ROLE === 'user') {
            console.log("  Filtering for user's bookings");
            q = q.eq('user_id', CURRENT_PROFILE.id);
        }

        const { data, error } = await q.order('created_at', { ascending: false }).limit(200);
        
        if (error) {
            console.error("❌ [BOOKINGS] Error loading bookings:", error);
            tbody.innerHTML = `<tr><td colspan="7">Error: ${error.message}</td></tr>`;
            return;
        }

        if (!data || data.length === 0) {
            console.log("  No bookings found");
            tbody.innerHTML = '<tr><td colspan="7">No bookings found.</td></tr>';
            return;
        }

        console.log(`  Found ${data.length} bookings`);

        tbody.innerHTML = '';
        
        for (let i = 0; i < data.length; i++) {
            const r = data[i];
            
            const { data: listing } = await _supabase
                .from('listings')
                .select('title, owner_id')
                .eq('id', r.listing_id)
                .maybeSingle();
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${i + 1}.</td>
                <td>${shortId(r.id)}</td>
                <td>${escapeHtml(listing?.title || '—')}</td>
                <td>${shortId(r.user_id)}</td>
                <td>${r.start_date} → ${r.end_date}</td>
                <td>${r.total_amount}</td>
                <td>
                    <span class="status-badge status-${r.status}">${r.status}</span>
                    ${(CURRENT_ROLE === 'owner' && listing?.owner_id === CURRENT_PROFILE.id && r.status === 'pending') ? `
                        <button class="btn-small" style="background:#e8f8f0;color:#27ae60;border:1px solid #b8e6ce;" onclick="approveBooking('${r.id}')"><i class="fa-solid fa-check"></i> Approve</button>
                        <button class="btn-small" style="background:#fde8e8;color:#e74c3c;border:1px solid #f5c6c6;" onclick="rejectBooking('${r.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>
                    ` : ''}
                    ${r.status === 'approved' ? 
                        `<button class="btn-small" style="background:#f0f9ff;color:#3498db;border:1px solid #d0e8f8;" onclick="downloadReceipt('${r.id}')"><i class="fa-solid fa-download"></i> Receipt</button>` : ''}
                    ${DEMO_MODE && (CURRENT_ROLE === 'admin' || (CURRENT_ROLE === 'owner' && listing?.owner_id === CURRENT_PROFILE.id)) ? 
                        `<button class="btn-small" onclick="demoMarkPaid('${r.id}')">Mark Paid (demo)</button>` : ''}
                </td>
            `;
            tbody.appendChild(row);
        }

        console.log("✅ [BOOKINGS] Table populated");

    } catch (err) {
        console.error("❌ [BOOKINGS] Exception:", err);
        tbody.innerHTML = '<tr><td colspan="7">Failed to load bookings</td></tr>';
    }
}

/* ===========================
   USERS TABLE
   =========================== */
// REPLACE existing loadUsersTable() with this
async function loadUsersTable(searchTerm = '') {
    console.log("👥 [USERS] Loading users table (search:", searchTerm || 'none', ")");

    const tbody = $('#usersTableBody');
    if (!tbody) return;

    if (CURRENT_ROLE !== 'admin') {
        tbody.innerHTML = '<tr><td colspan="8">Only admins can manage users.</td></tr>';
        return;
    }

    tbody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';

    try {
        let q = _supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, banned')
        .order('created_at', { ascending: false })
        .limit(500);

        if (searchTerm && searchTerm.length > 0) {
        // search both name and email
        q = q.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }

        const { data, error } = await q;
        if (error) {
        console.error('[USERS] error', error);
        tbody.innerHTML = `<tr><td colspan="8">Error: ${error.message}</td></tr>`;
        return;
        }
        if (!data || !data.length) {
        tbody.innerHTML = '<tr><td colspan="8">No users found.</td></tr>';
        return;
        }

        tbody.innerHTML = '';
        data.forEach((u, i) => {
        const tr = document.createElement('tr');

        // role dropdown and action dropdown html
        const roleSelectHtml = `
            <select class="status-select" onchange="updateUserRole('${u.id}', this.value)">
            <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
            <option value="owner" ${u.role === 'owner' ? 'selected' : ''}>owner</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
            </select>
        `;

        const isBanned = u.banned === true;
        const actionSelectHtml = `
            <select class="status-select" onchange="toggleUserBan('${u.id}', this.value)">
            <option value="active" ${!isBanned ? 'selected' : ''}>active</option>
            <option value="banned" ${isBanned ? 'selected' : ''}>ban</option>
            </select>
        `;

        tr.innerHTML = `
            <td>${i + 1}.</td>
            <td>${escapeHtml(u.full_name || '')}</td>
            <td>${escapeHtml(u.email || '')}</td>
            <td>${escapeHtml(u.phone || '')}</td>
            <td>${roleSelectHtml}</td>
            <td>-</td>
            <td>${actionSelectHtml}</td>
            <td>
            <button class="btn-small btn-danger" onclick="deleteUser('${u.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
        });

        console.log("✅ [USERS] Table populated");
    } catch (err) {
        console.error('❌ [USERS] Exception:', err);
        tbody.innerHTML = '<tr><td colspan="8">Failed to load users</td></tr>';
    }
}



/* ===========================
   MESSAGES PANEL
   =========================== */
async function loadMessagesPreview() {
    console.log("💬 [MESSAGES] Loading messages...");
    const list = $('#chatUserList');
    if (!list) return;
    list.innerHTML = '<div style="padding:16px;color:#999;">Loading...</div>';

    if (!CURRENT_ROLE || CURRENT_ROLE !== 'admin') {
        list.innerHTML = '<div style="padding:16px;color:#999;">Admin access only.</div>';
        return;
    }

    const { data, error } = await _supabase
        .from('contact_messages')
        .select('id, name, email, message, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) { list.innerHTML = `<div style="padding:16px;color:red;">${error.message}</div>`; return; }
    if (!data || !data.length) { list.innerHTML = '<div style="padding:16px;color:#999;">No messages yet.</div>'; return; }

    // Seed the right pane with the first message
    list.innerHTML = '';
    data.forEach((m, i) => {
        const el = document.createElement('div');
        el.className = 'chat-user-item' + (i === 0 ? ' active' : '');
        el.dataset.id = m.id;
        const preview = (m.message || '').slice(0, 60) + ((m.message || '').length > 60 ? '…' : '');
        el.innerHTML = `
            <div class="chat-user-avatar" style="background:var(--primary);color:#fff;font-weight:700;">${escapeHtml((m.name || 'U')[0].toUpperCase())}</div>
            <div class="chat-user-info">
                <h4>${escapeHtml(m.name || 'Unknown')}</h4>
                <p style="color:#999;font-size:12px;">${escapeHtml(preview)}</p>
            </div>
        `;
        el.addEventListener('click', () => {
            $$('.chat-user-item').forEach(x => x.classList.remove('active'));
            el.classList.add('active');
            showMessageDetail(m);
            // Mobile: show right pane
            const cw = $('.chat-window');
            if (cw && window.innerWidth <= 768) cw.classList.add('active');
        });
        list.appendChild(el);
    });

    // Auto-show first message
    if (data.length) showMessageDetail(data[0]);
    console.log("✅ [MESSAGES] Loaded", data.length, "messages");
}

function showMessageDetail(m) {
    const area = $('#chatMessagesArea');
    if (!area) return;
    const date = m.created_at ? new Date(m.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(m.email || '')}&su=${encodeURIComponent('Re: Your message to AfriStay')}&body=${encodeURIComponent('Hi ' + (m.name || '') + ',\n\nThank you for reaching out to AfriStay!\n\n')}`;
    const mailtoUrl = `mailto:${encodeURIComponent(m.email || '')}?subject=${encodeURIComponent('Re: Your message to AfriStay')}&body=${encodeURIComponent('Hi ' + (m.name || '') + ',\n\n')}`;

    area.innerHTML = `
        <div style="padding:28px;max-width:680px;">
            <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:24px;">
                <div style="width:52px;height:52px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;flex-shrink:0;">
                    ${escapeHtml((m.name || 'U')[0].toUpperCase())}
                </div>
                <div style="flex:1;">
                    <h3 style="margin:0 0 4px;font-size:18px;color:#1a1a1a;">${escapeHtml(m.name || 'Unknown')}</h3>
                    <p style="margin:0;color:#888;font-size:13px;display:flex;align-items:center;gap:6px;">
                        <i class="fa-solid fa-envelope" style="color:var(--primary);font-size:12px;"></i>
                        <a href="mailto:${escapeHtml(m.email || '')}" style="color:var(--primary);text-decoration:none;">${escapeHtml(m.email || '')}</a>
                    </p>
                    <p style="margin:4px 0 0;color:#bbb;font-size:12px;"><i class="fa-regular fa-clock" style="margin-right:4px;"></i>${date}</p>
                </div>
                <div style="display:flex;gap:8px;flex-shrink:0;">
                    <a href="${gmailUrl}" target="_blank" class="btn-small" style="display:flex;align-items:center;gap:6px;text-decoration:none;background:var(--primary);color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;">
                        <i class="fa-solid fa-reply"></i> Reply via Gmail
                    </a>
                    <a href="${mailtoUrl}" class="btn-small" style="display:flex;align-items:center;gap:6px;text-decoration:none;background:#f0f0f0;color:#555;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;">
                        <i class="fa-solid fa-envelope"></i> Email Client
                    </a>
                </div>
            </div>
            <div style="background:#f8f8f8;border-radius:16px;padding:24px;border-left:4px solid var(--primary);">
                <p style="font-size:15px;line-height:1.8;color:#333;margin:0;white-space:pre-wrap;">${escapeHtml(m.message || '')}</p>
            </div>
        </div>
    `;
    const header = $('#chatWindowHeader');
    if (header) header.textContent = m.name || 'Message';
}

/* ===========================
   ACTIONS
   =========================== */
async function approveListing(listingId) {
    console.log("✅ [ACTION] Approving listing:", listingId);
    if (!confirm('Approve this listing?')) return;
    try {
        const { error } = await _supabase
            .from('listings')
            .update({ status: 'approved' })
            .eq('id', listingId);
        if (error) throw error;
        toast('Listing approved successfully!', 'success');
        await filterListings();
    } catch (err) {
        console.error("❌ [ACTION] Error approving listing:", err);
        toast('Failed to approve listing: ' + err.message, 'error');
    }
}

async function toggleListingAvailability(listingId, current) {
    console.log("🔄 [ACTION] Toggling listing availability:", listingId, current);
    try {
        const newStatus = (current === 'available') ? 'unavailable' : 'available';
        const { error } = await _supabase
            .from('listings')
            .update({ availability_status: newStatus })
            .eq('id', listingId);
        if (error) throw error;
        toast(`Listing set to "${newStatus}"`, 'success');
        await filterListings();
    } catch (err) {
        console.error("❌ [ACTION] Error toggling availability:", err);
        toast('Failed to change availability: ' + err.message, 'error');
    }
}

async function approveBooking(bookingId) {
    console.log("✅ [ACTION] Approving booking:", bookingId);
    if (!confirm('Approve this booking? The guest will be notified by email with a receipt.')) return;

    toast('Approving booking...', 'info');

    try {
        // 1. Mark booking approved in DB
        const { error } = await _supabase
            .from('bookings')
            .update({ status: 'approved' })
            .eq('id', bookingId);
        if (error) throw error;

        // 2. Email booker via EmailJS
        try {
            // Fetch all details needed for the email
            const { data: booking }  = await _supabase.from('bookings').select('*').eq('id', bookingId).single();
            const { data: listing }  = await _supabase.from('listings').select('title,price,currency,address,province_id,district_id,owner_id').eq('id', booking.listing_id).single();
            const { data: booker }   = await _supabase.from('profiles').select('full_name,email').eq('id', booking.user_id).single();
            const { data: owner }    = await _supabase.from('profiles').select('full_name,email,phone').eq('id', listing?.owner_id).single();

            // Resolve location
            let location = listing?.address || 'Rwanda';
            if (listing?.district_id || listing?.province_id) {
                const [{ data: dist }, { data: prov }] = await Promise.all([
                    listing?.district_id ? _supabase.from('districts').select('name').eq('id', listing.district_id).single() : { data: null },
                    listing?.province_id ? _supabase.from('provinces').select('name').eq('id', listing.province_id).single() : { data: null },
                ]);
                location = [dist?.name, prov?.name].filter(Boolean).join(', ') || location;
            }

            const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
            const nights = Math.ceil((new Date(booking.end_date) - new Date(booking.start_date)) / 86400000);
            const payLabel = (booking.payment_method || '').replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
            const currency = listing?.currency || 'RWF';
            const receiptNo = 'RCP-' + booking.id.substring(0,8).toUpperCase();
            const issuedDate = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });

            if (booker?.email && window.emailjs) {
                await emailjs.send(
                    EMAILJS_CONFIG.SERVICE_ID,
                    EMAILJS_CONFIG.TEMPLATE_BOOKING_APPROVED,
                    {
                        to_email:        booker.email,
                        booker_name:     booker.full_name || 'Guest',
                        listing_title:   listing?.title || '—',
                        location,
                        check_in:        fmt(booking.start_date),
                        check_out:       fmt(booking.end_date),
                        nights:          nights + ' night' + (nights !== 1 ? 's' : ''),
                        price_per_night: Number(listing?.price || 0).toLocaleString('en-RW') + ' ' + currency,
                        payment_method:  payLabel,
                        total:           Number(booking.total_amount).toLocaleString('en-RW') + ' ' + currency,
                        receipt_no:      receiptNo,
                        issued_date:     issuedDate,
                        owner_name:      owner?.full_name || 'Host',
                        owner_email:     owner?.email || '—',
                        owner_phone:     owner?.phone || '—',
                        dashboard_url:   window.location.origin + '/Dashboard/',
                    },
                    EMAILJS_CONFIG.PUBLIC_KEY
                );
                console.log('📧 [APPROVE] Booker email sent to:', booker.email);
            } else {
                console.warn('⚠️ [APPROVE] EmailJS not ready or booker email missing');
            }
        } catch (emailErr) {
            console.warn('⚠️ [APPROVE] Email failed (non-blocking):', emailErr.message || emailErr);
        }

        toast('✅ Booking approved! Guest has been notified by email.', 'success');
        await loadBookingsTable();
        await filterListings();

    } catch (err) {
        console.error("❌ [ACTION] Error approving booking:", err);
        toast('Failed to approve booking: ' + err.message, 'error');
    }
}

async function rejectBooking(bookingId) {
    console.log("❌ [ACTION] Rejecting booking:", bookingId);
    if (!confirm('Reject this booking? The listing will become available again.')) return;

    toast('Rejecting booking...', 'info');
    try {
        // 1. Reject the booking (trigger will free the listing automatically)
        const { error } = await _supabase
            .from('bookings')
            .update({ status: 'rejected' })
            .eq('id', bookingId);
        if (error) throw error;

        // 2. Email the guest if EmailJS available
        try {
            const { data: booking }  = await _supabase.from('bookings').select('*').eq('id', bookingId).single();
            const { data: listing }  = await _supabase.from('listings').select('title, owner_id').eq('id', booking.listing_id).single();
            const { data: booker }   = await _supabase.from('profiles').select('full_name, email').eq('id', booking.user_id).single();

            if (booker?.email && window.emailjs) {
                const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
                await emailjs.send(
                    EMAILJS_CONFIG.SERVICE_ID,
                    EMAILJS_CONFIG.TEMPLATE_BOOKING_REJECTED || EMAILJS_CONFIG.TEMPLATE_BOOKING_APPROVED,
                    {
                        to_email:       booker.email,
                        booker_name:    booker.full_name || 'Guest',
                        listing_title:  listing?.title || '—',
                        check_in:       fmt(booking.start_date),
                        check_out:      fmt(booking.end_date),
                        message:        'Unfortunately, the host was unable to accommodate your booking request. The listing is now available for new dates.',
                    },
                    EMAILJS_CONFIG.PUBLIC_KEY
                );
                console.log('📧 [REJECT] Guest notified:', booker.email);
            }
        } catch (emailErr) {
            console.warn('⚠️ [REJECT] Email failed (non-blocking):', emailErr.message);
        }

        toast('Booking rejected. Listing is now available again.', 'success');
        await loadBookingsTable();
        await filterListings();

    } catch (err) {
        console.error("❌ [ACTION] Error rejecting booking:", err);
        toast('Failed to reject booking: ' + err.message, 'error');
    }
}

async function demoMarkPaid(bookingId) {
    console.log("💰 [DEMO] Marking booking as paid:", bookingId);
    
    if (!DEMO_MODE) {
        alert('Demo mode off');
        return;
    }
    
    if (!confirm('Mark booking as paid for demo?')) return;
    
    try {
        await _supabase.from('payments').insert({
            booking_id: bookingId,
            user_id: CURRENT_PROFILE?.id || null,
            provider: 'in_person',
            amount: 1,
            currency: 'RWF',
            status: 'success'
        });
        
        await _supabase
            .from('bookings')
            .update({ status: 'paid' })
            .eq('id', bookingId);
        
        try {
            await _supabase.rpc('generate_receipt', { p_booking_id: bookingId });
        } catch (e) {
            console.log("  Receipt generation skipped (function may not exist)");
        }
        
        toast('Marked as paid (demo).', 'success');
        console.log("✅ [DEMO] Booking marked as paid");
        await loadBookingsTable();
        await loadCounts();
    } catch (err) {
        console.error("❌ [DEMO] Error marking as paid:", err);
        alert('Failed to mark as paid.');
    }
}

async function promoteToOwner(userId) {
    console.log("⬆️ [ACTION] Promoting user to owner:", userId);
    
    if (!confirm('Promote this user to Owner?')) return;
    
    try {
        const { error } = await _supabase
            .from('profiles')
            .update({ role: 'owner' })
            .eq('id', userId);
        
        if (error) throw error;
        
        alert('User promoted to owner.');
        console.log("✅ [ACTION] User promoted successfully");
        await loadUsersTable();
    } catch (err) {
        console.error("❌ [ACTION] Error promoting user:", err);
        alert('Failed to promote user.');
    }
}

async function handleCreateListing() {
    console.log("➕ [LISTING] Creating new listing (with media)...");
    const title = $('#listTitle')?.value;
    const price = Number($('#listPrice')?.value || 0);
    const desc = $('#listDesc')?.value;
    const category = $('#listCategory')?.value;
    const ownerId = $('#selectedOwnerId')?.value || (CURRENT_PROFILE && CURRENT_PROFILE.id);

    const provinceId = $('#selProvince')?.value || null;
    const districtId = $('#selDistrict')?.value || null;
    const sectorId = $('#selSector')?.value || null;
    const address = $('#listAddress')?.value || '';

    if (!title || !price || !desc || !ownerId) {
        alert('Fill required fields');
        return;
    }

    // validate files
    const imagesInput = document.getElementById('listImageFiles');
    const videosInput = document.getElementById('listVideoFiles');
    const images = imagesInput ? Array.from(imagesInput.files || []) : [];
    const videos = videosInput ? Array.from(videosInput.files || []) : [];

    if (images.length > 10) { alert('Max 10 images allowed'); return; }
    if (videos.length > 3) { alert('Max 3 videos allowed'); return; }

    try {
        // 1) create listing row and get its id
        const { data: created, error: createErr } = await _supabase
        .from('listings')
        .insert([{
            owner_id: ownerId,
            title,
            description: desc,
            price,
            currency: 'RWF',
            province_id: provinceId,
            district_id: districtId,
            sector_id: sectorId,
            address,
            category_slug: category,
            status: 'pending',
            availability_status: 'available'
        }])
        .select()
        .single();

        if (createErr) throw createErr;

        const listingId = created.id;
        console.log('Created listing id:', listingId);

        // 2) Upload images
        const uploadedImageRows = [];
        if (images.length) {
        for (const file of images) {
            const path = `${ownerId}/${listingId}/${Date.now()}-${file.name}`;
            const { error: upErr } = await _supabase.storage.from('listing-images').upload(path, file, { upsert: false });
            if (upErr) {
            console.warn('Image upload failed for', file.name, upErr);
            continue;
            }
            const { data: urlData } = await _supabase.storage.from('listing-images').getPublicUrl(path);
            const publicUrl = urlData?.publicUrl || null;
            uploadedImageRows.push({ listing_id: listingId, image_url: publicUrl, filename: file.name, mime_type: file.type });
        }

        if (uploadedImageRows.length) {
            const { error: imgInsertErr } = await _supabase.from('listing_images').insert(uploadedImageRows);
            if (imgInsertErr) console.warn('listing_images insert error', imgInsertErr);
        }
        }

        // 3) Upload videos
        const uploadedVideoRows = [];
        if (videos.length) {
        for (const file of videos) {
            const path = `${ownerId}/${listingId}/${Date.now()}-${file.name}`;
            const { error: upErr } = await _supabase.storage.from('listing-videos').upload(path, file, { upsert: false });
            if (upErr) {
            console.warn('Video upload failed for', file.name, upErr);
            continue;
            }
            const { data: urlData } = await _supabase.storage.from('listing-videos').getPublicUrl(path);
            const publicUrl = urlData?.publicUrl || null;
            uploadedVideoRows.push({ listing_id: listingId, video_url: publicUrl, filename: file.name, mime_type: file.type });
        }

        if (uploadedVideoRows.length) {
            const { error: vidInsertErr } = await _supabase.from('listing_videos').insert(uploadedVideoRows);
            if (vidInsertErr) console.warn('listing_videos insert error', vidInsertErr);
        }
        }

        toast('Listing created! Pending approval.', 'success');
        console.log('✅ Listing and media created');
    } catch (err) {
        console.error('❌ [LISTING] Error creating listing:', err);
        toast('Failed to create listing: ' + (err.message || JSON.stringify(err)), 'error');
    }
}

async function populatePromoListings() {
    const sel = document.getElementById('promoListingId');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- General Promo --</option>';
    let q = _supabase.from('listings').select('id, title').eq('status','approved').order('created_at', { ascending: false });
    // if owner, show only their listings
    if (CURRENT_ROLE === 'owner') q = q.eq('owner_id', CURRENT_PROFILE.id);
    const { data, error } = await q;
    if (error) return console.warn('populatePromoListings', error);
    (data||[]).forEach(l => {
        const o = document.createElement('option'); o.value = l.id; o.text = l.title; sel.appendChild(o);
    });
}


async function handleLogout() {
    console.log("🚪 [AUTH] Logging out...");
    
    try {
        await _supabase.auth.signOut();
        console.log("✅ [AUTH] Logged out successfully");
        window.location.href = "/";
    } catch (err) {
        console.error("❌ [AUTH] Error logging out:", err);
        location.reload();
    }
}

/* ===========================
    TABLE FILTERING
   =========================== */
function filterTable(inputId, tableBodyId) {
    const input = document.getElementById(inputId);
    const filter = input.value.toUpperCase();
    const tableBody = document.getElementById(tableBodyId);
    const rows = tableBody.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const textContent = rows[i].textContent || rows[i].innerText;
        rows[i].style.display = textContent.toUpperCase().indexOf(filter) > -1 ? "" : "none";
    }
}

/* ===========================
    UTILITY FUNCTIONS
   =========================== */
function shortId(id) {
    if (!id) return '—';
    return String(id).slice(0, 8) + '…';
}

function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}


/* ===========================
   EVENTS
   =========================== */

/* ═══════════════════════════════════════════════
   EVENTS — cards display + create with 5 images
   ═══════════════════════════════════════════════ */
const EVENTS_STORAGE = 'event-images';

async function loadEventsCards() {
    console.log('📅 [EVENTS] Loading events cards...');
    let container = document.getElementById('eventsCardsContainer');
    if (!container) {
        const panel = document.getElementById('eventsPanel');
        if (!panel) return;
        const old = panel.querySelector('.events-inner');
        if (old) old.remove();
        const wrap = document.createElement('div');
        wrap.className = 'events-inner';
        wrap.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
            '<h3 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0;">Events</h3>' +
            (CURRENT_ROLE === 'admin'
                ? '<button onclick="openCreateEventModal()" style="background:#EB6753;color:#fff;border:none;padding:10px 20px;border-radius:10px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;display:flex;align-items:center;gap:6px;"><i class=\"fa-solid fa-plus\"></i> Add Event</button>'
                : '') +
            '</div>' +
            '<div id="eventsCardsContainer" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;"></div>';
        panel.prepend(wrap);
        container = document.getElementById('eventsCardsContainer');
    }
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#aaa;">Loading events...</div>';
    try {
        const { data, error } = await _supabase
            .from('events')
            .select('id,title,description,images,province_id,district_id,sector_id,location_label,landmark,start_date,end_date,created_at')
            .order('start_date', { ascending: true })
            .limit(100);
        if (error) throw error;
        if (!data || !data.length) {
            container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:#ccc;">' +
                '<i class="fa-regular fa-calendar" style="font-size:48px;margin-bottom:16px;display:block;"></i>' +
                '<p>No events yet.' + (CURRENT_ROLE==='admin' ? ' Create the first one!' : '') + '</p></div>';
            return;
        }
        container.innerHTML = '';
        data.forEach(ev => {
            const img     = ev.images && ev.images.length ? ev.images[0] : null;
            const sDate   = ev.start_date || ev.event_date;
            const eDate   = ev.end_date;
            const dateStr = sDate
                ? (eDate && eDate !== sDate
                    ? new Date(sDate+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' – ' + new Date(eDate+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
                    : new Date(sDate+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'}))
                : '—';
            const locLine = [ev.location_label, ev.landmark].filter(Boolean).join(' · ');
            const card = document.createElement('div');
            card.style.cssText = 'background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);transition:transform 0.2s,box-shadow 0.2s;cursor:pointer;';
            card.onmouseenter = () => { card.style.transform='translateY(-4px)'; card.style.boxShadow='0 12px 32px rgba(0,0,0,0.14)'; };
            card.onmouseleave = () => { card.style.transform=''; card.style.boxShadow='0 4px 20px rgba(0,0,0,0.08)'; };
            card.innerHTML =
                '<div style="height:180px;overflow:hidden;background:#f0f0f0;position:relative;">' +
                (img ? '<img src="' + escapeHtml(img) + '" style="width:100%;height:100%;object-fit:cover;">' :
                    '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="fa-regular fa-calendar" style="font-size:40px;color:#ddd;"></i></div>') +
                '<div style="position:absolute;top:12px;left:12px;background:rgba(235,103,83,0.9);color:#fff;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;">' +
                '<i class="fa-solid fa-calendar-day"></i> ' + dateStr + '</div></div>' +
                '<div style="padding:16px;">' +
                '<h4 style="font-size:16px;font-weight:700;color:#1a1a1a;margin:0 0 6px;">' + escapeHtml(ev.title) + '</h4>' +
                '<p style="font-size:13px;color:#888;margin:0 0 8px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + escapeHtml(ev.description||'') + '</p>' +
                (locLine ? '<p style="font-size:12px;color:#EB6753;margin:0 0 12px;"><i class="fa-solid fa-location-dot"></i> ' + escapeHtml(locLine) + '</p>' : '') +
                '<div style="display:flex;gap:8px;">' +
                '<a href="/Event/?id=' + ev.id + '" style="flex:1;text-align:center;background:#f5f5f5;color:#333;padding:8px;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none;"><i class="fa-solid fa-eye"></i> View</a>' +
                (CURRENT_ROLE === 'admin'
                    ? '<button onclick="deleteEvent(\'' + ev.id + '\')" style="flex:1;background:#fde8e8;color:#e74c3c;border:none;padding:8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;"><i class="fa-solid fa-trash"></i> Delete</button>'
                    : '') +
                '</div></div>';
            container.appendChild(card);
        });
        console.log('✅ [EVENTS] Cards rendered:', data.length);
    } catch (err) {
        console.error('❌ [EVENTS]', err);
        container.innerHTML = '<div style="grid-column:1/-1;color:red;padding:20px;">' + escapeHtml(err.message) + '</div>';
    }
}

/* ── Build event create modal completely in JS (no HTML dependency) ── */
async function openCreateEventModal() {
    let modal = document.getElementById('_createEventModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = '_createEventModal';
        modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
        document.body.appendChild(modal);
    }

    // Load provinces for dropdowns
    const { data: provs } = await _supabase.from('provinces').select('id,name').order('name');
    const provOpts = '<option value="">Select Province</option>' +
        (provs||[]).map(p => '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>').join('');

    const IS = 'width:100%;padding:11px 14px;border:1.5px solid #ebebeb;border-radius:10px;font-size:14px;outline:none;font-family:Inter,sans-serif;box-sizing:border-box;background:#fff;';

    modal.innerHTML =
        '<div style="background:#fff;border-radius:20px;padding:32px;max-width:580px;width:100%;margin:auto;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.28);">' +
        '<button onclick="document.getElementById(\'_createEventModal\').style.display=\'none\'" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:#aaa;line-height:1;">&times;</button>' +
        '<h3 style="font-size:22px;font-weight:800;color:#1a1a1a;margin:0 0 6px;">New Event</h3>' +
        '<p style="font-size:13px;color:#aaa;margin:0 0 24px;">Fill in the details below</p>' +

        _evtFld('Title *', '<input id="_evtTitle" placeholder="Event title" style="' + IS + '">') +
        _evtFld('Description', '<textarea id="_evtDesc" placeholder="What is this event about?" style="' + IS + 'min-height:80px;resize:vertical;"></textarea>') +

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
        _evtFld('Start Date *', '<input id="_evtStart" type="date" style="' + IS + '">') +
        _evtFld('End Date <span style="color:#aaa;font-weight:400;">(leave empty if one day)</span>', '<input id="_evtEnd" type="date" style="' + IS + '">') +
        '</div>' +

        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">' +
        _evtFld('Province', '<select id="_evtProvince" onchange="_evtLoadDistricts()" style="' + IS + '">' + provOpts + '</select>') +
        _evtFld('District', '<select id="_evtDistrict" onchange="_evtLoadSectors()" style="' + IS + '"><option value="">Select District</option></select>') +
        _evtFld('Sector', '<select id="_evtSector" style="' + IS + '"><option value="">Select Sector</option></select>') +
        '</div>' +

        _evtFld('Landmark / Venue', '<input id="_evtLandmark" placeholder="e.g. Kigali Convention Centre" style="' + IS + '">') +

        _evtFld('Images <span style="color:#aaa;font-weight:400;">(up to 5)</span>',
            '<input id="_evtImages" type="file" accept="image/*" multiple style="' + IS + 'padding:8px;border-style:dashed;">' +
            '<p style="font-size:11px;color:#aaa;margin:4px 0 0;">Select up to 5 images. First image used as cover.</p>') +

        '<button id="_evtCreateBtn" onclick="handleCreateEvent()" style="width:100%;background:#EB6753;color:#fff;border:none;padding:14px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;margin-top:8px;">' +
        '<i class="fa-solid fa-calendar-plus"></i> Create Event</button></div>';

    modal.style.display = 'flex';
}
window.openCreateEventModal = openCreateEventModal;

function _evtFld(label, inner) {
    return '<div style="margin-bottom:14px;"><label style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:5px;">' + label + '</label>' + inner + '</div>';
}

window._evtLoadDistricts = async function() {
    const provId = document.getElementById('_evtProvince')?.value;
    const dSel   = document.getElementById('_evtDistrict');
    const sSel   = document.getElementById('_evtSector');
    if (dSel) dSel.innerHTML = '<option value="">Select District</option>';
    if (sSel) sSel.innerHTML = '<option value="">Select Sector</option>';
    if (!provId) return;
    const { data } = await _supabase.from('districts').select('id,name').eq('province_id', provId).order('name');
    (data||[]).forEach(d => { const o = document.createElement('option'); o.value=d.id; o.textContent=d.name; dSel.appendChild(o); });
};
window._evtLoadSectors = async function() {
    const distId = document.getElementById('_evtDistrict')?.value;
    const sSel   = document.getElementById('_evtSector');
    if (sSel) sSel.innerHTML = '<option value="">Select Sector</option>';
    if (!distId) return;
    const { data } = await _supabase.from('sectors').select('id,name').eq('district_id', distId).order('name');
    (data||[]).forEach(s => { const o = document.createElement('option'); o.value=s.id; o.textContent=s.name; sSel.appendChild(o); });
};

async function handleCreateEvent() {
    const title    = document.getElementById('_evtTitle')?.value?.trim();
    const desc     = document.getElementById('_evtDesc')?.value?.trim() || null;
    const startD   = document.getElementById('_evtStart')?.value;
    const endD     = document.getElementById('_evtEnd')?.value || null;
    const provId   = document.getElementById('_evtProvince')?.value || null;
    const distId   = document.getElementById('_evtDistrict')?.value || null;
    const sectId   = document.getElementById('_evtSector')?.value || null;
    const landmark = document.getElementById('_evtLandmark')?.value?.trim() || null;
    const files    = document.getElementById('_evtImages')?.files;

    if (!title || !startD) { toast('Title and start date are required.', 'warning'); return; }

    const btn = document.getElementById('_evtCreateBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...'; }

    try {
        // Build human-readable location label
        const locParts = [];
        if (sectId) { const { data: s } = await _supabase.from('sectors').select('name').eq('id', Number(sectId)).single(); if (s) locParts.push(s.name); }
        if (distId) { const { data: d } = await _supabase.from('districts').select('name').eq('id', Number(distId)).single(); if (d) locParts.push(d.name); }
        if (provId) { const { data: p } = await _supabase.from('provinces').select('name').eq('id', Number(provId)).single(); if (p) locParts.push(p.name); }
        const locationLabel = locParts.join(', ') || null;

        // Upload up to 5 images
        const imageUrls = [];
        if (files && files.length) {
            const toUpload = Array.from(files).slice(0, 5);
            for (const file of toUpload) {
                const path = 'events/' + Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const { error: upErr } = await _supabase.storage.from('event-images').upload(path, file, { upsert: false });
                if (!upErr) {
                    const { data: pub } = _supabase.storage.from('event-images').getPublicUrl(path);
                    if (pub?.publicUrl) imageUrls.push(pub.publicUrl);
                } else { console.warn('Event image upload failed:', upErr.message); }
            }
        }

        const { error } = await _supabase.from('events').insert([{
            title, description: desc,
            start_date: startD,
            end_date: endD || startD,
            province_id: provId ? Number(provId) : null,
            district_id: distId ? Number(distId) : null,
            sector_id:   sectId ? Number(sectId) : null,
            location_label: locationLabel,
            landmark,
            images: imageUrls,
            created_by: CURRENT_PROFILE?.id || null
        }]);
        if (error) throw error;

        toast('Event created!', 'success');
        const modal = document.getElementById('_createEventModal');
        if (modal) modal.style.display = 'none';
        await loadEventsCards();
    } catch (err) {
        console.error('❌ [EVENTS] create:', err);
        toast('Failed: ' + err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-calendar-plus"></i> Create Event'; }
    }
}

async function deleteEvent(eventId) {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    try {
        const { error } = await _supabase.from('events').delete().eq('id', eventId);
        if (error) throw error;
        toast('Event deleted.', 'success');
        await loadEventsCards();
    } catch (err) {
        toast('Failed to delete: ' + err.message, 'error');
    }
}
window.deleteEvent = deleteEvent;


/* ═══════════════════════════════════════════════════
   PROMOTIONS — card display (no promo code, listing required)
   ═══════════════════════════════════════════════════ */
async function loadPromotionsCards() {
    console.log('🏷️ [PROMOS] Loading promotion cards...');
    let container = document.getElementById('promosCardsContainer');
    if (!container) {
        const panel = document.getElementById('promotionsPanel');
        if (!panel) return;
        const old = panel.querySelector('.promos-inner');
        if (old) old.remove();
        const wrap = document.createElement('div');
        wrap.className = 'promos-inner';
        wrap.style.cssText = 'padding:20px;';
        wrap.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">' +
            '<h3 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0;">Active Promotions</h3>' +
            '<button onclick="openCreatePromoModal()" style="background:#EB6753;color:#fff;border:none;padding:10px 20px;border-radius:10px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;display:flex;align-items:center;gap:6px;">' +
            '<i class="fa-solid fa-plus"></i> Add Promotion</button></div>' +
            '<div id="promosCardsContainer" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;"></div>';
        panel.prepend(wrap);
        container = document.getElementById('promosCardsContainer');
    }
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#aaa;">Loading...</div>';

    try {
        const { data, error } = await _supabase
            .from('promotions')
            .select('id,title,description,listing_id,discount,start_date,end_date,banner_url,created_at')
            .order('created_at', { ascending: false });
        if (error) throw error;

        const lids = [...new Set((data || []).map(p => p.listing_id).filter(Boolean))];
        const lstMap = {}, lstImgMap = {};
        if (lids.length) {
            const { data: ls } = await _supabase.from('listings').select('id,title').in('id', lids);
            (ls || []).forEach(l => { lstMap[l.id] = l.title; });
            const { data: imgs } = await _supabase.from('listing_images').select('listing_id,image_url').in('listing_id', lids);
            (imgs || []).forEach(i => { if (!lstImgMap[i.listing_id]) lstImgMap[i.listing_id] = i.image_url; });
        }

        if (!data || !data.length) {
            container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:#ccc;">' +
                '<i class="fa-solid fa-tag" style="font-size:48px;margin-bottom:16px;display:block;"></i><p>No promotions yet.</p></div>';
            return;
        }
        container.innerHTML = '';
        const today = new Date().toISOString().split('T')[0];
        data.forEach(p => {
            const imgSrc = p.banner_url || lstImgMap[p.listing_id] || null;
            const isActive = p.start_date <= today && p.end_date >= today;
            const card = document.createElement('div');
            card.style.cssText = 'background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;';
            card.onmouseenter = () => { card.style.transform='translateY(-4px)'; card.style.boxShadow='0 12px 32px rgba(0,0,0,0.13)'; };
            card.onmouseleave = () => { card.style.transform=''; card.style.boxShadow='0 4px 20px rgba(0,0,0,0.08)'; };
            card.onclick = () => openPromoEditModal(p, lstImgMap[p.listing_id]);
            card.innerHTML =
                '<div style="height:160px;overflow:hidden;background:#f5f5f5;position:relative;">' +
                (imgSrc ? '<img src="' + escapeHtml(imgSrc) + '" style="width:100%;height:100%;object-fit:cover;">' :
                    '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-tag" style="font-size:36px;color:#ddd;"></i></div>') +
                '<div style="position:absolute;top:10px;left:10px;background:#EB6753;color:#fff;padding:5px 14px;border-radius:20px;font-size:14px;font-weight:800;">' + p.discount + '% OFF</div>' +
                '<div style="position:absolute;top:10px;right:10px;background:' + (isActive ? 'rgba(46,204,113,0.9)' : 'rgba(150,150,150,0.9)') + ';color:#fff;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;">' + (isActive ? 'ACTIVE' : 'INACTIVE') + '</div></div>' +
                '<div style="padding:16px;">' +
                '<h4 style="font-size:15px;font-weight:700;color:#1a1a1a;margin:0 0 4px;">' + escapeHtml(p.title || '') + '</h4>' +
                '<p style="font-size:12px;color:#EB6753;margin:0 0 6px;font-weight:600;"><i class="fa-solid fa-house"></i> ' + escapeHtml(lstMap[p.listing_id] || '—') + '</p>' +
                (p.description ? '<p style="font-size:12px;color:#888;margin:0 0 10px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + escapeHtml(p.description) + '</p>' : '') +
                '<p style="font-size:11px;color:#aaa;margin:0;"><i class="fa-regular fa-calendar"></i> ' + (p.start_date||'') + ' → ' + (p.end_date||'') + '</p>' +
                '<p style="font-size:11px;color:#bbb;margin:4px 0 0;"><i class="fa-solid fa-pencil"></i> Click to edit</p></div>';
            container.appendChild(card);
        });
        console.log('✅ [PROMOS] Cards rendered:', data.length);
    } catch (err) {
        console.error('❌ [PROMOS]', err);
        container.innerHTML = '<div style="grid-column:1/-1;color:red;padding:20px;">' + err.message + '</div>';
    }
}

function openPromoEditModal(promo, listingImgFallback) {
    let modal = document.getElementById('promoEditModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'promoEditModal';
        modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;align-items:center;justify-content:center;';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
        document.body.appendChild(modal);
    }
    const imgPreview = promo.banner_url || listingImgFallback;
    modal.innerHTML =
        '<div style="background:#fff;border-radius:20px;padding:32px;max-width:520px;width:90%;max-height:90vh;overflow-y:auto;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +
        '<button onclick="document.getElementById(\'promoEditModal\').style.display=\'none\'" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:22px;cursor:pointer;color:#888;line-height:1;">&times;</button>' +
        '<h3 style="font-size:20px;font-weight:800;color:#1a1a1a;margin:0 0 6px;">Edit Promotion</h3>' +
        '<p style="font-size:13px;color:#aaa;margin:0 0 24px;">Update details, add a banner image, or delete</p>' +
        fld('Title', '<input id="epTitle" value="' + escapeHtml(promo.title||'') + '" style="' + inp + '">') +
        fld('Description', '<textarea id="epDesc" style="' + inp + 'min-height:70px;resize:vertical;">' + escapeHtml(promo.description||'') + '</textarea>') +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
        fld('Discount (%)', '<input id="epDiscount" type="number" min="1" max="100" value="' + promo.discount + '" style="' + inp + '">') +
        fld('Start Date', '<input id="epStart" type="date" value="' + (promo.start_date||'') + '" style="' + inp + '">') +
        '</div>' +
        fld('End Date', '<input id="epEnd" type="date" value="' + (promo.end_date||'') + '" style="' + inp + '">') +
        fld('Banner Image <span style="color:#aaa;font-weight:400;">(optional)</span>',
            (imgPreview ? '<img src="' + escapeHtml(imgPreview) + '" style="width:100%;height:110px;object-fit:cover;border-radius:10px;margin-bottom:8px;">' : '') +
            '<input id="epImage" type="file" accept="image/*" style="width:100%;padding:8px;border:1.5px dashed #ddd;border-radius:10px;font-size:13px;">') +
        '<div style="display:flex;gap:10px;margin-top:8px;">' +
        '<button id="epSaveBtn" onclick="savePromoEdit(\'' + promo.id + '\')" style="flex:1;background:#EB6753;color:#fff;border:none;padding:14px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;">Save Changes</button>' +
        '<button onclick="if(confirm(\'Delete this promotion?\'))deletePromotion(\'' + promo.id + '\')" style="background:#fde8e8;color:#e74c3c;border:none;padding:14px 18px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;"><i class="fa-solid fa-trash"></i></button>' +
        '</div></div>';
    modal.style.display = 'flex';
}

const inp = 'width:100%;padding:11px 14px;border:1.5px solid #ebebeb;border-radius:10px;font-size:14px;outline:none;font-family:Inter,sans-serif;box-sizing:border-box;';
function fld(label, inner) {
    return '<div style="margin-bottom:14px;"><label style="font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">' + label + '</label>' + inner + '</div>';
}
window.openPromoEditModal = openPromoEditModal;

async function savePromoEdit(promoId) {
    const title    = document.getElementById('epTitle')?.value?.trim();
    const desc     = document.getElementById('epDesc')?.value?.trim() || null;
    const discount = Number(document.getElementById('epDiscount')?.value || 0);
    const start    = document.getElementById('epStart')?.value;
    const end      = document.getElementById('epEnd')?.value;
    const file     = document.getElementById('epImage')?.files?.[0];
    if (!title || !discount || !start || !end) { toast('Fill all required fields.', 'warning'); return; }
    const btn = document.getElementById('epSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    try {
        let banner_url;
        if (file) {
            const path = 'promos/' + Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const { error: upErr } = await _supabase.storage.from('promotion-images').upload(path, file, { upsert: false });
            if (!upErr) {
                const { data: pub } = _supabase.storage.from('promotion-images').getPublicUrl(path);
                banner_url = pub?.publicUrl;
            }
        }
        const updates = { title, description: desc, discount, start_date: start, end_date: end };
        if (banner_url) updates.banner_url = banner_url;
        const { error } = await _supabase.from('promotions').update(updates).eq('id', promoId);
        if (error) throw error;
        toast('Promotion updated!', 'success');
        document.getElementById('promoEditModal').style.display = 'none';
        await loadPromotionsCards();
    } catch (err) {
        toast('Failed: ' + err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
    }
}
window.savePromoEdit = savePromoEdit;

/* ── Self-building promotion create modal (no HTML dependency) ── */
async function openCreatePromoModal() {
    let modal = document.getElementById('_createPromoModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = '_createPromoModal';
        modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
        document.body.appendChild(modal);
    }

    // Fetch owner's listings for the dropdown
    let listingQuery = _supabase.from('listings').select('id,title').eq('status','approved').order('title');
    if (CURRENT_ROLE === 'owner') listingQuery = listingQuery.eq('owner_id', CURRENT_PROFILE.id);
    const { data: listings } = await listingQuery;
    const lstOpts = '<option value="">— Select a listing —</option>' +
        (listings||[]).map(l => '<option value="' + l.id + '">' + escapeHtml(l.title) + '</option>').join('');

    const IS = 'width:100%;padding:11px 14px;border:1.5px solid #ebebeb;border-radius:10px;font-size:14px;outline:none;font-family:Inter,sans-serif;box-sizing:border-box;background:#fff;';

    modal.innerHTML =
        '<div style="background:#fff;border-radius:20px;padding:32px;max-width:540px;width:100%;margin:auto;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.28);">' +
        '<button onclick="document.getElementById(\'_createPromoModal\').style.display=\'none\'" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:#aaa;line-height:1;">&times;</button>' +
        '<h3 style="font-size:22px;font-weight:800;color:#1a1a1a;margin:0 0 6px;">New Promotion</h3>' +
        '<p style="font-size:13px;color:#aaa;margin:0 0 24px;">Promotions must be linked to a listing</p>' +

        _pFld('Title *', '<input id="_promoTitle" placeholder="e.g. Weekend Special" style="' + IS + '">') +
        _pFld('Apply to Listing *',
            '<select id="_promoListingId" style="' + IS + '">' + lstOpts + '</select>') +
        _pFld('Description', '<textarea id="_promoDesc" placeholder="Short description (optional)" style="' + IS + 'min-height:70px;resize:vertical;"></textarea>') +

        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">' +
        _pFld('Discount % *', '<input id="_promoDiscount" type="number" min="1" max="100" placeholder="e.g. 20" style="' + IS + '">') +
        _pFld('Start Date *', '<input id="_promoStart" type="date" style="' + IS + '">') +
        _pFld('End Date *',   '<input id="_promoEnd"   type="date" style="' + IS + '">') +
        '</div>' +

        _pFld('Banner Images <span style="color:#aaa;font-weight:400;">(optional, max 2)</span>',
            '<input id="_promoImages" type="file" accept="image/*" multiple style="' + IS + 'padding:8px;border-style:dashed;">' +
            '<p style="font-size:11px;color:#aaa;margin:4px 0 0;">If no image, the listing\'s own image will be used.</p>') +

        '<button id="_promoCreateBtn" onclick="handleCreatePromo()" style="width:100%;background:#EB6753;color:#fff;border:none;padding:14px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;margin-top:8px;">' +
        '<i class="fa-solid fa-tag"></i> Create Promotion</button></div>';

    modal.style.display = 'flex';
}
window.openCreatePromoModal = openCreatePromoModal;

function _pFld(label, inner) {
    return '<div style="margin-bottom:14px;"><label style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:5px;">' + label + '</label>' + inner + '</div>';
}

async function handleCreatePromo() {
    const title     = document.getElementById('_promoTitle')?.value?.trim();
    const discount  = Number(document.getElementById('_promoDiscount')?.value || 0);
    const start     = document.getElementById('_promoStart')?.value;
    const end       = document.getElementById('_promoEnd')?.value;
    const desc      = document.getElementById('_promoDesc')?.value?.trim() || null;
    const listingId = document.getElementById('_promoListingId')?.value || null;
    const files     = document.getElementById('_promoImages')?.files;

    if (!title)     { toast('Please enter a title.',           'warning'); return; }
    if (!listingId) { toast('Please select a listing.',        'warning'); return; }
    if (!discount)  { toast('Please enter a discount %.',      'warning'); return; }
    if (!start)     { toast('Please set a start date.',        'warning'); return; }
    if (!end)       { toast('Please set an end date.',         'warning'); return; }
    if (end < start){ toast('End date must be after start.',   'warning'); return; }

    const btn = document.getElementById('_promoCreateBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...'; }

    try {
        // Upload up to 2 banner images, use first as banner_url
        let bannerUrl = null;
        if (files && files.length) {
            const toUpload = Array.from(files).slice(0, 2);
            for (const file of toUpload) {
                const path = 'promos/' + Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const { error: upErr } = await _supabase.storage.from('promotion-images').upload(path, file, { upsert: false });
                if (!upErr) {
                    const { data: pub } = _supabase.storage.from('promotion-images').getPublicUrl(path);
                    if (!bannerUrl && pub?.publicUrl) bannerUrl = pub.publicUrl;
                } else { console.warn('Promo image upload failed:', upErr.message); }
            }
        }

        const { error } = await _supabase.from('promotions').insert([{
            title, description: desc, discount,
            start_date: start, end_date: end,
            listing_id: listingId,
            banner_url: bannerUrl
        }]);
        if (error) throw error;

        toast('Promotion created!', 'success');
        const modal = document.getElementById('_createPromoModal');
        if (modal) modal.style.display = 'none';
        await loadPromotionsCards();
    } catch (err) {
        console.error('❌ [PROMOS] create:', err);
        toast('Failed: ' + err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-tag"></i> Create Promotion'; }
    }
}

async function deletePromotion(promoId) {
    const modal = document.getElementById('promoEditModal');
    if (modal) modal.style.display = 'none';
    try {
        const { error } = await _supabase.from('promotions').delete().eq('id', promoId);
        if (error) throw error;
        toast('Promotion deleted.', 'success');
        await loadPromotionsCards();
    } catch (err) {
        toast('Failed: ' + err.message, 'error');
    }
}
window.deletePromotion = deletePromotion;

/* ===========================
   SETTINGS
   =========================== */
async function handleSaveSettings() {
    const newEmail = document.getElementById('newEmail')?.value?.trim();
    const newPassword = document.getElementById('newPassword')?.value;

    if (!newEmail && !newPassword) {
        toast('Enter a new email or password.', 'warning');
        return;
    }

    const btn = document.querySelector('#settingsForm button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    try {
        const updates = {};
        if (newEmail) updates.email = newEmail;
        if (newPassword) updates.password = newPassword;

        const { error } = await _supabase.auth.updateUser(updates);
        if (error) throw error;

        // Update profile email if changed
        if (newEmail && CURRENT_USER) {
            await _supabase.from('profiles').update({ email: newEmail }).eq('id', CURRENT_USER.id);
            const el = document.getElementById('adminEmailDisplay');
            if (el) el.textContent = newEmail;
        }

        toast(newPassword ? 'Password updated!' : 'Email updated! Check your inbox to confirm.', 'success');
        document.getElementById('newEmail').value = '';
        document.getElementById('newPassword').value = '';
    } catch (err) {
        console.error("❌ [SETTINGS]", err);
        toast('Failed: ' + err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
    }
}

/* ═══════════════════════════════════════════════════
   LISTING REQUESTS (admin approves before listing goes live)
   ═══════════════════════════════════════════════════ */
function injectListingRequestsTab() {
    if (document.querySelector('[data-tab="listing-requests"]')) return;
    const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar-nav') || document.querySelector('nav');
    if (!sidebar) return;
    const bookingsBtn = sidebar.querySelector('[data-tab="bookings"]');
    if (!bookingsBtn) return;
    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.setAttribute('data-tab', 'listing-requests');
    btn.innerHTML = '<i class="fa-solid fa-list-check"></i> Listing Requests';
    bookingsBtn.after(btn);
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        togglePanels('listing-requestsPanel');
        loadListingRequests();
    });

    // Create panel if missing
    if (!document.getElementById('listing-requestsPanel')) {
        const allPanels = document.querySelector('.content-area, .main-content, main, #contentArea');
        if (allPanels) {
            const panel = document.createElement('div');
            panel.id = 'listing-requestsPanel';
            panel.className = 'panel';
            panel.style.display = 'none';
            panel.innerHTML =
                '<div style="padding:28px;">' +
                '<h2 style="font-size:22px;font-weight:800;color:#1a1a1a;margin:0 0 6px;">Listing Requests</h2>' +
                '<p style="color:#aaa;font-size:14px;margin:0 0 24px;">Review and approve owner-submitted listings before they go live</p>' +
                '<div id="listingRequestsContainer"></div></div>';
            allPanels.appendChild(panel);
        }
    }
}

async function loadListingRequests() {
    console.log('📋 [REQUESTS] Loading pending listing requests...');
    let container = document.getElementById('listingRequestsContainer');
    if (!container) {
        const panel = document.getElementById('listing-requestsPanel');
        if (!panel) { console.warn('listing-requestsPanel missing'); return; }
        container = panel.querySelector('#listingRequestsContainer') || panel;
    }
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#aaa;">Loading requests...</div>';

    try {
        const { data, error } = await _supabase
            .from('listings')
            .select('id,title,price,currency,category_slug,province_id,district_id,owner_id,created_at,status')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (error) throw error;

        // Batch owner names
        const ownerIds = [...new Set((data||[]).map(l => l.owner_id).filter(Boolean))];
        const ownerMap = {};
        if (ownerIds.length) {
            const { data: owners } = await _supabase.from('profiles').select('id,full_name,email').in('id', ownerIds);
            (owners||[]).forEach(o => { ownerMap[o.id] = o; });
        }
        // Batch province + district names
        const pvIds = [...new Set((data||[]).map(l=>l.province_id).filter(Boolean))];
        const dtIds = [...new Set((data||[]).map(l=>l.district_id).filter(Boolean))];
        const pvMap = {}, dtMap = {};
        if (pvIds.length) { const {data:ps} = await _supabase.from('provinces').select('id,name').in('id',pvIds); (ps||[]).forEach(p=>pvMap[p.id]=p.name); }
        if (dtIds.length) { const {data:ds} = await _supabase.from('districts').select('id,name').in('id',dtIds); (ds||[]).forEach(d=>dtMap[d.id]=d.name); }

        if (!data || !data.length) {
            container.innerHTML = '<div style="text-align:center;padding:60px;color:#ccc;"><i class="fa-solid fa-inbox" style="font-size:48px;display:block;margin-bottom:16px;"></i><p>No pending listing requests.</p></div>';
            return;
        }

        container.innerHTML = '';
        data.forEach(l => {
            const owner = ownerMap[l.owner_id] || {};
            const loc = [dtMap[l.district_id], pvMap[l.province_id]].filter(Boolean).join(', ') || 'Rwanda';
            const row = document.createElement('div');
            row.style.cssText = 'background:#fff;border-radius:16px;padding:20px 24px;margin-bottom:14px;display:flex;align-items:center;gap:20px;box-shadow:0 4px 16px rgba(0,0,0,0.07);flex-wrap:wrap;';
            row.innerHTML =
                '<div style="flex:1;min-width:200px;">' +
                '<h4 style="font-size:16px;font-weight:700;color:#1a1a1a;margin:0 0 4px;">' + escapeHtml(l.title) + '</h4>' +
                '<p style="font-size:13px;color:#888;margin:0;"><i class="fa-solid fa-location-dot" style="color:#EB6753;"></i> ' + escapeHtml(loc) + ' &nbsp;|&nbsp; ' +
                '<i class="fa-solid fa-tag" style="color:#EB6753;"></i> ' + Number(l.price||0).toLocaleString('en-RW') + ' ' + (l.currency||'RWF') + '</p></div>' +
                '<div style="min-width:180px;">' +
                '<p style="font-size:13px;color:#555;margin:0;font-weight:600;">' + escapeHtml(owner.full_name||'Unknown') + '</p>' +
                '<p style="font-size:12px;color:#aaa;margin:2px 0 0;">' + escapeHtml(owner.email||'') + '</p></div>' +
                '<div style="display:flex;gap:8px;flex-shrink:0;">' +
                '<button onclick="approveListingRequest(\'' + l.id + '\',this)" style="background:#e8f8f0;color:#27ae60;border:1px solid #b8e6ce;padding:9px 18px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;display:flex;align-items:center;gap:6px;">' +
                '<i class="fa-solid fa-check"></i> Approve</button>' +
                '<button onclick="rejectListingRequest(\'' + l.id + '\',this)" style="background:#fde8e8;color:#e74c3c;border:1px solid #f5c6c6;padding:9px 18px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;display:flex;align-items:center;gap:6px;">' +
                '<i class="fa-solid fa-xmark"></i> Reject</button></div>';
            container.appendChild(row);
        });
        console.log('✅ [REQUESTS] Loaded', data.length, 'pending listings');
    } catch(err) {
        console.error('❌ [REQUESTS]', err);
        container.innerHTML = '<div style="color:red;padding:20px;">' + err.message + '</div>';
    }
}
window.loadListingRequests = loadListingRequests;

async function approveListingRequest(listingId, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Approving...'; }
    try {
        const { error } = await _supabase.from('listings').update({ status: 'approved' }).eq('id', listingId);
        if (error) throw error;
        toast('Listing approved — it is now live!', 'success');
        await loadListingRequests();
    } catch (err) {
        toast('Failed: ' + err.message, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Approve'; }
    }
}
window.approveListingRequest = approveListingRequest;

async function rejectListingRequest(listingId, btn) {
    if (!confirm('Reject and delete this listing request?')) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Rejecting...'; }
    try {
        const { error } = await _supabase.from('listings').delete().eq('id', listingId);
        if (error) throw error;
        toast('Listing request rejected.', 'warning');
        await loadListingRequests();
    } catch (err) {
        toast('Failed: ' + err.message, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Reject'; }
    }
}
window.rejectListingRequest = rejectListingRequest;

/* ═══════════════════════════════════════════════════
   OWNER — NEW BOOKINGS (pending only)
   ═══════════════════════════════════════════════════ */
async function loadNewBookings() {
    console.log('🆕 [NEW BOOKINGS] Loading pending bookings...');
    const container = document.getElementById('newBookingsContainer');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:30px;color:#aaa;">Loading...</div>';

    try {
        const listingIds = await fetchOwnerListingIds();
        if (!listingIds.length) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#ccc;"><i class="fa-solid fa-inbox" style="font-size:36px;display:block;margin-bottom:12px;"></i><p>No listings yet.</p></div>';
            return;
        }
        const { data, error } = await _supabase
            .from('bookings')
            .select('id,listing_id,user_id,start_date,end_date,total_amount,created_at')
            .in('listing_id', listingIds)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (error) throw error;

        if (!data || !data.length) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#ccc;"><i class="fa-solid fa-check-circle" style="font-size:36px;display:block;margin-bottom:12px;color:#2ecc71;"></i><p>No new bookings waiting for approval.</p></div>';
            return;
        }

        // Batch listing titles + user info
        const lids = [...new Set(data.map(b=>b.listing_id))];
        const uids = [...new Set(data.map(b=>b.user_id))];
        const lstM = {}, usrM = {};
        if (lids.length) { const {data:ls} = await _supabase.from('listings').select('id,title').in('id',lids); (ls||[]).forEach(l=>lstM[l.id]=l.title); }
        if (uids.length) { const {data:us} = await _supabase.from('profiles').select('id,full_name,email').in('id',uids); (us||[]).forEach(u=>usrM[u.id]=u); }

        container.innerHTML = '';
        data.forEach(b => {
            const user = usrM[b.user_id] || {};
            const nights = b.start_date && b.end_date ? Math.max(1, Math.round((new Date(b.end_date)-new Date(b.start_date))/86400000)) : '?';
            const row = document.createElement('div');
            row.style.cssText = 'background:#fff;border-radius:14px;padding:18px 20px;margin-bottom:12px;display:flex;align-items:center;gap:16px;box-shadow:0 3px 12px rgba(0,0,0,0.07);flex-wrap:wrap;border-left:4px solid #f39c12;';
            row.innerHTML =
                '<div style="flex:1;min-width:160px;">' +
                '<p style="font-size:14px;font-weight:700;color:#1a1a1a;margin:0 0 3px;">' + escapeHtml(lstM[b.listing_id]||'Unknown listing') + '</p>' +
                '<p style="font-size:12px;color:#888;margin:0;"><i class="fa-regular fa-calendar" style="color:#EB6753;"></i> ' + (b.start_date||'') + ' → ' + (b.end_date||'') + ' (' + nights + ' nights)</p></div>' +
                '<div style="min-width:160px;">' +
                '<p style="font-size:13px;font-weight:600;color:#555;margin:0;">' + escapeHtml(user.full_name||'Guest') + '</p>' +
                '<p style="font-size:12px;color:#aaa;margin:2px 0 0;">' + escapeHtml(user.email||'') + '</p></div>' +
                '<p style="font-size:16px;font-weight:800;color:#EB6753;margin:0;min-width:100px;">' + Number(b.total_amount||0).toLocaleString('en-RW') + ' RWF</p>' +
                '<div style="display:flex;gap:8px;">' +
                '<button onclick="approveBooking(\'' + b.id + '\')" style="background:#e8f8f0;color:#27ae60;border:1px solid #b8e6ce;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;"><i class="fa-solid fa-check"></i> Approve</button>' +
                '<button onclick="rejectBooking(\'' + b.id + '\')" style="background:#fde8e8;color:#e74c3c;border:1px solid #f5c6c6;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;"><i class="fa-solid fa-xmark"></i> Reject</button></div>';
            container.appendChild(row);
        });
        console.log('✅ [NEW BOOKINGS] Loaded', data.length);
    } catch (err) {
        console.error('❌ [NEW BOOKINGS]', err);
        container.innerHTML = '<div style="color:red;padding:16px;">' + err.message + '</div>';
    }
}
window.loadNewBookings = loadNewBookings;

/* expose new functions globally */
window.loadEventsTable = loadEventsCards;
window.loadEventsCards = loadEventsCards;
window.handleCreateEvent = handleCreateEvent;
window.loadPromotionsTable = loadPromotionsCards;
window.loadPromotionsCards = loadPromotionsCards;
window.handleCreatePromo = handleCreatePromo;
window.handleSaveSettings = handleSaveSettings;

/* ===========================
    GLOBAL EXPORTS
    =========================== */
window.approveListing = approveListing;
window.toggleListingAvailability = toggleListingAvailability;
window.approveBooking = approveBooking;
window.rejectBooking   = rejectBooking;
window.demoMarkPaid = demoMarkPaid;
window.promoteToOwner = promoteToOwner;
window.openModal = openModal;
window.closeModal = closeModal;
window.filterTable = filterTable;
window.togglePanels = togglePanels;

console.log("✨ [ADMIN] Dashboard.js loaded and ready!");

/* ═══════════════════════════════════════════════
   DOWNLOAD RECEIPT (PDF) — client-side via jsPDF
   ═══════════════════════════════════════════════ */
window.downloadReceipt = async function(bookingId) {
    console.log('📄 [RECEIPT] Generating receipt for booking:', bookingId);
    toast('Generating receipt...', 'info');

    try {
        // Fetch all data needed for PDF
        const { data: booking } = await _supabase
            .from('bookings').select('*').eq('id', bookingId).single();
        
        const { data: listing } = await _supabase
            .from('listings').select('title, price, currency, address, province_id, district_id, owner_id')
            .eq('id', booking.listing_id).single();

        const { data: booker } = await _supabase
            .from('profiles').select('full_name, email')
            .eq('id', booking.user_id).single();

        const { data: owner } = await _supabase
            .from('profiles').select('full_name, email, phone')
            .eq('id', listing?.owner_id).single();

        let locationStr = listing?.address || 'Rwanda';
        if (listing?.district_id || listing?.province_id) {
            const [{ data: dist }, { data: prov }] = await Promise.all([
                listing?.district_id ? _supabase.from('districts').select('name').eq('id', listing.district_id).single() : { data: null },
                listing?.province_id ? _supabase.from('provinces').select('name').eq('id', listing.province_id).single() : { data: null },
            ]);
            locationStr = [dist?.name, prov?.name].filter(Boolean).join(', ') || locationStr;
        }

        const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        const nights = Math.ceil((new Date(booking.end_date) - new Date(booking.start_date)) / 86400000);
        const payMethod = (booking.payment_method || '').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
        const currency = listing?.currency || 'RWF';
        const totalFmt = Number(booking.total_amount).toLocaleString('en-RW') + ' ' + currency;
        const pricePerNight = Number(listing?.price || 0).toLocaleString('en-RW');
        const receiptNo = 'RCP-' + booking.id.substring(0, 8).toUpperCase();
        const issuedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        // Load jsPDF dynamically
        if (!window.jspdf) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                s.onload = resolve; s.onerror = reject;
                document.head.appendChild(s);
            });
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const W = 210, M = 20;
        let y = 0;

        // ── Header band ──
        doc.setFillColor(26, 26, 46);
        doc.rect(0, 0, W, 44, 'F');
        doc.setTextColor(235, 103, 83);
        doc.setFontSize(26); doc.setFont('helvetica', 'bold');
        doc.text('AfriStay', W / 2, 18, { align: 'center' });
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11); doc.setFont('helvetica', 'normal');
        doc.text('Booking Receipt — Confirmed', W / 2, 30, { align: 'center' });
        doc.setFontSize(9); doc.setTextColor(180, 180, 200);
        doc.text('afristay.rw', W / 2, 38, { align: 'center' });

        y = 58;

        // ── Receipt number row ──
        doc.setFillColor(248, 249, 250);
        doc.roundedRect(M, y - 6, W - M * 2, 16, 3, 3, 'F');
        doc.setTextColor(80, 80, 80); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text('RECEIPT NO', M + 6, y + 3);
        doc.setTextColor(30, 30, 30); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.text(receiptNo, M + 6, y + 8);
        doc.setTextColor(80, 80, 80); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text('ISSUED', W - M - 6, y + 3, { align: 'right' });
        doc.setTextColor(30, 30, 30); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text(issuedDate, W - M - 6, y + 8, { align: 'right' });

        y += 26;

        // ── Section heading helper ──
        const sectionHead = (title) => {
            doc.setFillColor(235, 103, 83);
            doc.rect(M, y, 3, 6, 'F');
            doc.setTextColor(30, 30, 30); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
            doc.text(title, M + 7, y + 5);
            y += 12;
        };

        // ── Row helper ──
        const row = (label, value, highlight = false) => {
            doc.setFontSize(9); doc.setFont('helvetica', 'normal');
            doc.setTextColor(140, 140, 140);
            doc.text(label, M, y);
            doc.setTextColor(highlight ? 235 : 30, highlight ? 103 : 30, highlight ? 83 : 30);
            doc.setFont('helvetica', highlight ? 'bold' : 'normal');
            doc.setFontSize(highlight ? 12 : 10);
            doc.text(value, W - M, y, { align: 'right' });
            y += 8;
            // thin line
            doc.setDrawColor(240, 240, 240);
            doc.line(M, y - 1, W - M, y - 1);
            y += 2;
        };

        // ── Property ──
        sectionHead('PROPERTY');
        doc.setTextColor(20, 20, 20); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
        doc.text(listing?.title || '—', M, y); y += 7;
        doc.setTextColor(100, 100, 100); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text('📍 ' + locationStr, M, y); y += 14;

        // ── Booking details ──
        sectionHead('BOOKING DETAILS');
        row('Check-in',      fmt(booking.start_date));
        row('Check-out',     fmt(booking.end_date));
        row('Duration',      nights + ' night' + (nights !== 1 ? 's' : ''));
        row('Status',        '✓ Confirmed');
        y += 4;

        // ── Payment ──
        sectionHead('PAYMENT');
        row('Rate per Night',  pricePerNight + ' ' + currency);
        row('Payment Method',  payMethod);
        y += 2;

        // Total box
        doc.setFillColor(255, 249, 248);
        doc.roundedRect(M, y, W - M * 2, 16, 3, 3, 'F');
        doc.setDrawColor(235, 103, 83);
        doc.setLineWidth(0.5);
        doc.roundedRect(M, y, W - M * 2, 16, 3, 3, 'S');
        doc.setTextColor(30, 30, 30); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.text('TOTAL', M + 6, y + 10);
        doc.setTextColor(235, 103, 83); doc.setFontSize(15);
        doc.text(totalFmt, W - M - 6, y + 10, { align: 'right' });
        y += 26;

        // ── Guest ──
        sectionHead('GUEST');
        doc.setTextColor(30, 30, 30); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text(booker?.full_name || '—', M, y); y += 6;
        doc.setTextColor(100, 100, 100); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        if (booker?.email) { doc.text(booker.email, M, y); y += 6; }
        y += 6;

        // ── Owner / Host ──
        if (owner) {
            sectionHead('HOST CONTACT');
            doc.setTextColor(30, 30, 30); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
            doc.text(owner.full_name || '—', M, y); y += 6;
            doc.setTextColor(100, 100, 100); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
            if (owner.email) { doc.text(owner.email, M, y); y += 6; }
            if (owner.phone) { doc.text(owner.phone, M, y); y += 6; }
            y += 4;
        }

        // ── Footer ──
        const pageH = doc.internal.pageSize.height;
        doc.setFillColor(248, 249, 250);
        doc.rect(0, pageH - 18, W, 18, 'F');
        doc.setDrawColor(235, 235, 235);
        doc.line(0, pageH - 18, W, pageH - 18);
        doc.setTextColor(160, 160, 160); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
        doc.text('This is an official AfriStay booking receipt. © ' + new Date().getFullYear() + ' AfriStay · afristay.rw', W / 2, pageH - 8, { align: 'center' });

        doc.save('AfriStay-Receipt-' + receiptNo + '.pdf');
        toast('📄 Receipt downloaded!', 'success');
        console.log('✅ [RECEIPT] PDF generated:', receiptNo);

    } catch (err) {
        console.error('❌ [RECEIPT] Error generating receipt:', err);
        toast('Failed to generate receipt: ' + err.message, 'error');
    }
};