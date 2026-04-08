// ================================================
// ARCANE AUCTION — Supabase Frontend Script
// All data, realtime, and logic powered by Supabase
// ================================================

// ================================================
// SUPABASE CONFIG
// Replace these with your Supabase project values
// ================================================
const SUPABASE_URL = 'https://dvkevwwwcvqnuebtbkmf.supabase.co';       // e.g. https://abcdefgh.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2a2V2d3d3Y3ZxbnVlYnRia21mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDkzMTQsImV4cCI6MjA5MDAyNTMxNH0.Azv3kygHgkLreWlcBUOEGbKCL54MAR5bABA8YRvrtao'; // from Project Settings > API

// Initialize Supabase client (guarded to prevent script-halting errors)
var supabase;
try {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error('Failed to initialize Supabase client:', e);
  console.error('Make sure the Supabase CDN script is loaded before script.js');
}

// --- State ---
let currentUsername = '';
let currentUser = null; // Supabase auth user object
let bookmarks = JSON.parse(localStorage.getItem('arcane_bookmarks') || '[]');

// ================================================
// AUTH — Session check, sign in, sign out
// ================================================

// Check if user is already logged in (called on page load)
async function checkSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    setAuthenticatedUI(user);
  } else {
    setUnauthenticatedUI();
  }
}

