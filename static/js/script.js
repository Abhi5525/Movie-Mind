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
const base_url = window.location.origin ;



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
            // Check for specific error messages
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

        // Store user data
        currentUser = {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            joinDate: data.user.joinDate || new Date().toISOString(),
            token: data.access_token,
            watchlist: data.user.watchlist || [],
            watch_history: data.user.history || [],
            favorites: data.user.favorites || [],
            ratings: data.user.ratings || {}
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
    if (!currentUser) {
        showNotification('Please login to view your profile', 'info');
        showLoginModal();
        return;
    }

    try {
        console.log("Fetching user panel with token:", currentUser.token ? "Yes" : "No");
        const res = await fetch(`${base_url}/user/panel`, {
            headers: getAuthHeaders()
        });

        console.log("User panel response status:", res.status);
        
        if (res.status === 401) {
            logout();
            showNotification("Session expired. Please log in again.", "error");
            return;
            }
        if (res.status === 422) {
            // Get the error message
            const errorText = await res.text();
            console.error("422 Error details:", errorText);
 // Try to parse as JSON
            try {
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.error || "Validation failed");
            } catch (e) {
                throw new Error("Invalid user data format");
            }
        }
        if (!res.ok) {
            throw new Error('Failed to load user panel');
        }

        const data = await res.json();
        console.log(data)

        // Update currentUser with fresh data
        currentUser = { ...currentUser, ...data };
        saveUserData();

        // Update panel UI
        document.getElementById('panelUserName').textContent = currentUser.name;
        document.getElementById('panelUserEmail').textContent = currentUser.email;
        document.getElementById('memberSince').textContent = currentUser.joinDate;
        document.getElementById('userAvatarLarge').textContent = currentUser.name.charAt(0).toUpperCase();

        updateUserStats();
        await loadWatchlist();
        await loadWatchHistory();
        await loadFavorites();
        await loadRatings();
        loadPreferences();

        document.getElementById('userPanelModal').style.display = 'flex';
        switchPanelTab('watchlist');
    } catch (err) {
        console.error(err);
        showNotification('Failed to load user panel', 'error');
    }
}

function switchPanelTab(tabId) {
    document.querySelectorAll('.panel-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const tabButton = document.querySelector(`[onclick="switchPanelTab('${tabId}')"]`);
    if (tabButton) tabButton.classList.add('active');

    document.querySelectorAll('.panel-content').forEach(content => {
        content.classList.remove('active');
    });
    const panel = document.getElementById(`${tabId}-panel`);
    if (panel) panel.classList.add('active');
}

function updateUserStats() {
    if (!currentUser) return;

    const watchlistCount = currentUser.watchlist ? currentUser.watchlist.length : 0;
    const moviesWatched = currentUser.watch_history ? currentUser.watch_history.length : 0;
    const favoritesCount = currentUser.favorites ? currentUser.favorites.length : 0;
    const moviesRated = currentUser.ratings ? Object.keys(currentUser.ratings).length : 0;

    const watchlistCountEl = document.getElementById('watchlistCount');
    const moviesWatchedEl = document.getElementById('moviesWatched');
    const favoritesCountEl = document.getElementById('favoritesCount');
    const moviesRatedEl = document.getElementById('moviesRated');

    if (watchlistCountEl) watchlistCountEl.textContent = watchlistCount;
    if (moviesWatchedEl) moviesWatchedEl.textContent = moviesWatched;
    if (favoritesCountEl) favoritesCountEl.textContent = favoritesCount;
    if (moviesRatedEl) moviesRatedEl.textContent = moviesRated;

    updateWatchlistProgress();
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

async function autoAddSimilarMovies(movieId, title) {
    showNotification(`Looking for movies similar to "${title}"...`, 'info');

    try {
        const res = await fetch(`${base_url}/recommendations/similar/${movieId}`, {
            headers: { "Authorization": `Bearer ${currentUser.token}` }
        });
        const similarMovies = await res.json();
        if (!res.ok) throw similarMovies;

        // Example: add first 3 similar movies to watchlist automatically
        for (let movie of similarMovies.slice(0, 3)) {
            await toggleWatchlist({ stopPropagation: () => { } }, movie.id, movie.title, movie.img, movie.rating, movie.year);
        }

        showNotification(`Added similar movies to your watchlist!`, 'success');
    } catch (err) {
        showNotification(err.msg || "Failed to fetch similar movies", "error");
    }
}

async function addToWatchlist(movie) {
    if (!currentUser) {
        showNotification('Please login to add to watchlist', 'info');
        showLoginModal();
        return;
    }

    try {
        const res = await fetch(`${base_url}/user/watchlist/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentUser.token}` },
            body: JSON.stringify({
                movie_id: movie.id,
                title: movie.title,
                img: movie.img,
                rating: movie.rating,
                year: movie.year
            })
        });
        const data = await res.json();
        if (!res.ok) throw data;
        showNotification(`Added "${movie.title}" to watchlist`, 'success');
        loadWatchlist();
    } catch (err) {
        showNotification(err.msg || 'Failed to add to watchlist', 'error');
    }
}

