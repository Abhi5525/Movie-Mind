let currentUser = null;
let searchTimeout;


let activeFetchController = null;
let isRendering = false; // Add rendering lock

function abortActiveFetch() {
    if (activeFetchController) {
        activeFetchController.abort();
        activeFetchController = null;
    }
}
const base_url = window.location.origin;



let authButtons, userMenu, userAvatar, userName;

// ===== UTILITY FUNCTIONS =====
function getAuthHeaders() {
    const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    };

    if (currentUser && currentUser.token) {
        headers["Authorization"] = `Bearer ${currentUser.token}`;
    }

    return headers;
}
// Helper function to ensure user data has proper structure
function ensureUserDataStructure() {
    if (!currentUser) return;
    
    if (!Array.isArray(currentUser.watchlist)) {
        currentUser.watchlist = [];
    }
    if (!Array.isArray(currentUser.favorites)) {
        currentUser.favorites = [];
    }
    if (!Array.isArray(currentUser.watch_history)) {
        currentUser.watch_history = [];
    }
    if (!currentUser.ratings || typeof currentUser.ratings !== 'object') {
        currentUser.ratings = {};
    }
    
    saveUserData();
}

function showLoginModal() {
    closeModal('registerModal');
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('loginEmail')?.focus(), 100);
    }
}

function showRegisterModal() {
    closeModal('loginModal');
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('registerName')?.focus(), 100);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        clearFormErrors(modalId);
    }
}

function switchToRegister() {
    closeModal('loginModal');
    showRegisterModal();
}

function switchToLogin() {
    closeModal('registerModal');
    showLoginModal();
}

function clearFormErrors(modalId) {
    const form = document.getElementById(modalId === 'loginModal' ? 'loginForm' : 'registerForm');
    const errors = form.querySelectorAll('.error-message');
    const successes = form.querySelectorAll('.success-message');

    errors.forEach(error => {
        error.style.display = 'none';
        error.textContent = '';
    });

    successes.forEach(success => {
        success.style.display = 'none';
        success.textContent = '';
    });
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function showSuccess(elementId, message) {
    const successElement = document.getElementById(elementId);
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
    }
}

function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}


function saveUserData() {
    if (currentUser) {
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
    }
}
// ===== FORM HANDLERS =====
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Clear previous messages
        clearFormErrors("loginModal");

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        if (!email) {
            showError("loginEmailError", "Email is required");
            return;
        }
        if (!password) {
            showError("loginPasswordError", "Password is required");
            return;
        }

        const submitBtn = loginForm.querySelector(".form-btn");
        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Logging in...";
        submitBtn.disabled = true;

        try {
            await login(email, password);
            showSuccess("loginSuccess", "Login successful!");
            setTimeout(() => {
                closeModal("loginModal");
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                loginForm.reset();
                // Refresh recommendations or other user-specific data
            }, 1000);
        } catch (err) {
            showError("loginPasswordError", err.message || "Login failed");
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Clear previous messages
        clearFormErrors("registerModal");

        const name = document.getElementById("registerName").value.trim();
        const email = document.getElementById("registerEmail").value.trim();
        const password = document.getElementById("registerPassword").value;
        const confirmPassword = document.getElementById("registerConfirmPassword").value;

        let valid = true;
        if (!name) { showError("registerNameError", "Name is required"); valid = false; }
        if (!email) { showError("registerEmailError", "Email is required"); valid = false; }
        if (!password) { showError("registerPasswordError", "Password is required"); valid = false; }
        if (password.length < 6) { showError("registerPasswordError", "Password must be at least 6 characters"); valid = false; }
        if (!confirmPassword) { showError("registerConfirmError", "Confirm your password"); valid = false; }
        if (password !== confirmPassword) { showError("registerConfirmError", "Passwords do not match"); valid = false; }
        if (!valid) return;

        const submitBtn = registerForm.querySelector(".form-btn");
        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Creating account...";
        submitBtn.disabled = true;

        try {
            await register(name, email, password);
            showSuccess("registerSuccess", "Account created successfully!");
            setTimeout(() => {
                closeModal("registerModal");
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                registerForm.reset();

            }, 1000);
        } catch (err) {
            showError("registerEmailError", err.message || "Registration failed");
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
});

// ===== AUTH FUNCTIONS =====
async function login(email, password) {
    try {
        const res = await fetch(`${base_url}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            if (res.status === 401) {
                throw new Error("Invalid email or password");
            } else if (res.status === 422) {
                throw new Error(data.error || "Validation failed");
            }
            throw new Error(data.error || `Login failed (${res.status})`);
        }

        if (!data.access_token) {
            throw new Error("No access token received");
        }

        // Store user data with PROPER ARRAYS
        currentUser = {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            joinDate: data.user.joinDate || new Date().toISOString(),
            token: data.access_token,
            watchlist: [],  // Empty array
            watch_history: [],  // Empty array
            favorites: [],  // Empty array
            ratings: {}  // Empty object
        };

        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        updateUIForUser();
        showNotification('Login successful!', 'success');

        // Load user data after login
        await loadUserQuizData();
        updatePreferencesPanel();

        return currentUser;

    } catch (err) {
        console.error('Login error:', err);
        throw err;
    }
}

async function register(name, email, password) {
    const res = await fetch(`${base_url}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || "Registration failed");
    }

    // Auto login after registration
    currentUser = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        joinDate: data.user.joinDate,
        token: data.access_token,
        watchlist: [],
        watch_history: [],
        favorites: [],
        ratings: {}
    };

    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    updateUIForUser();
    showNotification('Account created successfully!', 'success');
}

function logout() {
    currentUser = null;
    localStorage.removeItem("currentUser");
    updateUIForUser();
    showNotification('Logged out successfully', 'info');
}

// Panel and UI
function updatePreferencesPanel() {
    if (!currentUser) return;

    const quizProfileInfo = document.getElementById('quizProfileInfo');
    if (!quizProfileInfo) return;

    // Check if user has quiz_profile in the response
    if (currentUser.quiz_profile) {
        const profile = currentUser.quiz_profile;
        quizProfileInfo.innerHTML = `
            <div style="background: rgba(0,229,255,0.1); padding: 15px; border-radius: 10px;">
                <h4 style="color: #00e5ff; margin-bottom: 5px;">${profile.name}</h4>
                <p style="font-size: 13px; opacity: 0.9; margin-bottom: 10px;">${profile.description}</p>
                <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                    ${profile.topGenres.map(genre =>
            `<span style="background: rgba(0,229,255,0.2); padding: 3px 8px; border-radius: 12px; font-size: 11px;">${genre}</span>`
        ).join('')}
                </div>
                <p style="font-size: 11px; opacity: 0.7; margin-top: 10px;">
                    Quiz taken: ${new Date(profile.takenAt).toLocaleDateString()}
                </p>
            </div>
        `;
    } else {
        quizProfileInfo.innerHTML = `
            <p style="color: #b0b7c3;">Take the quiz to get your movie profile!</p>
            <button onclick="startQuiz()" style="margin-top: 10px; padding: 8px 16px; background: #00e5ff; color: #000; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                Take Movie Quiz
            </button>
        `;
    }
}


function updateUIForUser() {
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');

    if (!authButtons || !userMenu) return;

    if (currentUser) {
        authButtons.style.display = 'none';
        userMenu.style.display = 'flex';
        if (userName) userName.textContent = currentUser.name || "User";
        if (userAvatar) userAvatar.textContent = (currentUser.name || "U").charAt(0).toUpperCase();
    } else {
        authButtons.style.display = 'flex';
        userMenu.style.display = 'none';
    }
}
// ===== USER PANEL =====

async function showUserPanel() {
    if (!currentUser || !currentUser.token) {
        showNotification('Please login to view your profile', 'info');
        showLoginModal();
        return;
    }

    try {
        console.log("Fetching user panel...");
        const res = await fetch(`${base_url}/user/panel`, {
            headers: getAuthHeaders()
        });

        console.log("Response status:", res.status);

        if (res.status === 401) {
            logout();
            showNotification("Session expired. Please log in again.", "error");
            return;
        }

        const data = await res.json();
        console.log("User panel data:", data);

        if (!data.success) {
            throw new Error(data.error || 'Failed to load user panel');
        }

        // Save current arrays BEFORE updating
        const savedWatchlist = currentUser.watchlist || [];
        const savedFavorites = currentUser.favorites || [];
        const savedWatchHistory = currentUser.watch_history || [];
        const savedRatings = currentUser.ratings || {};

        // Update ONLY non-array fields
        currentUser = {
            ...currentUser,
            name: data.name,
            email: data.email,
            joinDate: data.joinDate,
            quiz_profile: data.quiz_profile,
            // PRESERVE arrays - don't overwrite with numbers!
            watchlist: savedWatchlist,
            favorites: savedFavorites,
            watch_history: savedWatchHistory,
            ratings: savedRatings,
            token: currentUser.token
        };

        saveUserData();

        // Update the panel UI (shows counts from backend)
        updatePanelUI(data);

        // Load user data - this will populate actual arrays
        await loadUserData();

        // Show the modal
        const modal = document.getElementById('userPanelModal');
        if (modal) {
            modal.style.display = 'flex';
            console.log('User panel modal displayed');
        }

        // Switch to watchlist tab by default
        setTimeout(() => switchPanelTab('watchlist'), 100);

    } catch (err) {
        console.error('User panel error:', err);
        showNotification(`Failed to load user panel: ${err.message}`, 'error');
    }
}