// Update UI to show logged-in state
function setAuthenticatedUI(user) {
  currentUser = user;
  const meta = user.user_metadata || {};
  currentUsername = meta.full_name || meta.name || user.email || 'User';
  const avatarUrl = meta.avatar_url || meta.picture
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUsername)}&background=182446&color=8ff5ff&bold=true`;

  // Hide sign-in button, show user area
  document.getElementById('auth-signin-btn').classList.add('hidden');
  document.getElementById('auth-user-area').classList.remove('hidden');

  // Set avatar images
  document.getElementById('auth-avatar').src = avatarUrl;
  document.getElementById('dropdown-avatar').src = avatarUrl;
  document.getElementById('dropdown-name').textContent = currentUsername;
  document.getElementById('dropdown-email').textContent = user.email || '';
}

// Update UI to show logged-out state
function setUnauthenticatedUI() {
  currentUser = null;
  currentUsername = '';

  document.getElementById('auth-signin-btn').classList.remove('hidden');
  document.getElementById('auth-user-area').classList.add('hidden');

  // Close dropdown if open
  document.getElementById('profile-dropdown').classList.remove('open');
}

// Google OAuth sign-in
async function signInWithGoogle() {
  closeLoginModal();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  });
  if (error) {
    console.error('Google sign-in failed:', error.message);
    alert('Sign-in failed. Please try again.');
  }
  // Supabase will redirect to Google and back automatically
}

// Sign out
async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign-out failed:', error.message);
  }
  setUnauthenticatedUI();
  document.getElementById('profile-dropdown').classList.remove('open');
}

// Auth guard — wraps protected actions
// If logged in, runs the callback. If not, shows login modal.
async function handleProtectedAction(callback) {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    callback();
  } else {
    openLoginModal();
  }
}

// ================================================
// LOGIN MODAL
// ================================================
function openLoginModal() {
  document.getElementById('login-modal').classList.remove('hidden');
}

function closeLoginModal() {
  document.getElementById('login-modal').classList.add('hidden');
}

// ================================================
// PROFILE DROPDOWN
// ================================================
function toggleProfileDropdown() {
  document.getElementById('profile-dropdown').classList.toggle('open');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const userArea = document.getElementById('auth-user-area');
  const dropdown = document.getElementById('profile-dropdown');
  if (userArea && dropdown && !userArea.contains(e.target)) {
    dropdown.classList.remove('open');
  }
});

// ================================================
// AUTH STATE LISTENER — reacts to login/logout
// ================================================
function setupAuthListener() {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      setAuthenticatedUI(session.user);
    } else if (event === 'SIGNED_OUT') {
      setUnauthenticatedUI();
    }
  });
}

// ================================================
// FETCH & RENDER AUCTIONS
// ================================================
async function fetchAuctions() {
  // Query all auctions from Supabase, newest first
  const { data: auctions, error } = await supabase
    .from('auctions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch auctions:', error.message);
    renderFeaturedAuctions([]);
    renderAuctionGrid([]);
    return;
  }

  renderFeaturedAuctions((auctions || []).filter(a => a.status === 'live').slice(0, 3));
  renderAuctionGrid(auctions || []);
}

// --- Time remaining helper ---
function getTimeRemaining(endTime) {
  const total = new Date(endTime) - new Date();
  if (total <= 0) return 'Ended';
  const hours = Math.floor(total / (1000 * 60 * 60));
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  const seconds = Math.floor((total / 1000) % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// --- Status badge HTML ---
function statusBadge(status) {
  if (status === 'live') {
    return `<span class="px-3 py-1 bg-primary/20 backdrop-blur-md border border-primary/30 text-primary rounded-full text-[10px] font-bold uppercase tracking-widest">Live Now</span>`;
  } else if (status === 'upcoming') {
    return `<span class="px-3 py-1 bg-secondary/20 backdrop-blur-md border border-secondary/30 text-secondary rounded-full text-[10px] font-bold uppercase tracking-widest">Upcoming</span>`;
  } else {
    return `<span class="px-3 py-1 bg-error/20 backdrop-blur-md border border-error/30 text-error rounded-full text-[10px] font-bold uppercase tracking-widest">Ended</span>`;
  }
}

// --- Default images for auctions without a custom image ---
const defaultImages = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBtN3xuOpRh5edvHDQS-qwuREAInhsCmVKBWHmBSfOPS3HhX33Dyf0Ct6zDmFEjuRyyoy50jbWdyvtCzhLi-6yr812qlaPJThH6Zzkaows0r47M0k4vyxEN913bnpUjWYoxtrZMv11664Uy3XAEzjvCBc5jbvUgXr_4907fc-Tz1lRFmEyRxRHsgbItF0lR8HS7uGy_ADr1-pN2ejcQ3njzV41do19LSn4YaGj-_D6JqAZKrGX7lPAfcTZTpL_y43KP9hNtzRsnd74',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCF5GbvZvqbRpeD-JXCmWZUugQYm1U4e9Mux6kAMUjzMeSakPRWt0L0kbN4nxiZSicLOFpXNz_CcLEEXVy9FvNbZ4lUEZd8urYRZQiQXciAliYl3mPHXkO-w7a932lEMkQJrnUbL218l0_-yOyCYLwEMpnPb4Wr_DPf_LbaISAKVa8PFmuyoz14gQAWOfxSygc2z2Cs3CDt75ouTUMuLHaJClBDoFrHMtCNttTiTidjSl0hAQlVe14jnoL_qpj-N9j4LyxlVu15wNI',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBS93r_KUTrQXIiESjGHrma8Rk7vJS3MiIQWBlSg9TleYfsJVGPQEiLZT9cE88bO0dmSOG0NnvBJA4IpbMZKBDYPRa3EQDEAmRUTRY47aO6y5JvqNrZ0Y--1Fv4L-qCJqYnmZmkpPcTquLP-tZ6FsKVAjWbWLOKnMtMpyzsJbfma-6Mm4sQrjFbSfrtZ2Wk6Looq8gGL3gVvv8wER4ROSXWfnW-NTRfwNqjbxvjVmpsoIVpfrwv1SeC_oGvfC_86NvVMU6JnC6Loc0',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCVIRc9FddL7PItIjUVx5cmgzYt5xjD-SOgMoix7aWY1EOUwWup6AOVGuwGTdkeczxuGnvqzxRKn-dqLgPVUGnFgYbZyDlMLEW5PTgcnPWHwdAKe4_i_yBRw3H9lD9MOAL0ETxSsdXPv3tY7I5c_EpsMWCMNEDn089Qmury3B7Y94zAovoH_jgOdJZqS8CbCIpz7WRBrwuXsFOgppaYFNTFoI6RAHUz0TpRBWo_8_1elpMKCQ4BEVnuXCoKmL59mnVH5HL0VLO42Pw'
];

function getImage(auction, index) {
  return auction.image_url || defaultImages[index % defaultImages.length];
}

// --- Bookmark helpers ---
function isBookmarked(id) {
  return bookmarks.includes(id);
}

function toggleBookmark(id) {
  if (isBookmarked(id)) {
    bookmarks = bookmarks.filter(b => b !== id);
  } else {
    bookmarks.push(id);
  }
  localStorage.setItem('arcane_bookmarks', JSON.stringify(bookmarks));
  // Re-render to update icon state
  fetchAuctions();
}

// ================================================
// RENDER FEATURED AUCTIONS (Hero Carousel)
// ================================================
function renderFeaturedAuctions(auctions) {
  const container = document.getElementById('featured-scroll');
  if (!container) return;

  if (auctions.length === 0) {
    container.innerHTML = `<div class="flex-shrink-0 w-full flex items-center justify-center h-[200px]"><p class="text-outline/50 text-xl font-headline uppercase tracking-widest">No Events Scheduled</p></div>`;
    return;
  }

  container.innerHTML = auctions.map((a, i) => `
    <div class="flex-shrink-0 w-[450px] group" data-auction-id="${a.id}">
      <div class="relative rounded-3xl overflow-hidden glass-card transition-all duration-500 group-hover:scale-[1.02]">
        <img class="w-full h-[500px] object-cover" src="${getImage(a, i)}" alt="${a.title}" />
        <div class="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"></div>
        <div class="absolute top-6 left-6 flex gap-2">
          <span class="px-3 py-1 bg-primary text-on-primary rounded-full text-xs font-bold font-label uppercase tracking-widest">Live Now</span>
          <span class="px-3 py-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-xs font-label featured-timer" data-end="${a.end_time}">${getTimeRemaining(a.end_time)}</span>
        </div>
        <div class="absolute bottom-8 left-8 right-8">
          <h3 class="font-headline text-3xl font-bold mb-4 group-hover:text-primary transition-colors">${a.title}</h3>
          <div class="flex justify-between items-end">
            <div>
              <p class="text-sm text-on-surface-variant mb-1">Highest Bid</p>
              <p class="text-3xl font-headline font-bold text-gradient featured-bid" data-id="${a.id}">${Number(a.current_bid).toFixed(2)} ETH</p>
            </div>
            <button class="btn-pulse px-6 py-3 rounded-full font-bold text-on-primary" onclick="handleProtectedAction(() => openBidModal('${a.id}', ${a.current_bid}))">Join</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// ================================================
