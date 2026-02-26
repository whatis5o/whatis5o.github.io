/* ─────────────────────────────────────────
   GLOBAL NAVIGATION & AUTH STATE
   ───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    await initGlobalNav();
});

async function initGlobalNav() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;

    const cachedRole = localStorage.getItem('afriStay_role');
    if (cachedRole) {
        const profileLink = (cachedRole === 'admin' || cachedRole === 'owner') ? '/Dashboard' : '/Profile';
        navRight.innerHTML = `
            <a href="/Favorites" class="icon-link" title="Favorites"><i class="fa-solid fa-heart"></i></a>
            <a href="${profileLink}" class="icon-link" title="${cachedRole === 'user' ? 'Profile' : 'Dashboard'}">
                <i class="fa-solid fa-circle-user" style="font-size:24px;margin-left:10px;"></i>
            </a>
        `;
    }

    const client = window.supabaseClient;
    if (!client) return;
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
        localStorage.removeItem('afriStay_role');
        localStorage.removeItem('afriStay_firstName');
        navRight.innerHTML = `<a href="/Auth" class="signin-btn">Sign In</a>`;
    }
}

window.toggleMenu = function() {
    const navWrapper = document.getElementById("navWrapper");
    if (navWrapper) navWrapper.classList.toggle("active");
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof initAuthUI === 'function') initAuthUI();
});

/* ─────────────────────────────────────────
   SHARED LISTING CARD GENERATOR
   ───────────────────────────────────────── */
function generateListingCard(listing, locationName) {
    const thumb    = listing.final_thumb_url;
    const avail    = listing.availability_status || 'available';
    const isVeh    = listing.category_slug === 'vehicle';
    const catLbl   = isVeh ? 'Vehicle' : 'Real Estate';
    const catIcon  = isVeh ? 'fa-car' : 'fa-house';
    const unit     = isVeh ? '/day' : '/night';
    const price    = Number(listing.price).toLocaleString();
    const currency = listing.currency || 'RWF';

    function esc(s) {
        return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }

    return `
        <a href="/Detail/?id=${listing.id}" class="property-card">
            <div class="card-image">
                ${thumb
                    ? `<img src="${esc(thumb)}" alt="${esc(listing.title)}" loading="lazy">`
                    : `<div class="card-no-img"><i class="fa-solid fa-image" style="font-size:44px;color:#ddd;"></i></div>`
                }
                <div class="cat-label">${catLbl}</div>
                <div class="card-heart" data-lid="${listing.id}"
                     onclick="event.preventDefault();event.stopPropagation();window.toggleFavorite(event,'${listing.id}')">
                    <i class="fa-solid fa-heart"></i>
                </div>
                <div class="avail-strip ${avail}">${avail === 'available' ? '&#9679; Available' : '&#9679; ' + avail}</div>
            </div>
            <div class="card-content">
                <h3>${esc(listing.title)}</h3>
                <div class="card-location"><i class="fa-solid fa-location-dot"></i><span>${esc(locationName)}</span></div>
                <div class="card-features">
                    <div class="feature"><i class="fa-solid ${catIcon}"></i><span>${catLbl}</span></div>
                    <div class="feature"><i class="fa-solid fa-circle-check" style="color:#2ecc71"></i><span>${avail}</span></div>
                </div>
                <div class="card-footer">
                    <div class="card-price">${currency === 'RWF' ? '' : currency + ' '}${price} <span>${currency === 'RWF' ? 'RWF' : ''}${unit}</span></div>
                    <button class="details-btn" onclick="event.preventDefault();window.location.href='/Detail/?id=${listing.id}'">View Details</button>
                </div>
            </div>
        </a>
    `;
}

/* ─────────────────────────────────────────
   SHARED LISTING FETCH + RENDER ENGINE
   ───────────────────────────────────────── */