function updatePanelUI(userData) {
    console.log("Updating panel UI with:", userData);
    
    // Update user info
    document.getElementById('panelUserName').textContent = userData.name || 'User';
    document.getElementById('panelUserEmail').textContent = userData.email || 'N/A';
    document.getElementById('memberSince').textContent = userData.joinDate || 'N/A';
    document.getElementById('userAvatarLarge').textContent = userData.name ? userData.name.charAt(0).toUpperCase() : 'U';
    
    // Update stats - ONLY update the numbers, don't overwrite arrays
    // The numbers come from the backend response
    document.getElementById('watchlistCount').textContent = userData.watchlist || 0;
    document.getElementById('moviesWatched').textContent = userData.watched || 0;
    document.getElementById('favoritesCount').textContent = userData.favorites || 0;
    document.getElementById('moviesRated').textContent = userData.rated || 0;
    
    // DON'T overwrite arrays here - they're loaded separately in loadUserData()
    
    // Update quiz profile if exists
    if (userData.quiz_profile) {
        updatePreferencesPanel(userData.quiz_profile);
    } else {
        const quizProfileInfo = document.getElementById('quizProfileInfo');
        if (quizProfileInfo) {
            quizProfileInfo.innerHTML = `
                <p style="color: #b0b7c3;">Take the quiz to get your movie profile!</p>
                <button onclick="startQuiz()" style="margin-top: 10px; padding: 8px 16px; background: #00e5ff; color: #000; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    Take Movie Quiz
                </button>
            `;
        }
    }
}

async function loadUserData() {
    if (!currentUser) return;

    try {
        await Promise.all([
            loadWatchlist(),
            loadWatchHistory(),
            loadFavorites(),
            loadRatings()
        ]);

        // Update UI after loading
        updateUserStats();
        updateWatchlistProgress();

    } catch (err) {
        console.error('Error loading user data:', err);
    }
}
function updateUserStats() {
    if (!currentUser) return;
    if (!Array.isArray(currentUser.favorites)) currentUser.favorites = [];
if (!Array.isArray(currentUser.watchlist)) currentUser.watchlist = [];
if (!Array.isArray(currentUser.watch_history)) currentUser.watch_history = [];
if (!currentUser.ratings || typeof currentUser.ratings !== 'object') currentUser.ratings = {};

    // Get counts from currentUser arrays (not numbers)
    const watchlistCount = Array.isArray(currentUser.watchlist) ? currentUser.watchlist.length : 0;
    const moviesWatched = Array.isArray(currentUser.watch_history) ? currentUser.watch_history.length : 0;
    const favoritesCount = Array.isArray(currentUser.favorites) ? currentUser.favorites.length : 0;
    const moviesRated = currentUser.ratings && typeof currentUser.ratings === 'object' ? 
        Object.keys(currentUser.ratings).length : 0;

    // Update UI elements
    const watchlistCountEl = document.getElementById('watchlistCount');
    const moviesWatchedEl = document.getElementById('moviesWatched');
    const favoritesCountEl = document.getElementById('favoritesCount');
    const moviesRatedEl = document.getElementById('moviesRated');

    if (watchlistCountEl) watchlistCountEl.textContent = watchlistCount;
    if (moviesWatchedEl) moviesWatchedEl.textContent = moviesWatched;
    if (favoritesCountEl) favoritesCountEl.textContent = favoritesCount;
    if (moviesRatedEl) moviesRatedEl.textContent = moviesRated;

    console.log("Stats updated:", { watchlistCount, moviesWatched, favoritesCount, moviesRated });
}
// Helper function to create movie item for panels
function createPanelMovieItem(movie, type = 'watchlist') {
    const item = document.createElement('div');
    item.className = 'movie-item panel-item';
    // Get movie ID properly
    const movieId = movie.id || movie.movieId || movie.movie_id;
    if (!movieId) {
        console.error('No movie ID found:', movie);
        return document.createElement('div'); // Return empty div
    }
    
    item.dataset.id = movieId;

    const hasImage = movie.poster_path || movie.image_url || movie.img;
    const imageUrl = hasImage ? (movie.poster_path || movie.image_url || movie.img) : 'https://placehold.co/150x200/233241/ffffff?text=No+Poster';
    const title = movie.title || movie.name || 'Unknown';
    const year = movie.release_date ? new Date(movie.release_date).getFullYear() : (movie.year || '');
    const rating = movie.vote_average || movie.rating || 'N/A';
    
    // FIX: Handle genres whether it's string or array
    let genres = [];
    if (movie.genres) {
        if (Array.isArray(movie.genres)) {
            genres = movie.genres;
        } else if (typeof movie.genres === 'string') {
            genres = movie.genres.split(',').map(g => g.trim());
        }
    }

    item.innerHTML = `
        <div class="panel-movie-poster">
            <img src="${imageUrl}" alt="${title}" 
                 onerror="this.src='https://placehold.co/150x200/233241/ffffff?text=No+Poster'">
            <div class="panel-movie-overlay">

                <button class="panel-remove-btn" data-movie-id="${movie.id || movie.movieId}" data-type="${type}"
                        title="Remove from ${type}">
                    <i class="fas fa-times"></i>
                </button>
                ${type === 'ratings' ? `
                    <div class="panel-user-rating">
                        <i class="fas fa-star"></i> ${movie.user_rating || movie.rating || 'N/A'}
                    </div>
                ` : ''}
            </div>
        </div>
        <div class="panel-movie-info">
            <h5 class="panel-movie-title" title="${title}">${title}</h5>
            <div class="panel-movie-details">
                <span class="panel-movie-year">${year}</span>
                <span class="panel-movie-rating">
                    <i class="fas fa-star"></i> ${rating}
                </span>
            </div>
            ${genres.length > 0 ? `
                <div class="panel-movie-genres">
                    ${genres.slice(0, 2).map(genre => 
                        `<span class="genre-tag">${genre}</span>`
                    ).join('')}
                </div>
            ` : ''}
        </div>
    `;
    return item;
}