async function loadWatchlist() {
    if (!currentUser) return;
    

    const res = await fetch(`${base_url}/user/watchlist`, {
        headers: { "Authorization": `Bearer ${currentUser.token}` }
    });
    if (res.status === 401) {
  logout();
  showNotification("Session expired. Please log in again.", "error");
  return;
}
    const watchlist = await res.json();

    const container = document.getElementById('watchlistList');
    container.innerHTML = watchlist.map(movie => `
        <div class="movie-item">
            <img src="${movie.img || '/static/images/poster-not-available.jpg'}">
            <div class="movie-info-small">
                <h4>${movie.title.length > 20 ? movie.title.substring(0, 20) + '...' : movie.title}</h4>
                <p>⭐ ${movie.rating || 'N/A'} • ${movie.year || 'N/A'}</p>
            </div>
            <button class="movie-action-btn remove" onclick="removeFromWatchlist(${movie.movie_id})">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

async function removeFromWatchlist(movieId) {
    if (!currentUser) return;

    try {
        await fetch(`${base_url}/user/watchlist/${movieId}/remove`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${currentUser.token}` }
        });
        showNotification('Removed from watchlist', 'info');
        loadWatchlist();
    } catch (err) {
        showNotification('Failed to remove from watchlist', 'error');
    }
}
async function markAsWatched(event, movieId) {
    event.stopPropagation();
    if (!currentUser) return;

    try {
        const res = await fetch(`${base_url}/user/watchlist/mark-watched/${movieId}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${currentUser.token}` }
        });
        const data = await res.json();
        if (!res.ok) throw data;

        showNotification(data.msg, 'success');
        loadWatchlist();
        loadWatchHistory();
        updateUserStats();
    } catch (err) {
        showNotification(err.msg || 'Failed to mark as watched', 'error');
    }
}
// ===== IMPROVED TOGGLE WATCHLIST =====
async function toggleWatchlist(event, movieId, title, img, rating, year) {
    if (event) event.stopPropagation();
    if (!currentUser) {
        showLoginModal();
        return;
    }

    const wasInWatchlist = currentUser.watchlist?.some(w => w.id === movieId) || false;

    try {
        const res = await fetch(`${base_url}/user/watchlist/toggle`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentUser.token}` },
            body: JSON.stringify({ movie_id: movieId, title, img, rating, year })
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
async function loadWatchHistory() {
    if (!currentUser) return;

    const res = await fetch(`${base_url}/user/watch-history/get`, {
        headers: { "Authorization": `Bearer ${currentUser.token}` }
    });
    const recentHistory = await res.json();

    // Get last 20 watched movies
const container = document.getElementById('watchHistoryList'); // ✅ declare
  const emptyState = document.getElementById('emptyWatchHistory'); // ✅ declare

    container.innerHTML = recentHistory.map(movie => `
        <div class="movie-item">
            <img src="${movie.img || '/static/images/poster-not-available.jpg'}" alt="${movie.title}">
                <h4>${movie.title.length > 20 ? movie.title.substring(0, 20) + '...' : movie.title}</h4>
                <p>⭐ ${movie.rating || 'N/A'} • ${movie.year || 'N/A'}</p>
                <p style="font-size: 10px; color: #666;">Watched: ${new Date(movie.watchedDate).toLocaleDateString()}</p>
            </div>
            <div class="movie-actions">
                <button class="movie-action-btn remove" onclick="removeFromHistory(event, ${movie.id})" title="Remove">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');

    container.style.display = 'grid';
    emptyState.style.display = 'none';
}


async function removeFromHistory(event, movieId) {
    event.stopPropagation();
    try {
        await fetch(`${base_url}/user/history/${movieId}`, {
            method: 'DELETE',
            headers: { "Authorization": `Bearer ${currentUser.token}` }
        });
        showNotification(`Removed from history`, 'info');
    } catch (err) {
        showNotification('Failed to remove from history', 'error');
    }
}
// ===== FAVORITES FUNCTIONS =====
async function toggleFavorite(eventOrMovieData, extraData) {
  let movieData;

  if (typeof eventOrMovieData === 'object' && eventOrMovieData.target) {
    // Called from inline handler with event
    eventOrMovieData.stopPropagation();
    if (!currentUser) { showLoginModal(); return; }
    // Assume extraData contains { movie_id, title, img, rating, year }
    movieData = extraData;
  } else {
    // Called directly: toggleFavorite({ movie_id, title, img, rating, year })
    if (!currentUser) { showLoginModal(); return; }
    movieData = eventOrMovieData;
  }

  const { movie_id, title, img, rating, year } = movieData;
  const wasFavorite = currentUser.favorites?.some(f => f.id === movie_id) || false;

  try {
    const res = await fetch(`${base_url}/favorites/toggle`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${currentUser.token}` 
      },
      body: JSON.stringify({ movie_id, title, img, rating, year })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Toggle failed");

    // Update currentUser
    if (wasFavorite) {
      currentUser.favorites = currentUser.favorites.filter(f => f.id !== movie_id);
    } else {
      currentUser.favorites.push({ id: movie_id, title, img, rating, year });
    }
    saveUserData();

    // ✅ Only update UI for this movie
    updateMovieCardUI(movie_id, { isFavorite: !wasFavorite });

    // Optional: refresh panel if open
    if (document.getElementById('userPanelModal').style.display === 'flex') {
      await getFavorites();
      updateUserStats();
    }

    showNotification(data.message, 'success');
  } catch (err) {
    showNotification(err.message || 'Failed to update favorites', 'error');
  }
}


async function loadFavorites() {
    if (!currentUser) return;

    try {
        const res = await fetch(`${base_url}/favorites/`, {
            headers: { "Authorization": `Bearer ${currentUser.token}` }
        });
        const data = await res.json();

        const container = document.getElementById('favoritesList');
        const emptyState = document.getElementById('emptyFavorites');

        if (!data || data.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        container.innerHTML = data.map(movie => `
            <div class="movie-item">
                <img src="${movie.img}" alt="${movie.title}" onerror="this.src='https://via.placeholder.com/150x200'">
                <div class="movie-info-small">
                    <h4>${movie.title}</h4>
                    <p>⭐ ${movie.rating || 'N/A'}</p>
                </div>
                <div class="movie-actions">
                    <button onclick='toggleFavorite(event, ${JSON.stringify(movie)})'>Remove</button>
                </div>
            </div>
        `).join('');

        container.style.display = 'grid';
        emptyState.style.display = 'none';
    } catch (err) {
        console.error(err);
    }
}

async function clearFavorites() {
    if (!currentUser) return;

    if (confirm("Clear all favorites?")) {
        await fetch(`${base_url}/favorites/clear`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${currentUser.token}` }
        });
        loadFavorites();
        showNotification('Favorites cleared', 'info');
    }
}