window.fetchAndRenderSharedListings = async function(options) {
    const sb        = window.supabaseClient;
    const container = document.getElementById(options.containerId);
    if (!container) return;

    let q = sb.from('listings')
        .select(`id, title, price, currency, availability_status, status,
                 category_slug, province_id, district_id, created_at,
                 listing_images ( image_url )`)
        .eq('status', 'approved');

    if (options.featuredOnly) q = q.eq('featured', true);
    if (options.qtext)        q = q.ilike('title', `%${options.qtext}%`);
    if (options.province)     q = q.eq('province_id', options.province);
    if (options.district)     q = q.eq('district_id', options.district);
    if (options.sector)       q = q.eq('sector_id', options.sector);
    if (options.category)     q = q.eq('category_slug', options.category);
    q = q.order('created_at', { ascending: false });
    if (options.limit) q = q.limit(options.limit);

    const { data: listings, error } = await q;

    if (error || !listings || !listings.length) {
        container.innerHTML = `<div style="width:100%;text-align:center;padding:40px;color:#999;font-family:'Inter',sans-serif;">
            <i class="fa-solid fa-house-circle-xmark" style="font-size:40px;color:#EB6753;margin-bottom:12px;display:block;"></i>
            <p>${error ? error.message : 'No properties found.'}</p>
        </div>`;
        if (options.onComplete) options.onComplete(0);
        return;
    }

    const pvIds = [...new Set(listings.map(l => l.province_id).filter(Boolean))];
    const dtIds = [...new Set(listings.map(l => l.district_id).filter(Boolean))];
    const pvMap = {}, dtMap = {};
    if (pvIds.length) { const { data: ps } = await sb.from('provinces').select('id,name').in('id', pvIds); (ps||[]).forEach(p => pvMap[p.id] = p.name); }
    if (dtIds.length) { const { data: ds } = await sb.from('districts').select('id,name').in('id', dtIds); (ds||[]).forEach(d => dtMap[d.id] = d.name); }

    container.innerHTML = '';
    listings.forEach(l => {
        const rawUrl = l.listing_images?.[0]?.image_url;
        let finalImageUrl = rawUrl;
        if (rawUrl && !rawUrl.startsWith('http')) {
            const { data: pub } = sb.storage.from('listing_images').getPublicUrl(rawUrl);
            finalImageUrl = pub.publicUrl;
        }
        l.final_thumb_url = finalImageUrl;
        const locName = [dtMap[l.district_id], pvMap[l.province_id]].filter(Boolean).join(', ') || 'Rwanda';
        container.innerHTML += generateListingCard(l, locName);
    });

    if (options.onComplete) options.onComplete(listings.length);
    // Refresh hearts after cards are in the DOM
    setTimeout(() => FAV.refreshHearts(), 100);
};

/* ═══════════════════════════════════════════════════════════════
   FAVORITES ENGINE
   ─────────────────────────────────────────────────────────────
   LOGGED IN  → writes directly to Supabase `favorites` table
   LOGGED OUT → saves to localStorage, nudges user to sign in
   ON LOGIN   → auth.js calls window.syncPendingFavorites(userId)
               which upserts localStorage items into Supabase
   ═══════════════════════════════════════════════════════════════ */