// RENDER AUCTION GRID
// ================================================
function renderAuctionGrid(auctions) {
  const grid = document.getElementById('auction-grid');
  if (!grid) return;

  if (auctions.length === 0) {
    grid.innerHTML = `<div class="col-span-full flex items-center justify-center py-24"><p class="text-outline/50 text-xl font-headline uppercase tracking-widest">No Events Scheduled</p></div>`;
    return;
  }

  grid.innerHTML = auctions.map((a, i) => {
    const isLive = a.status === 'live';
    const isEnded = a.status === 'ended';
    const isHost = currentUsername === a.host;

    const hoverColor = isLive ? 'rgba(143,245,255,0.1)' : 'rgba(224,182,255,0.1)';
    const accentClass = isLive ? 'primary' : 'secondary';
    const timeLabel = isLive ? 'Ending In' : (isEnded ? 'Ended' : 'Starts In');
    const timeValue = isEnded ? '—' : getTimeRemaining(a.end_time);
    const bidLabel = isLive ? 'Highest Bid' : (isEnded ? 'Final Bid' : 'Starting Price');

    // Bookmark icon state
    const bmFill = isBookmarked(a.id) ? 'text-error' : '';

    let actionBtn = '';
    if (isEnded) {
      actionBtn = `<span class="text-sm text-on-surface-variant italic">Winner: ${a.highest_bidder || 'No bids'}</span>`;
    } else if (isLive) {
      actionBtn = `<button class="bg-primary/10 hover:bg-primary text-primary hover:text-on-primary px-5 py-2 rounded-full text-sm font-bold transition-all" onclick="handleProtectedAction(() => openBidModal('${a.id}', ${a.current_bid}))">Join Auction</button>`;
    } else {
      actionBtn = `<button class="bg-secondary/10 hover:bg-secondary text-secondary hover:text-on-secondary px-5 py-2 rounded-full text-sm font-bold transition-all">Set Reminder</button>`;
    }

    let hostControl = '';
    if (isHost && isLive) {
      hostControl = `<button class="bg-error/10 hover:bg-error text-error hover:text-white px-4 py-1 rounded-full text-xs font-bold transition-all mt-2" onclick="endAuction('${a.id}')">End Auction</button>`;
    }

    return `
      <div class="glass-card rounded-2xl overflow-hidden group hover:shadow-[0_0_30px_${hoverColor}] transition-all duration-300" data-auction-card="${a.id}">
        <div class="h-64 relative overflow-hidden">
          <img class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" src="${getImage(a, i)}" alt="${a.title}" />
          <div class="absolute top-4 right-4 bg-black/60 backdrop-blur-md p-2 rounded-full border border-white/10 cursor-pointer hover:text-error transition-colors ${bmFill}" onclick="toggleBookmark('${a.id}')">
            <span class="material-symbols-outlined text-sm">bookmark</span>
          </div>
          <div class="absolute bottom-4 left-4">
            ${statusBadge(a.status)}
          </div>
          ${isEnded ? '<div class="absolute inset-0 bg-background/40 backdrop-blur-[1px]"></div>' : ''}
        </div>
        <div class="p-6">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="font-headline text-xl font-bold mb-1">${a.title}</h3>
              <p class="text-sm text-on-surface-variant">Host: ${a.host}</p>
            </div>
            <div class="text-right">
              <p class="text-[10px] text-on-surface-variant font-label uppercase tracking-widest">${timeLabel}</p>
              <p class="text-sm font-bold text-${accentClass} auction-timer" data-end="${a.end_time}" data-id="${a.id}">${timeValue}</p>
            </div>
          </div>
          <div class="flex justify-between items-center pt-4 border-t border-outline-variant/10">
            <div>
              <p class="text-[10px] text-on-surface-variant font-label uppercase tracking-widest">${bidLabel}</p>
              <p class="text-lg font-headline font-bold text-on-surface auction-bid" data-id="${a.id}">${Number(a.current_bid).toFixed(2)} ETH</p>
            </div>
            ${actionBtn}
          </div>
          ${hostControl}
        </div>
      </div>
    `;
  }).join('');
}

