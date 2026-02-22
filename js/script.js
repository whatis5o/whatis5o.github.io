/* ─────────────────────────────────────────
   GLOBAL NAVIGATION & AUTH STATE
   ───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    await initGlobalNav();
});

async function initGlobalNav() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;

    // 1. INSTANT UI UPDATE: Read from cache immediately
    const cachedRole = localStorage.getItem('afriStay_role');
    if (cachedRole) {
        const profileLink = (cachedRole === 'admin' || cachedRole === 'owner') ? '/Dashboard' : '/Profile';
        navRight.innerHTML = `
            <a href="/Favorites" class="icon-link" title="Favorites"><i class="fa-regular fa-heart"></i></a>
            <a href="${profileLink}" class="icon-link" title="${cachedRole === 'user' ? 'Profile' : 'Dashboard'}">
                <i class="fa-solid fa-circle-user" style="font-size: 24px; margin-left: 10px;"></i>
            </a>
        `;
    }

    // 2. BACKGROUND VERIFICATION: Silently ensure they are actually logged in
    const client = window.supabaseClient;
    if (!client) return;
    
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
        // If they aren't actually logged in, clear the cache and show Sign In
        localStorage.removeItem('afriStay_role');
        localStorage.removeItem('afriStay_firstName');
        navRight.innerHTML = `<a href="/Auth" class="signin-btn">Sign In</a>`;
    }
}

// Mobile Menu Logic
window.toggleMenu = function() {
    const navWrapper = document.getElementById("navWrapper");
    if(navWrapper) navWrapper.classList.toggle("active");
}

// Run the UI check when the script loads
document.addEventListener('DOMContentLoaded', initAuthUI);

function toggleMenu() {
document.getElementById("navWrapper").classList.toggle("active");
}
/* ─────────────────────────────────────────
   SHARED LISTING ENGINE (WITH DEBUGGING)
   ───────────────────────────────────────── */
function generateListingCard(listing, locationName) {
    // We will use a dynamically assigned final URL if it exists, otherwise fallback to the raw one
    const thumb = listing.final_thumb_url; 
    
    const avail = listing.availability_status || 'available';
    const isVeh = listing.category_slug === 'vehicle';
    const catLbl = isVeh ? 'Vehicle' : 'Real Estate';
    const catIcon = isVeh ? 'fa-car' : 'fa-house';
    const unit = isVeh ? '/day' : '/night';
    const price = Number(listing.price).toLocaleString();
    const currency = listing.currency || 'RWF';

    function esc(s) { return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

    return `
        <a href="/Detail/?id=${listing.id}" class="property-card">
            <div class="card-image">
                ${thumb ? `<img src="${esc(thumb)}" alt="${esc(listing.title)}" loading="lazy" onerror="console.error('❌ Failed to load image:', this.src)">` : `<div class="card-no-img"><i class="fa-solid fa-image" style="font-size:44px;color:#ddd;"></i></div>`}
                <div class="cat-label">${catLbl}</div>
                <div class="card-heart" onclick="event.preventDefault(); window.toggleFavorite && window.toggleFavorite(event, '${listing.id}')">
                    <i class="fa-regular fa-heart"></i>
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
                    <button class="details-btn" onclick="event.preventDefault(); window.location.href='/Detail/?id=${listing.id}'">View Details</button>
                </div>
            </div>
        </a>
    `;
}

window.fetchAndRenderSharedListings = async function(options) {
    const sb = window.supabaseClient;
    const container = document.getElementById(options.containerId);
    if (!container) return;

    console.log(`🚀 [ENGINE] Firing up fetch for container: #${options.containerId}`);

    // 1. Build Query 
    let q = sb.from('listings')
        .select(`
            id, title, price, currency, availability_status, status,
            category_slug, province_id, district_id, created_at,
            listing_images ( image_url )
        `)
        .eq('status', 'approved');

    if (options.featuredOnly) q = q.eq('featured', true);
    if (options.qtext) q = q.ilike('title', `%${options.qtext}%`);
    if (options.province) q = q.eq('province_id', options.province);
    if (options.district) q = q.eq('district_id', options.district);
    if (options.sector) q = q.eq('sector_id', options.sector);
    if (options.category) q = q.eq('category_slug', options.category);
    
    q = q.order('created_at', { ascending: false });
    if (options.limit) q = q.limit(options.limit);

    const { data: listings, error } = await q;

    console.log("📥 [ENGINE] Raw response from Supabase:", { listings, error });

    if (error || !listings || listings.length === 0) {
        container.innerHTML = `<div style="width:100%;text-align:center;padding:40px;color:#999;font-family:'Inter',sans-serif;">
            <i class="fa-solid fa-house-circle-xmark" style="font-size:40px;color:#EB6753;margin-bottom:12px;display:block;"></i>
            <p>${error ? error.message : 'No properties found.'}</p>
        </div>`;
        if (options.onComplete) options.onComplete(0);
        return;
    }

    if (listings.length > 0) {
        console.log("🔍 [ENGINE] Deep dive into first listing's image array:", listings[0].listing_images);
    }

    // 2. Fetch Locations
    const pvIds = [...new Set(listings.map(l => l.province_id).filter(Boolean))];
    const dtIds = [...new Set(listings.map(l => l.district_id).filter(Boolean))];
    const pvMap = {}, dtMap = {};
    if (pvIds.length) { const { data: ps } = await sb.from('provinces').select('id,name').in('id', pvIds); (ps||[]).forEach(p => pvMap[p.id] = p.name); }
    if (dtIds.length) { const { data: ds } = await sb.from('districts').select('id,name').in('id', dtIds); (ds||[]).forEach(d => dtMap[d.id] = d.name); }

    // 3. Render
    container.innerHTML = ''; 
    listings.forEach((l, index) => {
        const rawUrl = l.listing_images?.[0]?.image_url;
        let finalImageUrl = rawUrl;

        console.log(`🖼️ [ENGINE] Card ${index + 1} ('${l.title}') raw image_url:`, rawUrl);

        // MAGIC FIX: If the URL exists but doesn't start with "http", it's a bucket path!
        if (rawUrl && !rawUrl.startsWith('http')) {
            // Assuming your bucket name is 'listing_images' or 'properties' etc. 
            // Replace 'listing_images' below if your storage bucket is named differently!
            const bucketName = 'listing_images'; 
            const { data: publicUrlData } = sb.storage.from(bucketName).getPublicUrl(rawUrl);
            finalImageUrl = publicUrlData.publicUrl;
            console.log(`🔗 [ENGINE] Converted bucket path to public URL:`, finalImageUrl);
        }

        l.final_thumb_url = finalImageUrl;

        const locName = [dtMap[l.district_id], pvMap[l.province_id]].filter(Boolean).join(', ') || 'Rwanda';
        container.innerHTML += generateListingCard(l, locName);
    });

    if (options.onComplete) options.onComplete(listings.length);
};