const FAV = (() => {

    const LS_KEY = 'afriStay_pendingFavs';

    /* ─── in-memory cache (avoids re-fetching on every click) ─── */
    let _cache     = null;   // Set<listingId>  — null means "not loaded"
    let _rowIds    = {};     // { listingId: favRowId }  — needed for DELETE
    let _cachedUid = null;

    /* ─── localStorage helpers ─── */
    const getP  = ()        => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } };
    const setP  = arr       => localStorage.setItem(LS_KEY, JSON.stringify([...new Set(arr)]));
    const addP  = id        => setP([...getP(), id]);
    const delP  = id        => setP(getP().filter(x => x !== id));
    const hasP  = id        => getP().includes(id);

    /* ─── toast ─── */
    function toast(html, type) {
        const BG = { success:'#2ecc71', error:'#e74c3c', info:'#3b82f6', warning:'#f59e0b' };
        let box = document.getElementById('_favBox');
        if (!box) {
            box = document.createElement('div');
            box.id = '_favBox';
            box.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
            document.body.appendChild(box);
            const sty = document.createElement('style');
            sty.textContent = '@keyframes _fvIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}';
            document.head.appendChild(sty);
        }
        const el = document.createElement('div');
        el.style.cssText = `background:${BG[type]||BG.info};color:#fff;padding:13px 18px;border-radius:12px;`
            + `font-family:'Inter',sans-serif;font-size:14px;font-weight:500;`
            + `box-shadow:0 4px 24px rgba(0,0,0,0.22);display:flex;align-items:center;gap:9px;`
            + `pointer-events:auto;max-width:320px;line-height:1.5;animation:_fvIn 0.25s ease;`;
        el.innerHTML = html;
        box.appendChild(el);
        setTimeout(() => {
            el.style.transition = 'opacity 0.3s';
            el.style.opacity    = '0';
            setTimeout(() => el.remove(), 320);
        }, 3800);
    }

    /* ─── load user's saved listings from Supabase (once) ─── */
    async function loadCache(sb, uid) {
        if (_cachedUid === uid && _cache !== null) return;
        _cache = new Set(); _rowIds = {}; _cachedUid = uid;
        const { data } = await sb.from('favorites').select('id,listing_id').eq('user_id', uid);
        (data || []).forEach(r => { _cache.add(r.listing_id); _rowIds[r.listing_id] = r.id; });
    }

    /* ─── flip the heart icon filled ↔ outline ─── */
    function setHeart(btn, saved) {
        if (!btn) return;
        btn.classList.toggle('faved', !!saved);
    }

    /* ─── call this after any batch card render ─── */
    function refreshHearts() {
        document.querySelectorAll('.card-heart[data-lid]').forEach(btn => {
            const id    = btn.dataset.lid;
            const saved = (_cache && _cache.has(id)) || hasP(id);
            setHeart(btn, saved);
        });
    }

    /* ─── THE MAIN TOGGLE ─── */
    async function toggle(event, listingId) {
        event.preventDefault();
        event.stopPropagation();

        const btn = event.currentTarget;
        btn.dataset.lid = listingId; // ensure data attr is set

        const sb = window.supabaseClient;
        if (!sb) return;

        const { data: { user } } = await sb.auth.getUser().catch(() => ({ data: {} }));

        /* ══ NOT LOGGED IN ══ */
        if (!user) {
            if (hasP(listingId)) {
                delP(listingId);
                setHeart(btn, false);
                toast('💔 Removed from saved.', 'info');
            } else {
                addP(listingId);
                setHeart(btn, true);
                const n = getP().length;
                toast(
                    `❤️ Saved! <a href="/Auth" style="color:#fff;font-weight:800;text-decoration:underline;margin-left:5px;">Sign in</a> to keep your ${n === 1 ? 'favorite' : n + ' favorites'}.`,
                    'warning'
                );
            }
            return;
        }

        /* ══ LOGGED IN ══ */
        await loadCache(sb, user.id);

        if (_cache.has(listingId)) {
            // ── REMOVE ──
            const { error } = await sb.from('favorites')
                .delete()
                .eq('id', _rowIds[listingId])
                .eq('user_id', user.id);
            if (error) { toast('❌ Could not remove.', 'error'); return; }
            _cache.delete(listingId);
            delete _rowIds[listingId];
            setHeart(btn, false);
            toast('💔 Removed from favorites.', 'info');
        } else {
            // ── SAVE ──
            const { data, error } = await sb.from('favorites')
                .insert({ listing_id: listingId, user_id: user.id })
                .select('id').single();
            if (error) { toast('❌ Could not save.', 'error'); return; }
            _cache.add(listingId);
            _rowIds[listingId] = data.id;
            setHeart(btn, true);
            toast('❤️ Added to favorites!', 'success');
        }
    }

    /* ─── page init: mark hearts for already-saved listings ─── */
    async function init() {
        const sb = window.supabaseClient;
        if (!sb) return;
        const { data: { user } } = await sb.auth.getUser().catch(() => ({ data: {} }));
        if (user) await loadCache(sb, user.id);
        refreshHearts();
    }

    /* ─── sync localStorage → Supabase right after login ─── */
    async function syncPending(userId) {
        const pending = getP();
        if (!pending.length) return;
        const sb = window.supabaseClient;
        if (!sb || !userId) return;
        const rows = pending.map(listing_id => ({ listing_id, user_id: userId }));
        const { error } = await sb.from('favorites')
            .upsert(rows, { onConflict: 'user_id,listing_id', ignoreDuplicates: true });
        if (!error) {
            setP([]);
            _cache = null; // force reload on next toggle
            console.log('✅ [FAV] Synced', pending.length, 'pending favorites to Supabase');
        } else {
            console.error('❌ [FAV] Sync failed:', error.message);
        }
    }

    return { toggle, init, refreshHearts, syncPending };
})();

/* expose to global scope */
window.toggleFavorite       = FAV.toggle;
window.syncPendingFavorites  = FAV.syncPending;

/* init hearts once DOM + Supabase are ready */
document.addEventListener('DOMContentLoaded', () => setTimeout(FAV.init, 300));