function capitalizeFirstLetter(string) {
    // Handle special cases
    if (string === 'watch-history') {
        return 'WatchHistory';
    }
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function switchPanelTab(tabId) {
    console.log('Switching to tab:', tabId);

    // Remove active class from all tabs
    document.querySelectorAll('.panel-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Add active class to clicked tab button
    const tabButtons = document.querySelectorAll(`.panel-tab`);
    tabButtons.forEach(button => {
        if (button.getAttribute('onclick')?.includes(tabId)) {
            button.classList.add('active');
        }
    });

    // Hide all panel contents
    document.querySelectorAll('.panel-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });

    // Show the selected panel
    const panel = document.getElementById(`${tabId}-panel`);
    if (panel) {
        panel.classList.add('active');
        panel.style.display = 'block';
    }
}
function updateWatchlistProgress() {
    if (!currentUser || !currentUser.watchlist) return;

    const total = currentUser.watchlist.length;
    const watched = currentUser.watchlist.filter(movie =>
        currentUser.watch_history &&
        currentUser.watch_history.some(watchedMovie => watchedMovie.id === movie.id)
    ).length;

    const progress = total > 0 ? Math.round((watched / total) * 100) : 0;

    document.getElementById('watchlistProgressText').textContent = `${watched}/${total}`;
    document.getElementById('watchlistProgressBar').style.width = `${progress}%`;
}

// ===== WATCHLIST FUNCTIONS =====
async function addToWatchlist(movie) {
    if (!currentUser) {
        showNotification('Please login to add to watchlist', 'info');
        return;
    }

    // Check if already in watchlist
    if (currentUser.watchlist && currentUser.watchlist.some(m =>
        m.id === movie.id || m.movieId === movie.id
    )) {
        showNotification('Already in your watchlist', 'info');
        return;
    }

    try {
        const res = await fetch(`${base_url}/user/watchlist`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                movieId: movie.id,
                title: movie.title,
                poster_path: movie.poster_path,
                release_date: movie.release_date,
                vote_average: movie.vote_average,
                genres: movie.genres
            })
        });

        const data = await res.json();

        if (data.success) {
            showNotification('Added to watchlist', 'success');

            // Add to currentUser
            if (!currentUser.watchlist) currentUser.watchlist = [];
            currentUser.watchlist.push({
                id: movie.id,
                title: movie.title,
                poster_path: movie.poster_path,
                release_date: movie.release_date,
                vote_average: movie.vote_average
            });

            saveUserData();

            // Update UI
            if (document.getElementById('userPanelModal').style.display === 'flex') {
                await loadWatchlist();
            }
        }
    } catch (err) {
        console.error('Error adding to watchlist:', err);
        showNotification('Failed to add to watchlist', 'error');
    }
}
async function loadWatchlist() {
    if (!Array.isArray(currentUser.watchlist)) {
        currentUser.watchlist = [];
    }
    if (!currentUser) return;

    try {
        const res = await fetch(`${base_url}/user/watchlist`, {
            headers: getAuthHeaders()
        });

        if (!res.ok) throw new Error('Failed to load watchlist');

        const data = await res.json();
        console.log("Watchlist loaded:", data);

        const watchlistList = document.getElementById('watchlistList');
        const emptyState = document.getElementById('emptyWatchlist');

        if (!watchlistList || !emptyState) return;

        watchlistList.innerHTML = '';

        if (data.length === 0) {
            watchlistList.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        watchlistList.style.display = 'grid';

        // NORMALIZE DATA: Add 'id' field if it doesn't exist
        const normalizedData = data.map(item => ({
            ...item,
            id: item.id || item.movie_id  // Add 'id' field if missing
        }));

        // Update currentUser watchlist with normalized data
        currentUser.watchlist = normalizedData;

        // Render each movie with image
        normalizedData.forEach(movie => {
            const movieItem = createPanelMovieItem(movie, 'watchlist');
            watchlistList.appendChild(movieItem);
        });

        // Update stats
        updateUserStats();
        updateWatchlistProgress();

    } catch (err) {
        console.error('Error loading watchlist:', err);
        showNotification('Failed to load watchlist', 'error');
    }
}
// ===== IMPROVED TOGGLE WATCHLIST =====
async function toggleWatchlist(event, movieId, title, img, rating, year) {
    if (event) event.stopPropagation();
    if (!currentUser) {
        showLoginModal();
        return;
    }

    // ENSURE watchlist is an array
    if (!Array.isArray(currentUser.watchlist)) {
        currentUser.watchlist = [];
    }

    const wasInWatchlist = currentUser.watchlist.some(w => w.id === movieId);

    try {
        const res = await fetch(`${base_url}/user/watchlist/toggle`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${currentUser.token}` 
            },
            body: JSON.stringify({ 
                movie_id: movieId, 
                title, 
                img, 
                rating, 
                year 
            })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed");

        // Update currentUser
        if (wasInWatchlist) {
            currentUser.watchlist = currentUser.watchlist.filter(w => w.id !== movieId);
        } else {
            currentUser.watchlist.push({ id: movieId, title, img, rating, year });
        }
        saveUserData();

        // Update UI for this card only
        const card = document.querySelector(`.movie-card[data-movie-id="${movieId}"]`);
        if (card) {
            const btn = card.querySelector('.action-btn.watchlist');
            if (btn) {
                btn.classList.toggle('active', !wasInWatchlist);
                const icon = btn.querySelector('i');
                if (icon) {
                    icon.className = !wasInWatchlist ? 'fas fa-bookmark' : 'far fa-bookmark';
                }
            }
        }

        // Refresh panel if open
        const panelModal = document.getElementById('userPanelModal');
        if (panelModal && panelModal.style.display === 'flex') {
            await loadWatchlist();
            updateUserStats();
        }

        showNotification(data.message, 'success');
    } catch (err) {
        showNotification(err.message || 'Failed to update watchlist', 'error');
    }
}

// ===== WATCH HISTORY FUNCTIONS =====

async function addToWatchHistory(movie) {
    if (!currentUser) {
        showNotification('Please login to track your watch history', 'info');
        showLoginModal();
        return;
    }

    try {
        const res = await fetch(`${base_url}/user/watch-history`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                movie_id: movie.id,
                title: movie.title,
                img: movie.img || 'https://placehold.co/150x200/233241/ffffff?text=No+Poster',
                rating: movie.rating || 0,
                year: movie.year || new Date().getFullYear()
            })
        });

        if (res.status === 422) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Validation failed');
        }

        if (!res.ok) {
            throw new Error('Failed to add to watch history');
        }

        showNotification(`Added "${movie.title}" to your watch history`, 'success');

        // Update local user data if needed
        if (currentUser.watch_history) {
            currentUser.watch_history.push({
                id: movie.id,
                title: movie.title,
                img: movie.img,
                rating: movie.rating,
                year: movie.year,
                watchedDate: new Date().toISOString()
            });
            saveUserData();
        }

    } catch (err) {
        console.error('Watch history error:', err);
        showNotification(err.message || 'Failed to add to watch history', 'error');
    }
}

// FIXED loadWatchHistory function
async function loadWatchHistory() {
    if (!Array.isArray(currentUser.watchlist)) {
        currentUser.watchlist = [];
    }
    if (!currentUser) return;

    try {
        const res = await fetch(`${base_url}/user/watch-history/get`, {
            headers: { "Authorization": `Bearer ${currentUser.token}` }
        });

        if (!res.ok) throw new Error('Failed to load watch history');

        const recentHistory = await res.json();
        console.log("Watch history loaded:", recentHistory);

        const container = document.getElementById('watchHistoryList');
        const emptyState = document.getElementById('emptyWatchHistory');

        if (!container || !emptyState) return;

        container.innerHTML = '';

        if (!recentHistory || recentHistory.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        container.style.display = 'grid';

        // NORMALIZE DATA
        const normalizedData = recentHistory.map(item => ({
            ...item,
            id: item.id || item.movie_id
        }));

        // Update currentUser
        currentUser.watch_history = normalizedData;

        // Render each movie
        normalizedData.forEach(movie => {
            const movieItem = createPanelMovieItem(movie, 'watch-history');
            container.appendChild(movieItem);
        });

        updateUserStats();

    } catch (err) {
        console.error('Error loading watch history:', err);
        showNotification('Failed to load watch history', 'error');
    }
}

async function clearWatchlist() {
    if (!confirm('Clear your entire watchlist?')) return;

    try {
        const res = await fetch(`${base_url}/user/watchlist/clear`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const data = await res.json();

        if (data.success) {
            showNotification('Watchlist cleared', 'success');

            // Clear from currentUser
            currentUser.watchlist = [];

            // Update UI
            document.getElementById('watchlistList').innerHTML = '';
            document.getElementById('emptyWatchlist').style.display = 'block';

            // Update stats
            updateUserStats();
            updateWatchlistProgress();

            saveUserData();
        }
    } catch (err) {
        console.error('Error clearing watchlist:', err);
        showNotification('Failed to clear watchlist', 'error');
    }
}

async function clearWatchHistory() {
    if (!currentUser) return;

    if (!confirm("Are you sure you want to clear your watch history?")) {
        return;
    }

    try {
        const res = await fetch(`${base_url}/user/watch-history/clear`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const data = await res.json();

        if (data.success) {
            showNotification(data.message, 'success');
            // Update local state
            if (currentUser.watch_history) {
                currentUser.watch_history = [];
                saveUserData();
            }
            // Refresh UI
            loadWatchHistory();
            updateUserStats();
        } else {
            showNotification(data.error || 'Failed to clear watch history', 'error');
        }
    } catch (err) {
        console.error('Clear watch history error:', err);
        showNotification('Failed to clear watch history', 'error');
    }
}
async function removeFromWatchlist(movieId) {
    console.log('removeFromWatchlist called with movieId:', movieId, 'type:', typeof movieId);
    
    if (!movieId || movieId === 'undefined') {
        showNotification('Invalid movie ID', 'error');
        return;
    }

    if (!confirm('Remove from watchlist?')) return;

    try {
        // Convert to number since your endpoint expects int
        const movieIdNum = parseInt(movieId);
        console.log('Parsed movie ID:', movieIdNum);
        
        // Use the correct endpoint
        const res = await fetch(`${base_url}/user/watchlist/${movieIdNum}/remove`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        console.log('Remove response status:', res.status);
        
        if (!res.ok) {
            // Try alternative approach
            console.log('Direct DELETE failed, trying toggle...');
            const toggleRes = await fetch(`${base_url}/user/watchlist/toggle`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ 
                    movie_id: movieIdNum 
                })
            });
            
            const toggleData = await toggleRes.json();
            if (!toggleRes.ok) throw new Error(toggleData.error || 'Failed to remove from watchlist');
            
            showNotification(toggleData.message || 'Removed from watchlist', 'success');
        } else {
            const data = await res.json();
            showNotification(data.msg || 'Removed from watchlist', 'success');
        }

        // Remove from currentUser array
        if (currentUser.watchlist) {
            currentUser.watchlist = currentUser.watchlist.filter(movie => 
                String(movie.id) !== String(movieId) && 
                String(movie.movieId) !== String(movieId) &&
                String(movie.movie_id) !== String(movieId)
            );
        }

        // Reload watchlist
        await loadWatchlist();
        
    } catch (err) {
        console.error('Error removing from watchlist:', err);
        showNotification('Failed to remove from watchlist', 'error');
    }
}
async function removeFromFavorites(movieId) {
    console.log('removeFromFavorites called with movieId:', movieId, 'type:', typeof movieId);
    console.log('Current favorites:', currentUser.favorites);
    
    if (!movieId || movieId === 'undefined') {
        showNotification('Invalid movie ID', 'error');
        return;
    }

    if (!confirm('Remove from favorites?')) return;

    try {
        // Check if movie is actually in favorites - use loose comparison
        const isInFavorites = currentUser.favorites?.some(f => 
            f.id == movieId || f.movieId == movieId
        );
        
        if (!isInFavorites) {
            showNotification('Movie not in favorites', 'info');
            return;
        }

        // Convert to number
        const movieIdNum = parseInt(movieId);
        
        // Use toggle endpoint - it will remove if already in favorites
        const res = await fetch(`${base_url}/favorites/toggle`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ 
                movie_id: movieIdNum 
            })
        });

        const data = await res.json();
        console.log('Remove favorites response:', data);
        
        if (res.ok) {
            showNotification('Removed from favorites', 'success');

            // Remove from currentUser array
            if (currentUser.favorites) {
                currentUser.favorites = currentUser.favorites.filter(movie => 
                    String(movie.id) !== String(movieId) && 
                    String(movie.movieId) !== String(movieId) &&
                    String(movie.movie_id) !== String(movieId)
                );
            }

            // Update UI immediately
            updateMovieCardUI(movieIdNum, { isFavorite: false });
            
            // Reload favorites
            await loadFavorites();
        } else {
            throw new Error(data.error || 'Failed to remove from favorites');
        }
    } catch (err) {
        console.error('Error removing from favorites:', err);
        showNotification('Failed to remove from favorites', 'error');
    }
}

async function removeFromWatchHistory(movieId) {
    if (!confirm('Remove from watch history?')) return;

    try {
        // Use the correct endpoint from your backend
        const res = await fetch(`${base_url}/user/history/${movieId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!res.ok) throw new Error('Failed to remove from history');
        
        const data = await res.json();
        showNotification(data.msg || 'Removed from watch history', 'success');

        // Remove from currentUser array
        if (currentUser.watch_history) {
            currentUser.watch_history = currentUser.watch_history.filter(movie => 
                String(movie.id) !== String(movieId) && 
                String(movie.movieId) !== String(movieId) &&
                String(movie.movie_id) !== String(movieId)
            );
        }

        await loadWatchHistory();
        
    } catch (err) {
        console.error('Error removing from watch history:', err);
        showNotification('Failed to remove from watch history', 'error');
    }
}// ===== FAVORITES FUNCTIONS =====

async function toggleFavorite(eventOrMovieData, extraData) {
    let movieData;

    if (typeof eventOrMovieData === 'object' && eventOrMovieData.target) {
        eventOrMovieData.stopPropagation();
        if (!currentUser) { showLoginModal(); return; }
        movieData = extraData;
    } else {
        if (!currentUser) { showLoginModal(); return; }
        movieData = eventOrMovieData;
    }

    const { movie_id, title, img, rating, year } = movieData;
    
    // ENSURE favorites is an array
    if (!Array.isArray(currentUser.favorites)) {
        currentUser.favorites = [];
    }
    
    const wasFavorite = currentUser.favorites.some(f => f.id === movie_id);

    try {
        const res = await fetch(`${base_url}/favorites/toggle`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({ 
                movie_id: movie_id, 
                title: title, 
                img: img, 
                rating: rating, 
                year: year 
            })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || "Toggle failed");

        // Update currentUser
        if (wasFavorite) {
            currentUser.favorites = currentUser.favorites.filter(f => f.id !== movie_id);
        } else {
            currentUser.favorites.push({ id: movie_id, title, img, rating, year });
        }
        saveUserData();

        // Update UI for this movie
        updateMovieCardUI(movie_id, { isFavorite: !wasFavorite });

        // Refresh panel if open
        const panelModal = document.getElementById('userPanelModal');
        if (panelModal && panelModal.style.display === 'flex') {
            await loadFavorites();
            updateUserStats();
        }

        showNotification(data.message || "Favorite updated", 'success');
    } catch (err) {
        console.error('Favorite toggle error:', err);
        showNotification(err.message || 'Failed to update favorites', 'error');
    }
}
// UPDATED loadFavorites function
async function loadFavorites() {
    if (!Array.isArray(currentUser.watchlist)) {
        currentUser.watchlist = [];
    }
    if (!currentUser) return;

    try {
        const res = await fetch(`${base_url}/favorites/`, {
            headers: getAuthHeaders()
        });

        if (!res.ok) throw new Error('Failed to load favorites');

        const data = await res.json();
        console.log("Favorites loaded:", data);

        const container = document.getElementById('favoritesList');
        const emptyState = document.getElementById('emptyFavorites');

        if (!container || !emptyState) return;

        container.innerHTML = '';

        if (!data || data.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        container.style.display = 'grid';

        // NORMALIZE DATA
        const normalizedData = data.map(item => ({
            ...item,
            id: item.id || item.movie_id
        }));

        // Update currentUser
        currentUser.favorites = normalizedData;

        // Render each movie
        normalizedData.forEach(movie => {
            const movieItem = createPanelMovieItem(movie, 'favorites');
            container.appendChild(movieItem);
        });

        updateUserStats();

    } catch (err) {
        console.error('Error loading favorites:', err);
        showNotification('Failed to load favorites', 'error');
    }
}
async function clearFavorites() {
    if (!confirm('Clear all favorites?')) return;
    
    try {
        const res = await fetch(`${base_url}/favorites/clear`, {
            method: 'POST',  // Change from DELETE to POST
            headers: getAuthHeaders()
        });
        
        const data = await res.json();
        console.log('Clear favorites response:', data);
        
        if (data.message || data.success) {
            showNotification('Favorites cleared', 'success');
            
            // Clear from currentUser
            currentUser.favorites = [];
            
            // Update UI
            const favoritesList = document.getElementById('favoritesList');
            const emptyState = document.getElementById('emptyFavorites');
            
            if (favoritesList && emptyState) {
                favoritesList.innerHTML = '';
                favoritesList.style.display = 'none';
                emptyState.style.display = 'block';
            }
            
            // Update stats
            updateUserStats();
            
            saveUserData();
        } else {
            throw new Error('Failed to clear favorites');
        }
    } catch (err) {
        console.error('Error clearing favorites:', err);
        showNotification('Failed to clear favorites', 'error');
    }
}

// ===== RATINGS FUNCTIONS =====
// Rate a movie

// Fix the rateMovie function to update UI properly
async function rateMovie(movieId, rating) {
    if (!currentUser) {
        showNotification('Please login to rate movies', 'info');
        return;
    }

    try {
        const res = await fetch(`${base_url}/user/ratings`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                movieId: movieId,
                rating: rating
            })
        });

        const data = await res.json();

        if (data.success) {
            showNotification(`Rated ${rating} stars`, 'success');

            // Update currentUser
            if (!currentUser.ratings) currentUser.ratings = {};
            currentUser.ratings[movieId] = rating;

            // Update UI
            updateMovieRatingStars(movieId, rating);

            // Update panel if open
            const panelModal = document.getElementById('userPanelModal');
            if (panelModal && panelModal.style.display === 'flex') {
                await loadRatings();
                updateUserStats();
            }

            saveUserData();
        }
    } catch (err) {
        console.error('Error rating movie:', err);
        showNotification('Failed to rate movie', 'error');
    }
}