// ================================================
// BID MODAL
// ================================================
function openBidModal(auctionId, currentBid) {
  const modal = document.getElementById('bid-modal');
  const minBid = (currentBid + 0.01).toFixed(2);
  document.getElementById('bid-auction-id').value = auctionId;
  document.getElementById('bid-amount').value = '';
  document.getElementById('bid-amount').min = minBid;
  document.getElementById('bid-amount').placeholder = `Min: ${minBid} ETH`;
  document.getElementById('bid-current').textContent = `Current bid: ${Number(currentBid).toFixed(2)} ETH`;
  modal.classList.remove('hidden');
}

function closeBidModal() {
  document.getElementById('bid-modal').classList.add('hidden');
}

// ================================================
// PLACE BID — Supabase
// ================================================
async function submitBid() {
  const auctionId = document.getElementById('bid-auction-id').value;
  const amount = parseFloat(document.getElementById('bid-amount').value);

  if (!amount || isNaN(amount)) {
    alert('Please enter a valid bid amount');
    return;
  }

  // 1. Fetch current auction to validate bid
  const { data: auction, error: fetchErr } = await supabase
    .from('auctions')
    .select('current_bid, status')
    .eq('id', auctionId)
    .single();

  if (fetchErr || !auction) {
    alert('Auction not found');
    return;
  }
  if (auction.status === 'ended') {
    alert('This auction has ended');
    return;
  }
  if (amount <= auction.current_bid) {
    alert(`Bid must be higher than ${Number(auction.current_bid).toFixed(2)} ETH`);
    return;
  }

  // 2. Insert bid into bids table
  const { error: bidErr } = await supabase
    .from('bids')
    .insert({ auction_id: auctionId, bidder: currentUsername, amount });

  if (bidErr) {
    alert('Failed to place bid: ' + bidErr.message);
    return;
  }

  // 3. Update the auction's current_bid and highest_bidder
  const { error: updateErr } = await supabase
    .from('auctions')
    .update({ current_bid: amount, highest_bidder: currentUsername })
    .eq('id', auctionId);

  if (updateErr) {
    alert('Bid placed but failed to update auction: ' + updateErr.message);
    return;
  }

  closeBidModal();
}

