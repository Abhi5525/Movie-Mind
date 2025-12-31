let currentUser = null;
let isFetchingMovies = false;
let searchTimeout;
let quizState = {
    currentStep: 0,
    answers: {},
    profile: {},
    quizStarted: false
};
const base_url = "http://localhost:5000"; // replace with your API base URL


let authButtons, userMenu, userAvatar, userName;

// ===== UTILITY FUNCTIONS =====
function getAuthHeaders() {
    if (!currentUser || !currentUser.token) {
        return { "Content-Type": "application/json" };
    }
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentUser.token}`
    };
}


function showLoginModal() {
    closeModal('registerModal');
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('loginEmail').focus();
}

function showRegisterModal() {
    closeModal('loginModal');
    document.getElementById('registerModal').style.display = 'flex';
    document.getElementById('registerName').focus();
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    clearFormErrors(modalId);
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
    const res = await fetch(`${base_url}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || "Login failed");
    }

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
    showNotification('Login successful!', 'success');
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
        const res = await fetch(`${base_url}/user/panel`, {
            headers: getAuthHeaders()
        });
        if (res.status === 401) {
  logout();
  showNotification("Session expired. Please log in again.", "error");
  return;
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
            <img src="${movie.img || getDefaultPoster(movie.title)}" alt="${movie.title}">
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

async function toggleWatchlist(event, movieId, title, img, rating, year) {
  event.stopPropagation();
  if (!currentUser) { showLoginModal(); return; }

  try {
    const res = await fetch(`${base_url}/user/watchlist/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentUser.token}` },
      body: JSON.stringify({ movie_id: movieId, title, img, rating, year })
    });
    const data = await res.json();
    
    showNotification(data.message, 'success');
    
    // ✅ REFRESH FROM BACKEND → ensures currentUser is synced
    if (document.getElementById('userPanelModal').style.display === 'flex') {
      await loadWatchlist(); // updates currentUser.watchlist
      updateUserStats();
    }
    
    // ✅ RE-RENDER MOVIES TO UPDATE BUTTON STATES
    // (optional: only if you want real-time watchlist icon update)
    fetchRecommendations(); // or call renderMovies with current list if you cache it
  } catch (err) {
    showNotification('Failed to update watchlist', 'error');
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
        await fetch(`${base_url}/user/watch-history`, {
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
        showNotification(`Added "${movie.title}" to your watch history`, 'success');
    } catch (err) {
        console.error(err);
        showNotification('Failed to add to watch history', 'error');
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
            <img src="${movie.img || getDefaultPoster(movie.title)}" alt="${movie.title}" 
                 onerror="this.src='https://via.placeholder.com/150x200/1a1a2e/ffffff?text=Movie'">
            <div class="movie-info-small">
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
async function toggleFavorite(event, movie) {
    event.stopPropagation();

    if (!currentUser) {
        showNotification('Please login to add favorites', 'info');
        showLoginModal();
        return;
    }

    try {
        const res = await fetch(`${base_url}/favorites/toggle`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${currentUser.token}`
            },
            body: JSON.stringify(movie)
        });
        const data = await res.json();

        if (res.ok) {
            showNotification(data.message, 'success');
            loadFavorites(); // refresh the favorites list
        } else {
            showNotification(data.error || "Failed to update favorites", 'error');
        }
    } catch (err) {
        console.error(err);
        showNotification("Server error", 'error');
    }
}


function toggleFavoriteById(movieId, title, img, rating, year) {
  toggleFavorite(event, { movie_id: movieId, title, img, rating, year });
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


function getDefaultPoster(title) {
    const posters = {
        "Inception": "...",
        "Interstellar": "...",

    };
    return posters[title] || "https://via.placeholder.com/500x750/1a1a2e/ffffff?text=MovieMind";
}

// ===== Render Movies =====
function renderMovies(list) {
  const movieContainer = document.getElementById('movieContainer');
  if (!movieContainer) return;

  // Show "no results" if list is empty or invalid
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
    return;
  }

  // ✅ Generate full HTML string in one go
  const html = list.map(movie => {
    // SAFETY: skip invalid movies
    if (!movie || !movie.id || !movie.title) return '';

    // GET CURRENT USER STATE (from localStorage-synced currentUser)
    const isWatched = currentUser?.watch_history?.some(w => w.id === movie.id) || false;
    const isInWatchlist = currentUser?.watchlist?.some(w => w.id === movie.id) || false;
    const isFavorite = currentUser?.favorites?.some(f => f.id === movie.id) || false;
    const userRating = currentUser?.ratings?.[movie.id] || 0;

    // SAFE STRINGS
    const title = String(movie.title).replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const imgSrc = movie.img || 'data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750"><rect width="500" height="750" fill="%230f0f1b"/><text x="50%" y="45%" fill="%2300e5ff" font-family="Arial" font-size="28" text-anchor="middle">MovieMind</text><text x="50%" y="55%" fill="white" font-family="Arial" font-size="20" text-anchor="middle">No Poster</text></svg>';

    return `
      <div class="movie-card" data-movie-id="${movie.id}" onclick="addToWatchHistory(${JSON.stringify(movie).replace(/"/g, '&quot;')})">
        ${isWatched ? '<div class="watchlist-status">Watched</div>' : ''}
        <span class="rating">⭐ ${movie.rating || 'N/A'}</span>
        <img src="${imgSrc}" alt="${movie.title}">
        <div class="movie-info">
          <h3>${title}</h3>
          <p>${movie.genres || 'Unknown Genre'}</p>
          ${movie.year ? `<p style="font-size: 12px; opacity: 0.7; margin-top: 5px;">${movie.year}</p>` : ''}
          <div class="movie-actions-grid">
            <button class="action-btn watchlist ${isInWatchlist ? 'active' : ''}"
              onclick="toggleWatchlist(event, ${movie.id}, '${title}', '${img}', ${movie.rating || 0}, ${movie.year || 0})">
              <i class="${isInWatchlist ? 'fas' : 'far'} fa-bookmark"></i>
            </button>
            <button class="action-btn favorite ${isFavorite ? 'active' : ''}"
              onclick="toggleFavoriteById(${movie.id}, '${title}', '${img}', ${movie.rating || 0}, ${movie.year || 0})">
              <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i>
            </button>
            <div class="quick-rating">
              ${[1,2,3,4,5].map(star => `
                <span class="quick-star ${star <= userRating ? 'active' : ''}"
                  onclick="rateMovie(event, ${movie.id}, ${star}, '${title}')">★</span>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // ✅ SINGLE DOM UPDATE — zero flicker
  movieContainer.innerHTML = html;
}


async function fetchRecommendations(limit = 20) {
  const movieContainer = document.getElementById('movieContainer');
  if (!movieContainer || isFetchingMovies) return;

  // ✅ Show loading immediately to prevent blank screen
  movieContainer.innerHTML = `
    <div class="loading" style="grid-column: 1 / -1; text-align: center; padding: 60px;">
      <i class="fas fa-film fa-spin" style="font-size: 50px; color: #00e5ff;"></i>
      <p>Loading movies...</p>
    </div>
  `;

  isFetchingMovies = true;

  try {
    let movies = [];
    let title = '🔥 Trending Movies';

    // Try personalized recommendations
    if (currentUser?.token) {
      try {
        const res = await fetch(`${base_url}/recommendations/hybrid?user_id=${currentUser.id}`, {
          headers: { "Authorization": `Bearer ${currentUser.token}` }
        });
        const data = await res.json();
        if (res.ok && data.recommendations?.length > 0) {
          movies = data.recommendations;
          title = '✨ Recommended for You';
        }
      } catch (e) {
        console.warn("Hybrid recommendations failed, falling back to popular.");
      }
    }

    // Fallback to popular
    if (movies.length === 0) {
      const res = await fetch(`${base_url}/recommendations/popular?top_n=${limit}`);
      const data = await res.json();
      movies = data.recommendations || [];
      title = '🔥 Trending Movies';
    }

    document.getElementById('sectionTitle').textContent = title;
    renderMovies(movies);
  } catch (err) {
    console.error("Error in fetchRecommendations:", err);
    movieContainer.innerHTML = `
      <p style="grid-column: 1 / -1; text-align: center; color: #ff6b6b;">
        Failed to load movies. Please try again later.
      </p>
    `;
  } finally {
    isFetchingMovies = false;
  }
}


async function performSearch(query) {
  const movieContainer = document.getElementById('movieContainer');
  if (!movieContainer || isFetchingMovies) return;
  if (!query || query.trim() === '') {
    fetchRecommendations();
    return;
  }

  // ✅ Immediate loading feedback
  movieContainer.innerHTML = `
    <div class="loading" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
      <i class="fas fa-search fa-spin" style="font-size: 40px; color: #00e5ff;"></i>
      <p style="margin-top: 15px; opacity: 0.7;">Searching for "${query}"...</p>
    </div>
  `;
  closeModal('userPanelModal');
  document.getElementById('sectionTitle').textContent = `🔍 Search Results for "${query}"`;

  isFetchingMovies = true;

  try {
    const response = await fetch(`${base_url}/search?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Search API failed');
    const data = await response.json();
    const movies = data.results || [];
    renderMovies(movies);
    if (movies.length === 0) {
      document.getElementById('sectionTitle').textContent = `🔍 No results for "${query}"`;
    }
  } catch (error) {
    console.error('Search error:', error);
    movieContainer.innerHTML = `
      <div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
        <i class="fas fa-exclamation-triangle" style="font-size: 60px; opacity: 0.3; margin-bottom: 20px; color: #ff6b6b;"></i>
        <h3 style="color: #ff6b6b; margin-bottom: 10px;">Search Failed</h3>
        <p style="opacity: 0.7;">Unable to reach the server. Please try again.</p>
        <button onclick="fetchRecommendations()" style="margin-top: 20px; padding: 10px 25px; background: #00e5ff; color: black; border: none; border-radius: 25px; cursor: pointer; font-weight: 600;">
          Show Popular Movies
        </button>
      </div>
    `;
  } finally {
    clearTimeout(searchTimeout);
    isFetchingMovies = false;
  }
}

// ===== Filter by Genre =====
async function filterByGenre(genre) {
  const movieContainer = document.getElementById('movieContainer');
  if (genre === 'All') {
    fetchRecommendations();
    return;
  }
  if (!movieContainer || isFetchingMovies) return;

  // ✅ Show loading
  movieContainer.innerHTML = `
    <div class="loading" style="grid-column: 1 / -1; text-align: center; padding: 60px;">
      <i class="fas fa-film fa-spin" style="font-size: 50px; color: #00e5ff;"></i>
      <p>Loading ${genre} movies...</p>
    </div>
  `;
  document.getElementById('sectionTitle').textContent = `🎥 ${genre} Movies`;

  isFetchingMovies = true;

  try {
    const res = await fetch(`${base_url}/recommendations/genre?genre=${encodeURIComponent(genre)}`);
    const data = await res.json();
    renderMovies(data.recommendations || []);
  } catch (err) {
    console.error('Genre filter error:', err);
    movieContainer.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#ff6b6b;">No movies found for ${genre}.</p>`;
  } finally {
    isFetchingMovies = false;
  }
}

// ===== Get Personalized Recommendations =====
function getPersonalizedRecommendations(userId) {
    if (!userId) return alert('Login to get personalized recommendations');
    fetch(`${base_url}/recommendations/hybrid?user_id=${userId}`)
        .then(res => res.json())
        .then(data => renderMovies(data.recommendations))
        .catch(() => renderMovies(defaultMovies));
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

// ✅ New function: finishes quiz, calculates profile and calls backend API
function finishQuiz() {
    const profile = analyzeQuizAnswers();
    quizState.profile = profile;
    showQuizResults(profile);

    // Call Flask API for quiz recommendations
    getQuizRecommendations();
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

function showQuizResults(profile) {
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

    // Save locally in currentUser
    if (currentUser) {
        currentUser.quiz_profile = profile;
        currentUser.preferred_genres = profile.topGenres;
        saveUserData();
    }
}

// ✅ New API call function
function getQuizRecommendations() {
    if (!currentUser) return;

    const genres = quizState.profile?.topGenres || [];
    const tags = quizState.profile?.tags || [];

    if (genres.length === 0) return;

    showNotification('Fetching quiz-based recommendations...', 'info');
    closeModal('quizModal');

    fetch(`${base_url}/recommendations/quiz?user_id=${currentUser.id}&genres=${genres.join(',')}&tags=${tags.join(',')}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderMovies(data.recommendations);
            } else {
                showNotification('Failed to fetch quiz recommendations, showing popular movies.', 'error');
                fetchRecommendations();
            }
        })
        .catch(() => fetchRecommendations());
}

// Restart quiz
function restartQuiz() {
    document.getElementById('quizResults').style.display = 'none';
    document.getElementById('quizContainer').style.display = 'block';
    quizState.currentStep = 0;
    quizState.answers = {};
    showQuizStep(0);
}


// Run whenever the page is loaded/refreshed
window.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  searchBox = document.getElementById('searchBox');
  authButtons = document.getElementById('authButtons');
  movieContainer = document.getElementById('movieContainer');
  userMenu = document.getElementById('userMenu');
  userAvatar = document.getElementById('userAvatar');
  userName = document.getElementById('userName');

  // Restore user
  const savedUser = localStorage.getItem("currentUser");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    updateUIForUser();
  }

  // ✅ CRITICAL: Load movies on page load
  fetchRecommendations();

  // Search listeners
  if (searchBox) {
    searchBox.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      searchTimeout = setTimeout(() => {
        performSearch(query);
      }, 500);
    });

    searchBox.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        performSearch(e.target.value.trim());
      }
    });
  }

  // Close modal on outside click
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      e.target.style.display = 'none';
    }
  });
});