// Load ratings
async function loadRatings() {
    if (!currentUser) return;

    try {
        const res = await fetch(`${base_url}/user/ratings`, {
            headers: getAuthHeaders()
        });

        if (!res.ok) throw new Error('Failed to load ratings');

        const data = await res.json();
        console.log("Ratings loaded:", data);

        const ratingsList = document.getElementById('ratingsList');
        const emptyState = document.getElementById('emptyRatings');

        if (!ratingsList || !emptyState) return;

        ratingsList.innerHTML = '';

        if (data.length === 0) {
            ratingsList.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        ratingsList.style.display = 'grid';

        // Update currentUser ratings
        currentUser.ratings = {};
        
        // Render each rated movie
        data.forEach(item => {
            // Store rating in currentUser
            currentUser.ratings[item.movieId || item.movie_id] = item.rating;
            
            // Create movie item
            const movieItem = createPanelMovieItem({
                ...item.movie,
                id: item.movieId || item.movie_id,
                user_rating: item.rating
            }, 'ratings');
            ratingsList.appendChild(movieItem);
        });

    } catch (err) {
        console.error('Error loading ratings:', err);
        showNotification('Failed to load ratings', 'error');
    }
}// UNCOMMENT AND UPDATE these rating functions

function updateRating(event, movieId, title) {
    event.stopPropagation();

    const currentRating = currentUser.ratings ? currentUser.ratings[movieId] || 0 : 0;
    const newRating = parseInt(prompt(`Update rating for "${title}" (1-5):`, currentRating));

    if (newRating && newRating >= 1 && newRating <= 5) {
        rateMovie(movieId, newRating);
    }
}

function updateMovieRatingStars(movieId, rating) {
    const card = document.querySelector(`.movie-card[data-movie-id="${movieId}"]`);
    if (card) {
        const starsContainer = card.querySelector('.quick-rating');
        if (starsContainer) {
            const stars = starsContainer.querySelectorAll('.quick-star');
            stars.forEach((star, index) => {
                star.classList.toggle('active', index < rating);
            });
        }
    }
}

function getStarRating(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        stars += i <= rating ? '★' : '☆';
    }
    return stars;
}