// ================================================
// CREATE EVENT MODAL
// ================================================
function openCreateModal() {
  document.getElementById('create-modal').classList.remove('hidden');
}

function closeCreateModal() {
  document.getElementById('create-modal').classList.add('hidden');
}

// ================================================
// CREATE AUCTION — Supabase
// ================================================
async function submitAuction() {
  const title = document.getElementById('create-title').value.trim();
  const startingBid = parseFloat(document.getElementById('create-bid').value) || 0;
  const durationHours = parseFloat(document.getElementById('create-duration').value) || 1;
  const imageUrl = document.getElementById('create-image').value.trim();

  if (!title) {
    alert('Please enter an auction title');
    return;
  }

  const endTime = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

  // Insert new auction into Supabase
  const { error } = await supabase
    .from('auctions')
    .insert({
      title,
      host: currentUsername,
      image_url: imageUrl || null,
      current_bid: startingBid,
      highest_bidder: '',
      status: 'live',
      end_time: endTime
    });

  if (error) {
    alert('Failed to create auction: ' + error.message);
    return;
  }

  closeCreateModal();
  // Clear form
  document.getElementById('create-title').value = '';
  document.getElementById('create-bid').value = '';
  document.getElementById('create-duration').value = '1';
  document.getElementById('create-image').value = '';
}

// ================================================
// END AUCTION — Supabase (Host Control)
// ================================================
async function endAuction(auctionId) {
  if (!confirm('Are you sure you want to end this auction?')) return;

  // Verify host
  const { data: auction, error: fetchErr } = await supabase
    .from('auctions')
    .select('host')
    .eq('id', auctionId)
    .single();

  if (fetchErr || !auction) {
    alert('Auction not found');
    return;
  }
  if (auction.host !== currentUsername) {
    alert('Only the host can end this auction');
    return;
  }

  // Update status to ended
  const { error } = await supabase
    .from('auctions')
    .update({ status: 'ended' })
    .eq('id', auctionId);

  if (error) {
    alert('Failed to end auction: ' + error.message);
  }
}

// ================================================
// SUPABASE REALTIME — Subscribe to live changes
// ================================================
function setupRealtime() {
  // Listen for ANY change on the auctions table
  supabase
    .channel('auctions-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, (payload) => {
      // A row was inserted, updated, or deleted — re-fetch everything
      fetchAuctions();
    })
    .subscribe();

  // Listen for new bids (optional — for instant bid-amount UI update)
  supabase
    .channel('bids-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids' }, (payload) => {
      const bid = payload.new;
      // Update bid display instantly without full re-render
      document.querySelectorAll(`.auction-bid[data-id="${bid.auction_id}"]`).forEach(el => {
        el.textContent = `${Number(bid.amount).toFixed(2)} ETH`;
      });
      document.querySelectorAll(`.featured-bid[data-id="${bid.auction_id}"]`).forEach(el => {
        el.textContent = `${Number(bid.amount).toFixed(2)} ETH`;
      });
    })
    .subscribe();
}

// ================================================
// LIVE TIMERS — Update countdown every second
// ================================================
setInterval(() => {
  document.querySelectorAll('.auction-timer').forEach(el => {
    const endTime = el.dataset.end;
    if (endTime) {
      const remaining = getTimeRemaining(endTime);
      el.textContent = remaining;
    }
  });
  document.querySelectorAll('.featured-timer').forEach(el => {
    const endTime = el.dataset.end;
    if (endTime) el.textContent = getTimeRemaining(endTime);
  });
}, 1000);

// ================================================
// INIT — Run on page load
// ================================================
document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  setupAuthListener();
  fetchAuctions();
  setupRealtime();
});