// ===== RATINGS FUNCTIONS =====
async function rateMovie(event, movieId, rating, title) {
    event.stopPropagation();
    if (!currentUser) { showLoginModal(); return; }

    try {
        const res = await fetch(`${base_url}/user/rate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ movie_id: movieId, rating })
        });
        const data = await res.json();
        if (res.ok) {
            showNotification(`Rated "${title}" ${rating} stars`, 'success');
            loadRatings(); // fetch ratings from backend
        } else {
            showNotification(data.error || 'Failed to rate movie', 'error');
        }
    } catch (err) { console.error(err); }
}

// function updateMovieRatingStars(movieId, rating) {
//     const starsContainer = document.querySelector(`.movie-card[data-movie-id="${movieId}"] .quick-rating`);
//     if (starsContainer) {
//         const stars = starsContainer.querySelectorAll('.quick-star');
//         stars.forEach((star, index) => {
//             star.classList.toggle('active', index < rating);
//         });
//     }
// }
async function loadRatings() {
  if (!currentUser || !currentUser.ratings) {
    document.getElementById('emptyRatings').style.display = 'block';
    document.getElementById('ratingsList').innerHTML = '';
    return;
  }
  const container = document.getElementById('ratingsList');
  const emptyState = document.getElementById('emptyRatings');
  const movieIds = Object.keys(currentUser.ratings);
  
  if (movieIds.length === 0) {
    emptyState.style.display = 'block';
    container.innerHTML = '';
    return;
  }

  // You’ll need movie titles/imgs → either:
  // Option A: Fetch full movie objects by ID (requires new backend route)
  // Option B: Store full movie in ratings (not currently done)

  // For now, use placeholder
  container.innerHTML = movieIds.map(id => `
    <div class="movie-item">
      <p>Movie ID: ${id} — Rating: ${currentUser.ratings[id]}</p>
    </div>
  `).join('');
  emptyState.style.display = 'none';
}
// function updateRating(event, movieId, title) {
//     event.stopPropagation();

//     const currentRating = currentUser.ratings[movieId] || 0;
//     const newRating = parseInt(prompt(`Update rating for "${title}" (1-5):`, currentRating));

//     if (newRating && newRating >= 1 && newRating <= 5) {
//         rateMovie(event, movieId, newRating, title);
//     }
// }

// function getStarRating(rating) {
//     let stars = '';
//     for (let i = 1; i <= 5; i++) {
//         stars += i <= rating ? '★' : '☆';
//     }
//     return stars;
// }

function updatePreferredGenres() {
    if (!currentUser || !currentUser.ratings || Object.keys(currentUser.ratings).length < 3) {
        return;
    }

    // This is a simplified version - in production, you'd analyze movie genres
    if (!currentUser.preferred_genres || currentUser.preferred_genres.length === 0) {
        currentUser.preferred_genres = ['Action', 'Drama', 'Sci-Fi'];
    }
}

// ===== PREFERENCES FUNCTIONS =====
async function loadPreferences() {
    if (!currentUser) return;
    try {
        const res = await fetch(`/user/${currentUser.id}/history`);
        const data = await res.json();
        const container = document.getElementById('preferredGenres');
        container.innerHTML = (data.preferred_genres || []).map(g => `<span class="genre-tag">${g}</span>`).join('') || '<p>No preferences yet</p>';
    } catch (err) { console.error(err); }
}



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
    btn.classList.toggle('active', updates.isInWatchlist);
    const icon = btn.querySelector('i');
    icon.className = updates.isInWatchlist ? 'fas fa-bookmark' : 'far fa-bookmark';
  }

  if (updates.isFavorite !== undefined) {
    // similar update
  }

  if (updates.userRating !== undefined) {
    // update stars
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

            const isWatched = currentUser?.watch_history?.some(w => w.id === movie.id) || false;
            const isInWatchlist = currentUser?.watchlist?.some(item => item.id === movie.id) || false;
            const isFavorite = currentUser?.favorites?.some(fav => fav.id === movie.id) || false;
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
                            onclick="toggleFavorite({ movie_id: ${movie.id}, title: '${title}', img: '${imgSrc}', rating: ${movie.rating || 0}, year: ${movie.year || 0} })">
                            <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i>
                        </button>
                        <div class="quick-rating">
                            ${[1, 2, 3, 4, 5].map(star => `
                                <span class="quick-star ${star <= userRating ? 'active' : ''}"
                                    onclick="rateMovie(event, ${movie.id}, ${star}, '${title}')">★</span>
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


function updatePreferencesPanel() {
    if (!currentUser) return;
    
    const quizProfileInfo = document.getElementById('quizProfileInfo');
    if (!quizProfileInfo) return;
    
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
                    Quiz taken: ${new Date().toLocaleDateString()}
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

async function testEndpoints() {
    console.log("=== Testing Endpoints ===");
    
    const endpoints = [
        '/quiz/save',
        '/user/panel',
        '/recommendations/popular',
        '/recommendations/quiz',
        '/auth/login',
        '/user/watchlist'
    ];
    
    for (const endpoint of endpoints) {
        try {
            const url = `${base_url}${endpoint}`;
            console.log(`Testing: ${url}`);
            
            const res = await fetch(url, {
                method: 'OPTIONS' // Use OPTIONS to check allowed methods
            });
            
            console.log(`${endpoint}: ${res.status} - Allowed: ${res.headers.get('allow')}`);
        } catch (err) {
            console.log(`${endpoint}: ERROR - ${err.message}`);
        }
    }
}

// ===== ENHANCED DOM CONTENT LOADED =====
document.addEventListener("DOMContentLoaded", () => {
    initializeQuiz();

   if (currentUser) {
        loadUserQuizData().then(() => {
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

    // Close modals on outside click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
            abortActiveFetch();
        }
    });
    setTimeout(testEndpoints, 1000);
});