async function clearRatings() {
    if (!currentUser) return;

    if (!confirm("Are you sure you want to clear all your ratings?")) {
        return;
    }

    try {
        const res = await fetch(`${base_url}/user/ratings/clear`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const data = await res.json();

        if (data.success) {
            showNotification(data.message, 'success');
            // Update local state
            if (currentUser.ratings) {
                currentUser.ratings = {};
                saveUserData();
            }
            // Refresh UI
            loadRatings();
            updateUserStats();
        } else {
            showNotification(data.error || 'Failed to clear ratings', 'error');
        }
    } catch (err) {
        console.error('Clear ratings error:', err);
        showNotification('Failed to clear ratings', 'error');
    }
}
async function removeFromRatings(movieId) {
    if (!confirm('Remove this rating?')) return;

    try {
        // Convert to number
        const movieIdNum = parseInt(movieId);
        
        // First try to delete using a DELETE endpoint if it exists
        // If not, we need to handle this differently
        const res = await fetch(`${base_url}/user/ratings`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                movie_id: movieIdNum
            })
        });

        // If DELETE not allowed, try a different approach
        if (res.status === 405) {
            // Check if you have a specific delete endpoint
            const deleteRes = await fetch(`${base_url}/user/ratings/${movieIdNum}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            
            if (deleteRes.ok) {
                const data = await deleteRes.json();
                showNotification(data.message || 'Rating removed', 'success');
            } else {
                throw new Error('No delete endpoint for ratings');
            }
        } else if (!res.ok) {
            throw new Error('Failed to remove rating');
        } else {
            const data = await res.json();
            showNotification(data.message || 'Rating removed', 'success');
        }

        // Remove from currentUser ratings
        if (currentUser.ratings && currentUser.ratings[movieId]) {
            delete currentUser.ratings[movieId];
        }

        // Reload ratings
        await loadRatings();
        
    } catch (err) {
        console.error('Error removing rating:', err);
        showNotification('Failed to remove rating. Try updating it to 0 stars instead.', 'error');
    }
}// ===== PREFERENCES FUNCTIONS =====


let currentMovieContext = {
    type: 'popular', // e.g., 'popular', 'search', 'genre', 'quiz', 'hybrid'
    params: {},
    data: []
};

function updateMovieContext(type, params, movies) {
    currentMovieContext = { type, params, data: movies };
    renderMovies(movies);
}
function updateMovieCardUI(movieId, updates) {
    const card = document.querySelector(`.movie-card[data-movie-id="${movieId}"]`);
    if (!card) return;

    if (updates.isInWatchlist !== undefined) {
        const btn = card.querySelector('.action-btn.watchlist');
        if (btn) {
            btn.classList.toggle('active', updates.isInWatchlist);
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = updates.isInWatchlist ? 'fas fa-bookmark' : 'far fa-bookmark';
            }
        }
    }

    if (updates.isFavorite !== undefined) {
        const btn = card.querySelector('.action-btn.favorite');
        if (btn) {
            btn.classList.toggle('active', updates.isFavorite);
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = updates.isFavorite ? 'fas fa-heart' : 'far fa-heart';
            }
        }
    }

    if (updates.userRating !== undefined) {
        const starsContainer = card.querySelector('.quick-rating');
        if (starsContainer) {
            const stars = starsContainer.querySelectorAll('.quick-star');
            stars.forEach((star, index) => {
                star.classList.toggle('active', index < updates.userRating);
            });
        }
    }
}

// ===== Render Movies =====
function renderMovies(list) {
    if (isRendering) return;
    isRendering = true;

    const movieContainer = document.getElementById('movieContainer');
    if (!movieContainer) {
        isRendering = false;
        return;
    }

    // Use a simple placeholder that won't cause file errors
    const PLACEHOLDER = 'https://placehold.co/150x200/233241/ffffff?text=No+Poster';

    requestAnimationFrame(() => {
        if (!list || !Array.isArray(list) || list.length === 0) {
            movieContainer.innerHTML = `
                <div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                    <i class="fas fa-search" style="font-size: 60px; opacity: 0.3; margin-bottom: 20px;"></i>
                    <h3 style="color: #00e5ff; margin-bottom: 10px;">No Movies Found</h3>
                    <p style="opacity: 0.7;">Try a different search term or browse popular movies</p>
                    <button onclick="fetchRecommendations()" style="margin-top: 20px; padding: 10px 25px; background: #00e5ff; color: black; border: none; border-radius: 25px; cursor: pointer; font-weight: 600;">
                        Show Popular Movies
                    </button>
                </div>
            `;
            isRendering = false;
            return;
        }

        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');
        tempDiv.style.display = 'contents';

        list.forEach(movie => {
            if (!movie || !movie.id || !movie.title) return;

            // In renderMovies() function, around line 1201:
            const isWatched = currentUser?.watch_history?.some ?
                currentUser.watch_history.some(w => w.id === movie.id) || false : false;

            const isInWatchlist = currentUser?.watchlist?.some ?
                currentUser.watchlist.some(item => item.id === movie.id) || false : false;

            const isFavorite = currentUser?.favorites?.some ?
                currentUser.favorites.some(fav => fav.id === movie.id) || false : false;

            const userRating = currentUser?.ratings?.[movie.id] || 0;
            const title = movie.title.replace(/['"]/g, '&quot;');
            const imgSrc = movie.img || PLACEHOLDER; // Use placeholder instead of local path

            const movieCard = document.createElement('div');
            movieCard.className = 'movie-card';
            movieCard.dataset.movieId = movie.id;
            movieCard.innerHTML = `
                ${isWatched ? '<div class="watchlist-status">Watched</div>' : ''}
                <span class="rating">⭐ ${movie.rating || 'N/A'}</span>
                <img src="${imgSrc}" alt="${movie.title}" loading="lazy" onerror="this.src='${PLACEHOLDER}'">
                <div class="movie-info">
                    <h3>${movie.title}</h3>
                    <p>${movie.genres || "Unknown Genre"}</p>
                    ${movie.year ? `<p style="font-size: 12px; opacity: 0.7; margin-top: 5px;">${movie.year}</p>` : ''}
                    <div class="movie-actions-grid">
                        <button class="action-btn watchlist ${isInWatchlist ? 'active' : ''}"
                            onclick="toggleWatchlist(event, ${movie.id}, '${title}', '${imgSrc}', ${movie.rating || 0}, ${movie.year || 0})">
                            <i class="${isInWatchlist ? 'fas' : 'far'} fa-bookmark"></i>
                        </button>
                        <button class="action-btn favorite ${isFavorite ? 'active' : ''}"
                            onclick="toggleFavorite({
                                movie_id: ${movie.id},
                                title: '${title}',
                                img: '${imgSrc}',
                                rating: ${movie.rating || 0},
                                year: ${movie.year || 0}
                            }); event.stopPropagation()">
                            <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i>
                        </button>
                            <div class="quick-rating">
                            ${[1, 2, 3, 4, 5].map(star => `
                                <span class="quick-star ${star <= userRating ? 'active' : ''}"
                                    onclick="rateMovie(${movie.id}, ${star}); event.stopPropagation()">★</span>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            tempDiv.appendChild(movieCard);
        });

        fragment.appendChild(tempDiv);
        movieContainer.innerHTML = '';
        movieContainer.appendChild(fragment);
        isRendering = false;
    });
}

async function fetchRecommendations(limit = 20) {
    const movieContainer = document.getElementById('movieContainer');
    if (!movieContainer) return;

    abortActiveFetch();
    activeFetchController = new AbortController();

    // Only show loading if container is empty or has different content
    const currentContent = movieContainer.innerHTML;
    if (!currentContent.includes('loading') && !currentContent.includes('movie-card')) {
        movieContainer.innerHTML = `
            <div class="loading" style="grid-column: 1 / -1; text-align: center; padding: 60px;">
                <i class="fas fa-film fa-spin" style="font-size: 50px; color: #00e5ff;"></i>
                <p>Loading movies...</p>
            </div>
        `;
    }

    try {
        let movies = [];
        let title = '🔥 Trending Movies';
        let oneTimeFetch = 0;

        if (currentUser?.token && oneTimeFetch === 0) {
            try {
                const hybridRes = await fetch(`${base_url}/recommendations/hybrid?user_id=${currentUser.id}`, {
                    headers: { "Authorization": `Bearer ${currentUser.token}` },
                    signal: activeFetchController.signal
                });
                if (hybridRes.ok) {
                    const hybridData = await hybridRes.json();
                    if (hybridData.recommendations?.length > 0) {
                        movies = hybridData.recommendations;
                        title = '✨ Recommended for You';
                        oneTimeFetch = 1;
                    }
                }
            } catch (err) {
                console.log("Hybrid recommendations failed, falling back to popular");
            }
        }

        if (movies.length === 0) {
            const res = await fetch(`${base_url}/recommendations/popular?top_n=${limit}`, {
                signal: activeFetchController.signal
            });
            const data = await res.json();
            movies = data.recommendations || [];
            title = '🔥 Trending Movies';
        }

        document.getElementById('sectionTitle').textContent = title;
        currentMovieContext = { type: 'recommendations', params: {}, data: movies };
        renderMovies(movies);
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Error in fetchRecommendations:", err);
            movieContainer.innerHTML = `
                <div class="no-results" style="grid-column:1/-1;text-align:center;padding:60px;color:#ff6b6b;">
                    Failed to load movies.
                    <button onclick="fetchRecommendations()" style="margin-top: 10px; padding: 8px 20px; background: #00e5ff; color: black; border: none; border-radius: 20px; cursor: pointer;">
                        Try Again
                    </button>
                </div>`;
        }
        //  useFallbackMovies();
    }
}

let searchDebounceTimer;
async function performSearch(query) {
    const movieContainer = document.getElementById('movieContainer');
    if (!movieContainer) return;

    clearTimeout(searchDebounceTimer);

    if (!query?.trim()) {
        fetchRecommendations();
        return;
    }

    abortActiveFetch();
    activeFetchController = new AbortController();

    // Show loading only if not already showing
    if (!movieContainer.innerHTML.includes('loading')) {
        movieContainer.innerHTML = `
            <div class="loading" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <i class="fas fa-search fa-spin" style="font-size: 40px; color: #00e5ff;"></i>
                <p>Searching for "${query}"...</p>
            </div>
        `;
    }

    closeModal('userPanelModal');
    document.getElementById('sectionTitle').textContent = `🔍 Search Results for "${query}"`;

    // Debounce to prevent flicker
    searchDebounceTimer = setTimeout(async () => {
        try {
            const response = await fetch(`${base_url}/search?query=${encodeURIComponent(query)}`, {
                signal: activeFetchController.signal
            });
            if (!response.ok) throw new Error('Search failed');
            const data = await response.json();
            const movies = data.results || [];
            currentMovieContext = { type: 'search', params: { query }, data: movies };
            renderMovies(movies);
            if (movies.length === 0) {
                document.getElementById('sectionTitle').textContent = `🔍 No results for "${query}"`;
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Search error:', err);
                movieContainer.innerHTML = `
                    <div class="no-results" style="grid-column:1/-1;text-align:center;padding:60px;">
                        Search failed. 
                        <button onclick="fetchRecommendations()" style="margin-top: 10px; padding: 8px 20px; background: #00e5ff; color: black; border: none; border-radius: 20px; cursor: pointer;">
                            Show Popular
                        </button>
                    </div>`;
            }
        }
    }, 300);
}
// ===== Filter by Genre =====
async function filterByGenre(genre) {
    if (genre === 'All') {
        fetchRecommendations();
        return;
    }

    const movieContainer = document.getElementById('movieContainer');
    if (!movieContainer) return;

    abortActiveFetch();
    activeFetchController = new AbortController();

    movieContainer.innerHTML = `
    <div class="loading" style="grid-column: 1 / -1; text-align: center; padding: 60px;">
      <i class="fas fa-film fa-spin" style="font-size: 50px; color: #00e5ff;"></i>
      <p>Loading ${genre} movies...</p>
    </div>
  `;
    document.getElementById('sectionTitle').textContent = `🎥 ${genre} Movies`;

    try {
        const res = await fetch(`${base_url}/recommendations/genre?genre=${encodeURIComponent(genre)}`, {
            signal: activeFetchController.signal
        });
        const data = await res.json();
        updateMovieContext('genre', { genre }, data.recommendations || []);
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Genre filter error:', err);
            movieContainer.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#ff6b6b;">No movies found for ${genre}.</p>`;
        }
    }
}
// ===== Get Personalized Recommendations =====
function getPersonalizedRecommendations() {
    if (!currentUser) {
        showNotification('Please login to get personalized recommendations!', 'info');
        showLoginModal();
        return;
    }

    const movieContainer = document.getElementById('movieContainer');
    if (movieContainer) {
        movieContainer.innerHTML = `
            <div class="loading" style="grid-column: 1 / -1; text-align: center; padding: 60px;">
                <i class="fas fa-user-cog fa-spin" style="font-size: 50px; color: #00e5ff;"></i>
                <p>Analyzing your preferences...</p>
            </div>
        `;
    }

    // Call the same function used by fetchRecommendations
    abortActiveFetch();
    activeFetchController = new AbortController();

    fetch(`${base_url}/recommendations/hybrid?user_id=${currentUser.id}`, {
        headers: getAuthHeaders(),
        signal: activeFetchController.signal
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                document.getElementById('sectionTitle').textContent = '✨ Recommended for You';
                currentMovieContext = {
                    type: 'personalized',
                    params: { userId: currentUser.id },
                    data: data.recommendations
                };
                renderMovies(data.recommendations);
            }
        })
        .catch(err => {
            if (err.name !== 'AbortError') {
                console.error(err);
                showNotification('Using popular movies instead', 'info');
                fetchRecommendations();
            }
        });
}



