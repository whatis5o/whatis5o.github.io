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
function reparentModalsAndQuickActions() {
    console.log("🔄 [ADMIN] Reparenting modals and quick actions...");
    
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
        window.location.href = 'index.html';
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
        ['users', 'events', 'promotions', 'messages'].forEach(t => show(t));
        if (createListingBtn) createListingBtn.style.display = '';
        if (quickMenu) quickMenu.querySelectorAll('button').forEach(b => b.style.display = '');
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
        loadMessagesPreview()
    ]);
    
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
            
            setCount('#totalUsers', usersCount || 0);
            setCount('#totalListings', listingsCount || 0);
            setCount('#totalBookings', bookingsCount || 0);
            setCount('#totalRevenue', '0 RWF');
        } 
        else if (CURRENT_ROLE === 'owner') {
            console.log("  Loading owner counts...");
            const { count: listingsCount, error: e1 } = await _supabase
                .from('listings')
                .select('id', { count: 'exact', head: true })
                .eq('owner_id', CURRENT_PROFILE.id);
            if (e1) console.error("Error counting owner listings:", e1);
            
            const listingIds = await fetchOwnerListingIds();
            const { count: bookingsCount, error: e2 } = await _supabase
                .from('bookings')
                .select('id', { count: 'exact', head: true })
                .in('listing_id', listingIds.length ? listingIds : [-1]);
            if (e2) console.error("Error counting owner bookings:", e2);
            
            setCount('#totalUsers', 0);
            setCount('#totalListings', listingsCount || 0);
            setCount('#totalBookings', bookingsCount || 0);
            setCount('#totalRevenue', 'N/A');
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
window.searchOwners = UTILS && UTILS.debounce ? UTILS.debounce(_searchOwners, 250) : _searchOwners;

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
                    ${(CURRENT_ROLE === 'owner' && listing?.owner_id === CURRENT_PROFILE.id && r.status === 'pending') ? 
                        `<button class="btn-small" onclick="approveBooking('${r.id}')">Approve</button>` : ''}
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
        .select('id, full_name, email, phone, role')
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

        const actionSelectHtml = `
            <select class="status-select" onchange="toggleUserBan('${u.id}', this.value)">
            <option value="active">active</option>
            <option value="banned">ban</option>
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
   MESSAGES PREVIEW
   =========================== */
async function loadMessagesPreview() {
    console.log("💬 [MESSAGES] Loading messages preview...");
    
    const list = $('#chatUserList');
    if (!list) {
        console.warn("⚠️ [MESSAGES] Chat list not found");
        return;
    }
    
    list.innerHTML = '<div style="padding:16px">Loading messages...</div>';
    
    try {
        if (!CURRENT_ROLE) {
            list.innerHTML = '<div style="padding:16px">Login to view messages</div>';
            return;
        }
        
        if (CURRENT_ROLE !== 'admin') {
            console.log("  Non-admin user - limited access");
            list.innerHTML = '<div style="padding:16px">Messages are admin-only in demo</div>';
            return;
        }
        
        const { data, error } = await _supabase
            .from('contact_messages')
            .select('id, name, email, message, created_at')
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (error) {
            console.error("❌ [MESSAGES] Error loading messages:", error);
            list.innerHTML = `<div style="padding:16px">Error: ${error.message}</div>`;
            return;
        }
        
        if (!data || data.length === 0) {
            console.log("  No messages found");
            list.innerHTML = '<div style="padding:16px">No messages</div>';
            return;
        }
        
        console.log(`  Found ${data.length} messages`);
        
        list.innerHTML = '';
        data.forEach(m => {
            const el = document.createElement('div');
            el.className = 'chat-user-item';
            el.innerHTML = `
                <div class="chat-user-avatar">${escapeHtml((m.name || 'U')[0])}</div>
                <div class="chat-user-info">
                    <h4>${escapeHtml(m.name)}</h4>
                    <p>${escapeHtml(m.message.slice(0, 80))}...</p>
                </div>
            `;
            list.appendChild(el);
        });

        console.log("✅ [MESSAGES] Preview loaded");
        
    } catch (err) {
        console.error("❌ [MESSAGES] Exception:", err);
        list.innerHTML = '<div style="padding:16px">Failed to load messages</div>';
    }
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
    if (!confirm('Approve booking? This will notify user and mark listing unavailable.')) return;
    try {
        const { error } = await _supabase
            .from('bookings')
            .update({ status: 'approved' })
            .eq('id', bookingId);
        if (error) throw error;
        toast('Booking approved!', 'success');
        await loadBookingsTable();
        await filterListings();
    } catch (err) {
        console.error("❌ [ACTION] Error approving booking:", err);
        toast('Failed to approve booking: ' + err.message, 'error');
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
        location.reload();
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
    GLOBAL EXPORTS
    =========================== */
window.approveListing = approveListing;
window.toggleListingAvailability = toggleListingAvailability;
window.approveBooking = approveBooking;
window.demoMarkPaid = demoMarkPaid;
window.promoteToOwner = promoteToOwner;
window.openModal = openModal;
window.closeModal = closeModal;
window.filterTable = filterTable;
window.togglePanels = togglePanels;

console.log("✨ [ADMIN] Dashboard.js loaded and ready!");