// ===== QUIZ QUESTIONS DATA =====
const quizQuestions = [
    {
        question: "What's your movie-watching mood?",
        description: "Choose how you're feeling right now",
        options: [
            {
                icon: "🎬",
                text: "Blockbuster Action",
                desc: "Explosions, car chases, epic battles",
                tags: ["action", "adventure", "thriller"],
                weights: { "Action": 3, "Adventure": 2, "Thriller": 1 }
            },
            {
                icon: "😊",
                text: "Feel-Good Fun",
                desc: "Light-hearted, funny, heartwarming",
                tags: ["comedy", "romance", "family"],
                weights: { "Comedy": 3, "Romance": 2, "Family": 1 }
            },
            {
                icon: "🧠",
                text: "Mind-Bending Mystery",
                desc: "Plot twists, puzzles, deep thinking",
                tags: ["mystery", "thriller", "drama"],
                weights: { "Mystery": 3, "Thriller": 2, "Drama": 1 }
            },
            {
                icon: "🌟",
                text: "Fantasy Escape",
                desc: "Magic, adventures, other worlds",
                tags: ["fantasy", "adventure", "sci-fi"],
                weights: { "Fantasy": 3, "Adventure": 2, "Sci-Fi": 1 }
            }
        ]
    },
    {
        question: "What setting appeals to you most?",
        description: "Pick your preferred movie backdrop",
        options: [
            {
                icon: "🌌",
                text: "Space & Future",
                desc: "Galaxies, technology, distant futures",
                tags: ["sci-fi", "space", "future"],
                weights: { "Sci-Fi": 3, "Adventure": 2 }
            },
            {
                icon: "🏰",
                text: "Historical Periods",
                desc: "Past eras, costumes, true stories",
                tags: ["historical", "drama", "biography"],
                weights: { "History": 3, "Drama": 2, "Biography": 1 }
            },
            {
                icon: "🏙️",
                text: "Modern Cities",
                desc: "Urban life, relationships, contemporary",
                tags: ["drama", "comedy", "romance"],
                weights: { "Drama": 2, "Comedy": 2, "Romance": 1 }
            },
            {
                icon: "🌳",
                text: "Nature & Wilderness",
                desc: "Outdoors, survival, animals",
                tags: ["adventure", "drama", "nature"],
                weights: { "Adventure": 3, "Drama": 1 }
            }
        ]
    },
    {
        question: "What's your ideal movie length?",
        description: "How much time do you want to invest?",
        options: [
            {
                icon: "⏱️",
                text: "Quick & Snappy (< 90 min)",
                desc: "Fast-paced, concise stories",
                tags: ["short", "fast-paced", "comedy"],
                weights: { "Comedy": 2, "Action": 1 }
            },
            {
                icon: "⏰",
                text: "Standard Length (90-120 min)",
                desc: "Well-paced, complete narratives",
                tags: ["standard", "balanced"],
                weights: {} // Neutral
            },
            {
                icon: "⌛",
                text: "Epic Journey (2.5+ hours)",
                desc: "Immersive, detailed world-building",
                tags: ["epic", "immersive", "detailed"],
                weights: { "Adventure": 2, "Drama": 1, "Fantasy": 1 }
            }
        ]
    },
    {
        question: "How do you feel about emotional scenes?",
        description: "Your tolerance for emotional content",
        options: [
            {
                icon: "😭",
                text: "Bring on the Feels",
                desc: "Love deep, emotional stories",
                tags: ["emotional", "drama", "romance"],
                weights: { "Drama": 3, "Romance": 2 }
            },
            {
                icon: "😐",
                text: "Moderate Emotions",
                desc: "Some emotion but not overwhelming",
                tags: ["balanced", "moderate"],
                weights: {} // Neutral
            },
            {
                icon: "😎",
                text: "Keep It Light",
                desc: "Prefer fun over serious emotions",
                tags: ["light", "fun", "comedy"],
                weights: { "Comedy": 3, "Animation": 1 }
            }
        ]
    },
    {
        question: "What's more important to you?",
        description: "Choose what makes a movie great for you",
        options: [
            {
                icon: "🎭",
                text: "Character Development",
                desc: "Complex characters and growth",
                tags: ["character-driven", "drama"],
                weights: { "Drama": 3, "Biography": 2 }
            },
            {
                icon: "🎪",
                text: "Plot & Story",
                desc: "Engaging narrative and twists",
                tags: ["plot-driven", "mystery"],
                weights: { "Mystery": 3, "Thriller": 2 }
            },
            {
                icon: "🎨",
                text: "Visuals & Style",
                desc: "Cinematography, special effects",
                tags: ["visual", "style", "sci-fi"],
                weights: { "Sci-Fi": 2, "Fantasy": 2, "Animation": 1 }
            },
            {
                icon: "😂",
                text: "Entertainment Value",
                desc: "Fun, laughs, enjoyment",
                tags: ["entertaining", "comedy"],
                weights: { "Comedy": 3, "Action": 2 }
            }
        ]
    }
];

// ===== MOVIE PROFILES DATA =====
const movieProfiles = {
    "action_lover": {
        name: "Action Movie Buff",
        description: "You thrive on adrenaline! Car chases, explosions, and epic battles get your heart pumping. You appreciate well-choreographed action sequences and heroic protagonists.",
        tags: ["Explosions", "Heroic", "Fast-paced", "Thrilling"]
    },
    "thoughtful_thinker": {
        name: "Thoughtful Thinker",
        description: "You enjoy movies that make you ponder. Complex characters, moral dilemmas, and psychological depth are what you look for in a film.",
        tags: ["Intellectual", "Deep", "Philosophical", "Character-driven"]
    },
    "comfort_seeker": {
        name: "Comfort Seeker",
        description: "You love feel-good movies that warm your heart. Rom-coms, light dramas, and uplifting stories are your go-to for a cozy movie night.",
        tags: ["Feel-good", "Uplifting", "Heartwarming", "Relaxing"]
    },
    "fantasy_explorer": {
        name: "Fantasy Explorer",
        description: "You escape to magical worlds and extraordinary adventures. Mythology, world-building, and imaginative storytelling captivate you.",
        tags: ["Magical", "Imaginative", "Epic", "Adventurous"]
    },
    "genre_explorer": {
        name: "Genre Explorer",
        description: "You have diverse tastes and enjoy exploring different genres. From indie dramas to blockbuster adventures, you appreciate variety in cinema.",
        tags: ["Diverse", "Experimental", "Versatile", "Curious"]
    }
};

// Add this fallback function
function useFallbackMovies() {
    const fallbackMovies = [
        {
            id: 1,
            title: "The Shawshank Redemption",
            rating: 9.3,
            year: 1994,
            genres: "Drama",
            img: "https://placehold.co/150x200/233241/ffffff?text=Shawshank"
        },
        {
            id: 2,
            title: "The Godfather",
            rating: 9.2,
            year: 1972,
            genres: "Crime, Drama",
            img: "https://placehold.co/150x200/233241/ffffff?text=Godfather"
        },
        {
            id: 3,
            title: "The Dark Knight",
            rating: 9.0,
            year: 2008,
            genres: "Action, Crime, Drama",
            img: "https://placehold.co/150x200/233241/ffffff?text=Dark+Knight"
        }
    ];

    renderMovies(fallbackMovies);
    document.getElementById('sectionTitle').textContent = '🔥 Popular Movies';
    showNotification('Using demo data', 'info');
}
// ===== QUIZ SYSTEM =====
function startQuiz() {
    if (!currentUser) {
        showNotification('Please login to save your quiz results!', 'info');
        showLoginModal();
        return;
    }

    quizState = {
        currentStep: 0,
        answers: {},
        profile: {},
        quizStarted: true
    };

    closeModal('loginModal');
    closeModal('registerModal');
    closeModal('userPanelModal');
    showQuizStep(0);
    document.getElementById('quizModal').style.display = 'flex';
}

function showQuizStep(stepIndex) {
    const quizContainer = document.getElementById('quizContainer');
    const question = quizQuestions[stepIndex];

    const progress = ((stepIndex + 1) / quizQuestions.length) * 100;

    quizContainer.innerHTML = `
        <div class="quiz-step">
            <div class="quiz-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <p style="font-size: 13px; opacity: 0.7;">Question ${stepIndex + 1} of ${quizQuestions.length}</p>
            </div>

            <div class="quiz-question">
                <h3>${question.question}</h3>
                <p>${question.description}</p>
            </div>

            <div class="quiz-options" id="quizOptions">
                ${question.options.map((option, index) => `
                    <div class="quiz-option" 
                         onclick="selectQuizOption(${stepIndex}, ${index})"
                         id="option_${stepIndex}_${index}">
                        <div class="quiz-option-icon">${option.icon}</div>
                        <div class="quiz-option-text">${option.text}</div>
                        <div class="quiz-option-desc">${option.desc}</div>
                    </div>
                `).join('')}
            </div>

            <div class="quiz-navigation">
                ${stepIndex > 0 ? `<button class="quiz-btn prev" onclick="prevQuizStep()">← Previous</button>` : '<div></div>'}
                ${stepIndex < quizQuestions.length - 1 ? `
                    <button class="quiz-btn next" onclick="nextQuizStep()" id="nextBtn" disabled>Next →</button>
                ` : `
                    <button class="quiz-btn next" onclick="finishQuiz()" id="nextBtn" disabled>See Results</button>
                `}
            </div>
        </div>
    `;

    if (quizState.answers[stepIndex] !== undefined) {
        const selectedIndex = quizState.answers[stepIndex];
        const optionElement = document.getElementById(`option_${stepIndex}_${selectedIndex}`);
        if (optionElement) {
            optionElement.classList.add('selected');
            document.getElementById('nextBtn').disabled = false;
        }
    }
}

function selectQuizOption(questionIndex, optionIndex) {
    const options = document.querySelectorAll(`#quizOptions .quiz-option`);
    options.forEach(opt => opt.classList.remove('selected'));

    const selectedOption = document.getElementById(`option_${questionIndex}_${optionIndex}`);
    selectedOption.classList.add('selected');

    quizState.answers[questionIndex] = optionIndex;
    document.getElementById('nextBtn').disabled = false;
}

function nextQuizStep() {
    if (quizState.currentStep < quizQuestions.length - 1) {
        quizState.currentStep++;
        showQuizStep(quizState.currentStep);
    }
}

function prevQuizStep() {
    if (quizState.currentStep > 0) {
        quizState.currentStep--;
        showQuizStep(quizState.currentStep);
    }
}

// Restart quiz
function restartQuiz() {
    document.getElementById('quizResults').style.display = 'none';
    document.getElementById('quizContainer').style.display = 'block';
    quizState.currentStep = 0;
    quizState.answers = {};
    showQuizStep(0);
}

function analyzeQuizAnswers() {
    const answers = quizState.answers;
    let genreScores = {};
    let tags = new Set();

    Object.keys(answers).forEach(questionIndex => {
        const question = quizQuestions[questionIndex];
        const answerIndex = answers[questionIndex];
        const option = question.options[answerIndex];

        option.tags.forEach(tag => tags.add(tag));

        if (option.weights) {
            Object.entries(option.weights).forEach(([genre, weight]) => {
                genreScores[genre] = (genreScores[genre] || 0) + weight;
            });
        }
    });

    const topGenres = Object.entries(genreScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([genre]) => genre);

    let profileType = "genre_explorer";
    if (genreScores["Action"] >= 2.5 && genreScores["Adventure"] >= 2.5) profileType = "action_lover";
    else if (genreScores["Drama"] >= 2.0 && genreScores["Mystery"] >= 2.0) profileType = "thoughtful_thinker";
    else if (genreScores["Comedy"] >= 2.0 && genreScores["Romance"] >= 2.0) profileType = "comfort_seeker";
    else if (genreScores["Fantasy"] >= 2.0 && genreScores["Sci-Fi"] >= 2.0) profileType = "fantasy_explorer";

    const profileData = movieProfiles[profileType];

    return {
        profileType: profileType,
        topGenres: topGenres,
        tags: Array.from(tags),
        name: profileData.name,
        description: profileData.description
    };
}

async function saveQuizResults(profile) {
    if (!currentUser) return null;

    try {
        console.log("Saving quiz results:", profile);
        console.log("Answers:", quizState.answers);

        const payload = {
            profileType: profile.profileType,
            name: profile.name,
            description: profile.description,
            topGenres: profile.topGenres,
            tags: profile.tags,
            answers: quizState.answers
        };

        console.log("Payload:", payload);

        const res = await fetch(`${base_url}/quiz/save`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        console.log("Save response status:", res.status);
        console.log("Save response headers:", res.headers.get('content-type'));

        // Check if response is JSON
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const text = await res.text();
            console.error("Non-JSON response:", text.substring(0, 200));

            if (res.status === 405) {
                throw new Error(`Method not allowed. Check if /quiz/save accepts POST`);
            } else if (res.status === 404) {
                throw new Error(`Endpoint not found: /quiz/save`);
            } else {
                throw new Error(`Server returned HTML (${res.status}): ${text.substring(0, 100)}...`);
            }
        }

        const data = await res.json();
        console.log("Save response data:", data);

        if (!res.ok) {
            throw new Error(data.error || `Failed to save quiz results (${res.status})`);
        }

        // Update currentUser with quiz profile
        currentUser.quiz_profile = profile;
        currentUser.quiz_taken_at = new Date().toISOString();
        currentUser.quiz_result_id = data.quiz_result?.id;
        saveUserData();

        console.log("Quiz results saved successfully");
        return data.quiz_result;

    } catch (err) {
        console.error("Failed to save quiz results:", err);
        showNotification('Quiz results saved locally only', 'info');
        return null;
    }
}


async function getLatestQuizResult() {
    if (!currentUser) return null;

    try {
        const res = await fetch(`${base_url}/quiz/latest`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();

        if (data.success && data.has_quiz) {
            return data.quiz_result;
        }
        return null;
    } catch (err) {
        console.error("Failed to get quiz results:", err);
        return null;
    }
}

async function loadUserQuizData() {
    if (!currentUser) return;

    try {
        const latestQuiz = await getLatestQuizResult();
        if (latestQuiz) {
            // Update currentUser with quiz data from database
            currentUser.quiz_profile = {
                profileType: latestQuiz.profile_type,
                name: latestQuiz.profile_name,
                description: latestQuiz.profile_description,
                topGenres: latestQuiz.top_genres,
                tags: latestQuiz.tags
            };
            currentUser.quiz_result_id = latestQuiz.id;
            saveUserData();
        }
    } catch (err) {
        console.error("Failed to load quiz data:", err);
    }
}


async function showQuizResults(profile) {
    const profileData = movieProfiles[profile.profileType];

    document.getElementById('quizContainer').style.display = 'none';
    document.getElementById('quizResults').style.display = 'block';

    document.getElementById('quizProfileText').innerHTML = `
        <strong>${profileData.name}</strong><br>
        ${profileData.description}
    `;

    const tagsContainer = document.getElementById('quizTags');
    const allTags = [...profile.tags, ...profileData.tags];
    const uniqueTags = [...new Set(allTags)].slice(0, 6);

    tagsContainer.innerHTML = uniqueTags.map(tag => `<span class="quiz-tag">${tag}</span>`).join('');

    // Save to database and locally
    if (currentUser) {
        // Save to database
        const savedResult = await saveQuizResults(profile);

        // Update local storage
        currentUser.quiz_profile = profile;
        currentUser.preferred_genres = profile.topGenres;
        if (savedResult) {
            currentUser.quiz_result_id = savedResult.id;
        }
        saveUserData();

        // Update preferences panel
        updatePreferencesPanel();
    }
}


// Update finishQuiz function
async function finishQuiz() {
    const profile = analyzeQuizAnswers();
    quizState.profile = profile;
    await showQuizResults(profile); // Changed to async

    // Call Flask API for quiz recommendations
    getQuizRecommendations();
}

// Update getQuizRecommendations function
function getQuizRecommendations() {
    if (!currentUser) {
        showNotification('Please login to get quiz recommendations!', 'info');
        showLoginModal();
        return;
    }

    const genres = quizState.profile?.topGenres || currentUser.quiz_profile?.topGenres || [];
    const tags = quizState.profile?.tags || currentUser.quiz_profile?.tags || [];

    if (genres.length === 0) {
        showNotification('No quiz data found. Please take the quiz first.', 'error');
        return;
    }

    showNotification('Fetching quiz-based recommendations...', 'info');
    closeModal('quizModal');

    abortActiveFetch();
    activeFetchController = new AbortController();

    const movieContainer = document.getElementById('movieContainer');
    if (movieContainer) {
        movieContainer.innerHTML = `
            <div class="loading" style="grid-column: 1 / -1; text-align: center; padding: 60px;">
                <i class="fas fa-list-alt fa-spin" style="font-size: 50px; color: #00e5ff;"></i>
                <p>Finding your perfect movies...</p>
            </div>
        `;
        document.getElementById('sectionTitle').textContent = '🎯 Quiz Recommendations';
    }

    // Build URL - use the correct endpoint
    const url = `${base_url}/recommendations/quiz?user_id=${currentUser.id}&genres=${genres.join(',')}&tags=${tags.join(',')}`;
    console.log("Fetching quiz recs from:", url);

    fetch(url, {
        headers: getAuthHeaders(),
        signal: activeFetchController.signal
    })
        .then(async (res) => {
            console.log("Quiz recs response status:", res.status);

            // Check content type
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                const text = await res.text();
                console.error("Non-JSON response:", text.substring(0, 200));
                throw new Error(`Server returned HTML instead of JSON (${res.status})`);
            }

            const data = await res.json();
            console.log("Quiz recs data:", data);

            if (!res.ok) {
                throw new Error(data.error || `Request failed (${res.status})`);
            }

            if (data.success && Array.isArray(data.recommendations)) {
                console.log(`Got ${data.recommendations.length} recommendations`);
                updateMovieContext('quiz', { genres, tags }, data.recommendations);
                showNotification(`Found ${data.recommendations.length} movies based on your quiz!`, 'success');
            } else {
                throw new Error('Invalid or empty recommendations');
            }
        })
        .catch(err => {
            if (err.name !== 'AbortError') {
                console.error('Quiz recommendations failed:', err);

                // Fallback: use test data
                const testMovies = [
                    {
                        id: 101,
                        title: "Based on your quiz: Comedy Special",
                        rating: 8.5,
                        year: 2023,
                        genres: "Comedy",
                        img: "https://placehold.co/150x200/233241/ffffff?text=Quiz+Movie+1"
                    },
                    {
                        id: 102,
                        title: "Personalized Drama",
                        rating: 8.2,
                        year: 2022,
                        genres: "Drama",
                        img: "https://placehold.co/150x200/233241/ffffff?text=Quiz+Movie+2"
                    },
                    {
                        id: 103,
                        title: "Your Mystery Pick",
                        rating: 8.0,
                        year: 2021,
                        genres: "Mystery, Thriller",
                        img: "https://placehold.co/150x200/233241/ffffff?text=Quiz+Movie+3"
                    }
                ];

                updateMovieContext('quiz', { genres, tags }, testMovies);
                showNotification('Showing personalized recommendations (demo)', 'info');
            }
        });
}


// Retake quiz function
function retakeQuiz() {
    if (!currentUser) {
        showNotification('Please login to save your quiz results!', 'info');
        showLoginModal();
        return;
    }

    if (confirm("Do you want to retake the quiz? Your previous results will be saved but new results will override them.")) {
        startQuiz();
    }
}

// Clear quiz results function
async function clearQuizResults() {
    if (!currentUser) return;

    if (!confirm("Are you sure you want to clear all your quiz results? This action cannot be undone.")) {
        return;
    }

    try {
        const res = await fetch(`${base_url}/quiz/clear`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });

        const data = await res.json();
        if (data.success) {
            // Clear local data
            delete currentUser.quiz_profile;
            delete currentUser.quiz_result_id;
            delete currentUser.preferred_genres;
            saveUserData();

            // Update UI
            updatePreferencesPanel();
            showNotification('Quiz results cleared successfully', 'success');
        } else {
            throw new Error(data.error);
        }
    } catch (err) {
        console.error("Failed to clear quiz results:", err);
        showNotification('Failed to clear quiz results', 'error');
    }
}

// ===== INITIALIZATION =====
function initializeQuiz() {
    // Reset quiz state
    quizState = {
        currentStep: 0,
        answers: {},
        profile: {},
        quizStarted: false
    };
}
async function testAllFunctions() {
    console.log("=== Testing All Functions ===");
    
    if (!currentUser) {
        console.log("Not logged in");
        return;
    }
    
    // Ensure data structure
    ensureUserDataStructure();
    
    // Test 1: Rate a movie
    console.log("Testing rating...");
    try {
        await rateMovie(1, 4);
        console.log("✓ Rating test passed");
    } catch (e) {
        console.log("✗ Rating test failed:", e.message);
    }
    
    // Wait
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Add to favorites
    console.log("Testing favorites...");
    try {
        await toggleFavorite({
            movie_id: 1,
            title: "Test Movie",
            img: "https://placehold.co/150x200",
            rating: 8.5,
            year: 2023
        });
        console.log("✓ Favorites test passed");
    } catch (e) {
        console.log("✗ Favorites test failed:", e.message);
    }
    
    // Wait
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: Add to watchlist
    console.log("Testing watchlist...");
    try {
        await toggleWatchlist(null, 1, "Test Movie", "https://placehold.co/150x200", 8.5, 2023);
        console.log("✓ Watchlist test passed");
    } catch (e) {
        console.log("✗ Watchlist test failed:", e.message);
    }
    
    // Wait
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 4: Add to watch history
    console.log("Testing watch history...");
    try {
        await addToWatchHistory({
            id: 1,
            title: "Test Movie",
            img: "https://placehold.co/150x200",
            rating: 8.5,
            year: 2023
        });
        console.log("✓ Watch history test passed");
    } catch (e) {
        console.log("✗ Watch history test failed:", e.message);
    }
    
    console.log("=== Tests Complete ===");
}

async function testEndpoints() {
    console.log("=== Testing Endpoints ===");

    // Check if user is logged in
    if (!currentUser || !currentUser.token) {
        console.log("No user logged in. Testing without auth...");
    } else {
        console.log("Testing with user token:", currentUser.token.substring(0, 20) + "...");
    }

    const endpoints = [
        {
            path: '/quiz/save', method: 'POST', needsAuth: true, body: {
                profileType: 'test_profile',
                name: 'Test Profile',
                description: 'Test description',
                topGenres: ['Action', 'Drama'],
                tags: ['action', 'drama'],
                answers: { 1: 1, 2: 2 }
            }
        },
        { path: '/user/panel', method: 'GET', needsAuth: true },
        { path: '/user/watchlist', method: 'GET', needsAuth: true },
        { path: '/user/watchlist/clear', method: 'DELETE', needsAuth: true },
        { path: '/user/watch-history/clear', method: 'DELETE', needsAuth: true },
        { path: '/user/ratings/clear', method: 'DELETE', needsAuth: true },
        { path: '/favorites/', method: 'GET', needsAuth: true }
    ];

    for (const endpoint of endpoints) {
        try {
            const url = `${base_url}${endpoint.path}`;
            console.log(`\nTesting ${endpoint.method}: ${url}`);

            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            // Add auth header if needed and we have a token
            if (endpoint.needsAuth && currentUser && currentUser.token) {
                headers['Authorization'] = `Bearer ${currentUser.token}`;
                console.log(`  Using token: ${currentUser.token.substring(0, 20)}...`);
            } else if (endpoint.needsAuth) {
                console.log(`  Skipping - needs auth but no token`);
                continue;
            }

            const options = {
                method: endpoint.method,
                headers: headers,
                credentials: 'include'  // Important for cookies if using them
            };

            // Add body for POST requests
            if (endpoint.method === 'POST' && endpoint.body) {
                options.body = JSON.stringify(endpoint.body);
            }

            const res = await fetch(url, options);

            console.log(`  Status: ${res.status} - ${res.statusText}`);

            if (!res.ok) {
                try {
                    const errorText = await res.text();
                    console.log(`  Error: ${errorText.substring(0, 200)}...`);
                } catch (e) {
                    console.log('  Could not read error response');
                }
            } else {
                try {
                    const data = await res.json();
                    console.log(`  Success:`, data);
                } catch (e) {
                    const text = await res.text();
                    console.log(`  Response (not JSON): ${text.substring(0, 200)}...`);
                }
            }

        } catch (err) {
            console.error(`  Error: ${err.message}`);
        }
    }
}
// ===== ENHANCED DOM CONTENT LOADED =====
document.addEventListener("DOMContentLoaded", () => {
    initializeQuiz();
    const saveUser = localStorage.getItem("currentUser");
    if (saveUser) {
        try {
            currentUser = JSON.parse(saveUser);
            ensureUserDataStructure(); // ADD THIS LINE
            updateUIForUser();
        } catch (e) {
            console.error("Failed to parse saved user:", e);
            localStorage.removeItem("currentUser");
        }
    }

    if (currentUser) {
        loadUserQuizData().then(() => {
            ensureUserDataStructure()
            updatePreferencesPanel();
        });
    }

    document.getElementById('movieContainer')?.addEventListener('click', (e) => {
        const card = e.target.closest('.movie-card');
        if (card && currentUser) {
            const movieId = parseInt(card.dataset.movieId);
            const movie = currentMovieContext.data.find(m => m.id === movieId);
            if (movie) {
                addToWatchHistory(movie);
            }
        }
    });
    // Initialize search with proper debounce
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
        let searchTimer;
        searchBox.addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            const query = e.target.value.trim();
            searchTimer = setTimeout(() => {
                performSearch(query);
            }, 500);
        });

        searchBox.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimer);
                performSearch(e.target.value.trim());
            }
        });
    }

    // Restore user session
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            updateUIForUser();
        } catch (e) {
            console.error("Failed to parse saved user:", e);
            localStorage.removeItem("currentUser");
        }
    }

    // Initial fetch
    setTimeout(() => fetchRecommendations(), 100);

    // Movie card click for watch history
    document.addEventListener('click', (e) => {
        const card = e.target.closest('.movie-card');
        if (card && currentUser) {
            const movieId = parseInt(card.dataset.movieId);
            const movie = currentMovieContext.data.find(m => m.id === movieId);
            if (movie) {
                addToWatchHistory(movie);
            }
        }
    });
// Add this to your initialization code
document.addEventListener('click', function(e) {
    // Handle panel remove buttons
    if (e.target.closest('.panel-remove-btn')) {
        const btn = e.target.closest('.panel-remove-btn');
        const movieId = btn.dataset.movieId;
        const type = btn.dataset.type;
        
        if (type === 'watchlist') removeFromWatchlist(movieId);
        else if (type === 'favorites') removeFromFavorites(movieId);
        else if (type === 'watch-history') removeFromWatchHistory(movieId);
        else if (type === 'ratings') removeFromRatings(movieId);
    }
});
    // Close modals on outside click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
            abortActiveFetch();
        }
    });
    setTimeout(testEndpoints, 1000);
    setTimeout(testAllFunctions, 1000);

});


// async function loadPreferences() {
//     if (!currentUser) return;
//     try {
//         const res = await fetch(`/user/${currentUser.id}/history`);
//         const data = await res.json();
//         const container = document.getElementById('preferredGenres');
//         container.innerHTML = (data.preferred_genres || []).map(g => `<span class="genre-tag">${g}</span>`).join('') || '<p>No preferences yet</p>';
//     } catch (err) { console.error(err); }
// }

// function updatePreferredGenres() {
//     if (!currentUser || !currentUser.ratings || Object.keys(currentUser.ratings).length < 3) {
//         return;
//     }

//     // This is a simplified version - in production, you'd analyze movie genres
//     if (!currentUser.preferred_genres || currentUser.preferred_genres.length === 0) {
//         currentUser.preferred_genres = ['Action', 'Drama', 'Sci-Fi'];
//     }
// }

// async function markAsWatched(event, movieId) {
//     event.stopPropagation();
//     if (!currentUser) return;

//     try {
//         const res = await fetch(`${base_url}/user/watchlist/mark-watched/${movieId}`, {
//             method: "POST",
//             headers: { "Authorization": `Bearer ${currentUser.token}` }
//         });
//         const data = await res.json();
//         if (!res.ok) throw data;

//         showNotification(data.msg, 'success');
//         loadWatchlist();
//         loadWatchHistory();
//         updateUserStats();
//     } catch (err) {
//         showNotification(err.msg || 'Failed to mark as watched', 'error');
//     }
// }
// async function autoAddSimilarMovies(movieId, title) {
//     showNotification(`Looking for movies similar to "${title}"...`, 'info');

//     try {
//         const res = await fetch(`${base_url}/recommendations/similar/${movieId}`, {
//             headers: { "Authorization": `Bearer ${currentUser.token}` }
//         });
//         const similarMovies = await res.json();
//         if (!res.ok) throw similarMovies;

//         // Example: add first 3 similar movies to watchlist automatically
//         for (let movie of similarMovies.slice(0, 3)) {
//             await toggleWatchlist({ stopPropagation: () => { } }, movie.id, movie.title, movie.img, movie.rating, movie.year);
//         }

//         showNotification(`Added similar movies to your watchlist!`, 'success');
//     } catch (err) {
//         showNotification(err.msg || "Failed to fetch similar movies", "error");
//     }
// }
// Debug movie clicks
document.addEventListener('click', (e) => {
    const card = e.target.closest('.movie-card');
    if (card) {
        console.log('Movie clicked:', {
            movieId: card.dataset.movieId,
            hasUser: !!currentUser,
            currentMovieContext: currentMovieContext.data.length
        });
    }
});

// Debug API responses
const originalFetch = window.fetch;
window.fetch = function(...args) {
    console.log('Fetch:', args[0], args[1]?.method || 'GET');
    return originalFetch.apply(this, args).then(res => {
        console.log('Response:', args[0], res.status);
        return res;
    });
};