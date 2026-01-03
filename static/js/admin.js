// Admin Dashboard JavaScript - REFINED VERSION
class AdminDashboard {
    constructor() {
        this.currentPage = 'dashboard';
        this.token = localStorage.getItem('admin_token');
        this.currentUser = null;
        this.baseUrl = '/admin'; // Base URL for all admin endpoints
        this.movies = [];
        this.users = [];
        
        console.log('🔧 AdminDashboard initialized');
        console.log('🔧 Token:', this.token ? this.token.substring(0, 30) + '...' : 'None');
        
        this.init();
    }
    
    init() {
        this.checkAuth();
        this.setupEventListeners();
    }
    
    checkAuth() {
        if (!this.token) {
            console.log('❌ No token found, redirecting to login');
            window.location.href = '/admin-login';
            return;
        }
        
        this.loadCurrentUser();
    }
    
    async loadCurrentUser() {
        try {
            const data = await this.apiRequest(`${this.baseUrl}/dashboard`);
            
            // Update admin info
            document.getElementById('adminName').textContent = data.user?.name || 'Administrator';
            document.getElementById('adminRole').textContent = data.user?.is_admin ? 'Super Admin' : 'Admin';
            
            // Update avatar with initials
            const name = data.user?.name || 'Admin';
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
            document.getElementById('adminAvatar').textContent = initials.substring(0, 2);
            
            this.currentUser = data.user;
            
            // Load the dashboard page
            this.loadPage('dashboard');
            
        } catch (error) {
            console.error('🔧 Auth error:', error);
            
            document.getElementById('pageContent').innerHTML = `
                <div class="alert alert-danger">
                    <h3>Authentication Error</h3>
                    <p>${error.message}</p>
                    <p>Please login again.</p>
                    <button class="btn btn-primary" onclick="window.location.href='/admin-login'">
                        Go to Login
                    </button>
                </div>
            `;
            
            localStorage.removeItem('admin_token');
        }
    }
    
    setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                this.loadPage(page);
                
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });
        
        // Menu toggle
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('active');
        });
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        
        // Global search
        document.getElementById('globalSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.showSearchModal(e.target.value);
            }
        });
        
        // Notification bell
        document.getElementById('notificationBell').addEventListener('click', () => {
            this.showNotification('Notification system coming soon!', 'info');
        });
        
        // Close modal when clicking backdrop
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalOverlay')) {
                this.closeModal();
            }
        });
    }
    
    async loadPage(page) {
        this.currentPage = page;
        document.getElementById('pageTitle').textContent = this.formatPageTitle(page);
        
        try {
            let html = '';
            
            switch(page) {
                case 'dashboard':
                    html = await this.loadDashboardContent();
                    break;
                case 'movies':
                    html = this.loadMoviesContent();
                    break;
                case 'users':
                    html = this.loadUsersContent();
                    break;
                case 'quiz-analytics':
                    html = this.loadQuizAnalyticsContent();
                    break;
                case 'reports':
                    html = this.loadReportsContent();
                    break;
                case 'settings':
                    html = this.loadSettingsContent();
                    break;
                default:
                    html = '<div class="empty-state"><h3>Page not found</h3></div>';
            }
            
            document.getElementById('pageContent').innerHTML = html;
            this.initPageScripts();
            
        } catch (error) {
            console.error('Error loading page:', error);
            document.getElementById('pageContent').innerHTML = 
                `<div class="alert alert-danger">Error loading page: ${error.message}</div>`;
        }
    }
    
    formatPageTitle(page) {
        return page.split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    async loadDashboardContent() {
        try {
            const data = await this.apiRequest(`${this.baseUrl}/dashboard`);
            
            // Update counts in sidebar
            if (data.stats) {
                document.getElementById('moviesCount').textContent = data.stats.total_movies || 0;
                document.getElementById('usersCount').textContent = data.stats.total_users || 0;
            }
            
            return `
                <div class="dashboard-page">
                    <div class="welcome-banner">
                        <div class="welcome-text">
                            <h1>Welcome back, ${this.currentUser?.name || 'Admin'}!</h1>
                            <p>Here's what's happening with your MovieMind platform.</p>
                        </div>
                        <div>
                            <button class="btn btn-primary" onclick="admin.showAddMovieModal()">
                                <i class="fas fa-plus"></i> Add New Movie
                            </button>
                        </div>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon" style="background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="stat-info">
                                <h3>${data.stats?.total_users || 0}</h3>
                                <p>Total Users</p>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon" style="background: linear-gradient(135deg, var(--success-color), #0da271);">
                                <i class="fas fa-video"></i>
                            </div>
                            <div class="stat-info">
                                <h3>${data.stats?.total_movies || 0}</h3>
                                <p>Total Movies</p>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon" style="background: linear-gradient(135deg, var(--secondary-color), var(--secondary-dark));">
                                <i class="fas fa-poll"></i>
                            </div>
                            <div class="stat-info">
                                <h3>${data.stats?.total_quizzes || 0}</h3>
                                <p>Quiz Results</p>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon" style="background: linear-gradient(135deg, var(--warning-color), #d97706);">
                                <i class="fas fa-star"></i>
                            </div>
                            <div class="stat-info">
                                <h3>${data.stats?.total_ratings || 0}</h3>
                                <p>Total Ratings</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="quick-actions">
                        <div class="quick-action-card" onclick="admin.loadPage('movies')">
                            <div class="quick-action-icon">
                                <i class="fas fa-film"></i>
                            </div>
                            <h3>Manage Movies</h3>
                            <p>Add, edit or remove movies from the catalog</p>
                        </div>
                        
                        <div class="quick-action-card" onclick="admin.loadPage('users')">
                            <div class="quick-action-icon">
                                <i class="fas fa-user-cog"></i>
                            </div>
                            <h3>Manage Users</h3>
                            <p>View and manage user accounts and permissions</p>
                        </div>
                        
                        <div class="quick-action-card" onclick="admin.loadPage('quiz-analytics')">
                            <div class="quick-action-icon">
                                <i class="fas fa-chart-pie"></i>
                            </div>
                            <h3>View Analytics</h3>
                            <p>Analyze user preferences and quiz results</p>
                        </div>
                        
                        <div class="quick-action-card" onclick="admin.showBulkUploadModal()">
                            <div class="quick-action-icon">
                                <i class="fas fa-upload"></i>
                            </div>
                            <h3>Bulk Upload</h3>
                            <p>Upload multiple movies via CSV or JSON</p>
                        </div>
                    </div>
                    
                    <div class="recent-activity">
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Recent Users</h3>
                                <a href="#" onclick="admin.loadPage('users')" class="text-muted">View All</a>
                            </div>
                            <ul class="activity-list">
                                ${data.recent_users?.map(user => `
                                    <li class="activity-item">
                                        <div class="activity-icon user">
                                            <i class="fas fa-user"></i>
                                        </div>
                                        <div class="activity-details">
                                            <h4>${user.name}</h4>
                                            <p>${user.email} • Joined ${new Date(user.join_date).toLocaleDateString()}</p>
                                        </div>
                                    </li>
                                `).join('') || '<li class="empty-state"><p>No recent users</p></li>'}
                            </ul>
                        </div>
                        
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Recent Movies</h3>
                                <a href="#" onclick="admin.loadPage('movies')" class="text-muted">View All</a>
                            </div>
                            <ul class="activity-list">
                                ${data.recent_movies?.map(movie => `
                                    <li class="activity-item">
                                        <div class="activity-icon movie">
                                            <i class="fas fa-film"></i>
                                        </div>
                                        <div class="activity-details">
                                            <h4>${movie.title}</h4>
                                            <p>${movie.year} • ${movie.genres || 'No genres'}</p>
                                        </div>
                                    </li>
                                `).join('') || '<li class="empty-state"><p>No recent movies</p></li>'}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
            
        } catch (error) {
            return `
                <div class="alert alert-danger">
                    <h3>Error Loading Dashboard</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
    
    loadMoviesContent() {
        return `
            <div class="movies-page">
                <div class="filter-bar">
                    <h2>Movie Management</h2>
                    <div class="filter-actions">
                        <div class="search-box">
                            <input type="text" class="search-input" placeholder="Search movies..." 
                                   id="movieSearch" oninput="admin.filterMovies(this.value)">
                            <i class="fas fa-search search-icon"></i>
                        </div>
                        <button class="btn btn-primary" onclick="admin.showAddMovieModal()">
                            <i class="fas fa-plus"></i> Add Movie
                        </button>
                    </div>
                </div>
                
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Movie</th>
                                <th>Year</th>
                                <th>Rating</th>
                                <th>Runtime</th>
                                <th>Genres</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="moviesTableBody">
                            <tr>
                                <td colspan="6" class="text-center">
                                    <div class="loading">Loading movies...</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div class="pagination" id="moviesPagination"></div>
            </div>
        `;
    }
    
    loadUsersContent() {
        return `
            <div class="users-page">
                <div class="filter-bar">
                    <h2>User Management</h2>
                    <div class="filter-actions">
                        <div class="search-box">
                            <input type="text" class="search-input" placeholder="Search users..." 
                                   id="userSearch" oninput="admin.filterUsers(this.value)">
                            <i class="fas fa-search search-icon"></i>
                        </div>
                    </div>
                </div>
                
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Joined</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="usersTableBody">
                            <tr>
                                <td colspan="6" class="text-center">
                                    <div class="loading">Loading users...</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div class="pagination" id="usersPagination"></div>
            </div>
        `;
    }
    
    
    loadPlaceholderContent(title, icon, description) {
        return `
            <div class="placeholder-page">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">${title}</h3>
                        <p class="card-subtitle">${description}</p>
                    </div>
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-${icon}"></i>
                            <h3>${title} Coming Soon</h3>
                            <p>${description} will be available soon.</p>
                            <button class="btn btn-primary" onclick="admin.loadPage('dashboard')">
                                Go to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    initPageScripts() {
    switch(this.currentPage) {
        case 'movies':
            this.loadMoviesData();
            break;
        case 'users':
            this.loadUsersData();
            break;
        case 'quiz-analytics':
            this.loadQuizAnalyticsData(); // ADD THIS LINE
            break;
    }
}
    async loadMoviesData(page = 1, search = '') {
        try {
            const url = search ? 
                `${this.baseUrl}/movies?page=${page}&search=${encodeURIComponent(search)}` :
                `${this.baseUrl}/movies?page=${page}`;
                
            const data = await this.apiRequest(url);
            this.movies = data.movies || [];
            
            this.updateMoviesTable(this.movies);
            
        } catch (error) {
            console.error('Error loading movies:', error);
            this.updateMoviesTable([]);
        }
    }
    
    async loadUsersData(page = 1, search = '') {
        try {
            const url = search ? 
                `${this.baseUrl}/users?page=${page}&search=${encodeURIComponent(search)}` :
                `${this.baseUrl}/users?page=${page}`;
                
            const data = await this.apiRequest(url);
            this.users = data.users || [];
            
            this.updateUsersTable(this.users);
            
        } catch (error) {
            console.error('Error loading users:', error);
            this.updateUsersTable([]);
        }
    }
    
    updateMoviesTable(movies) {
        const tbody = document.getElementById('moviesTableBody');
        if (!tbody) return;
        
        if (movies.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No movies found</td></tr>';
            return;
        }
        
        tbody.innerHTML = movies.map(movie => `
            <tr>
                <td>
                    <div class="movie-card-small">
                        <img src="${movie.img}" 
                             alt="${movie.title}" 
                             class="movie-poster-thumb"
                             onerror="this.src='/static/images/poster-not-available.jpg'">
                        <div class="movie-info-small">
                            <h4>${movie.title}</h4>
                            <p>${movie.director || 'Unknown Director'}</p>
                        </div>
                    </div>
                </td>
                <td>${movie.year || '-'}</td>
                <td>${movie.rating ? '⭐ ' + movie.rating : '-'}</td>
                <td>${movie.runtime ? movie.runtime + ' min' : '-'}</td>
                <td>${movie.genres || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn view" onclick="admin.viewMovie(${movie.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn edit" onclick="admin.showEditMovieModal(${movie.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="admin.deleteMovie(${movie.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    updateUsersTable(users) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No users found</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>
                    <div class="movie-card-small">
                        <div class="admin-avatar" style="width: 40px; height: 40px;">
                            ${user.name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                        </div>
                        <div class="movie-info-small">
                            <h4>${user.name}</h4>
                            <p>ID: ${user.id}</p>
                        </div>
                    </div>
                </td>
                <td>${user.email}</td>
                <td>
                    <span class="badge ${user.is_admin ? 'badge-primary' : 'badge-secondary'}">
                        ${user.is_admin ? 'Admin' : 'User'}
                    </span>
                </td>
                <td>
                    <span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">
                        ${user.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${new Date(user.join_date).toLocaleDateString()}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn view" onclick="admin.viewUser(${user.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn edit" onclick="admin.showEditUserModal(${user.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${!user.is_admin ? `
                            <button class="action-btn delete" onclick="admin.deleteUser(${user.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    // ========== MODAL MANAGEMENT ==========
    showModal(content) {
        const overlay = document.getElementById('modalOverlay');
        overlay.innerHTML = content;
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    closeModal() {
        const overlay = document.getElementById('modalOverlay');
        overlay.style.display = 'none';
        overlay.innerHTML = '';
        document.body.style.overflow = 'auto';
    }
    
    // ========== MOVIE MANAGEMENT ==========
    showAddMovieModal() {
        const modalHtml = this.getMovieFormModal('Add New Movie', 'createMovie', {});
        this.showModal(modalHtml);
        this.setupMovieFormHandler('createMovie');
    }
    
    async showEditMovieModal(movieId) {
        try {
            const data = await this.apiRequest(`${this.baseUrl}/movies/${movieId}`);
            const movie = data.movie;
            
            const modalHtml = this.getMovieFormModal('Edit Movie', 'updateMovie', movie);
            this.showModal(modalHtml);
            this.setupMovieFormHandler('updateMovie', movieId);
            
        } catch (error) {
            this.showNotification('Failed to load movie details', 'error');
        }
    }
    
    getMovieFormModal(title, action, movie) {
        return `
            <div class="modal" style="max-width: 800px;">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" onclick="admin.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="movieForm">
                        ${action === 'updateMovie' ? `<input type="hidden" id="movieId" value="${movie.id}">` : ''}
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="title">Title *</label>
                                <input type="text" id="title" required value="${movie.title || ''}">
                            </div>
                            <div class="form-group">
                                <label for="year">Year *</label>
                                <input type="number" id="year" required value="${movie.year || ''}">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="genres">Genres *</label>
                            <input type="text" id="genres" required value="${movie.genres || ''}">
                            <small>Separate with commas</small>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="rating">Rating</label>
                                <input type="number" id="rating" step="0.1" value="${movie.rating || ''}">
                            </div>
                            <div class="form-group">
                                <label for="runtime">Runtime (minutes)</label>
                                <input type="number" id="runtime" value="${movie.runtime || ''}">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="director">Director</label>
                            <input type="text" id="director" value="${movie.director || ''}">
                        </div>
                        
                        <div class="form-group">
                            <label for="plot">Plot Summary</label>
                            <textarea id="plot" rows="3">${movie.plot || ''}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="img">Poster Image URL</label>
                            <input type="url" id="img" value="${movie.img || ''}">
                            <small>Leave empty for default placeholder</small>
                        </div>
                        
                        <div class="form-footer">
                            <button type="button" class="btn btn-secondary" onclick="admin.closeModal()">
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                ${action === 'createMovie' ? 'Save Movie' : 'Update Movie'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }
    
    setupMovieFormHandler(action, movieId = null) {
        const form = document.getElementById('movieForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                title: document.getElementById('title').value,
                year: parseInt(document.getElementById('year').value),
                genres: document.getElementById('genres').value,
                rating: parseFloat(document.getElementById('rating').value) || 0,
                runtime: document.getElementById('runtime').value ? 
                         parseInt(document.getElementById('runtime').value) : null,
                director: document.getElementById('director').value || '',
                plot: document.getElementById('plot').value || '',
                img: document.getElementById('img').value || 
                     '/static/images/poster-not-available.jpg'
            };
            
            try {
                const url = action === 'createMovie' ? 
                    `${this.baseUrl}/movies` : 
                    `${this.baseUrl}/movies/${movieId}`;
                
                const method = action === 'createMovie' ? 'POST' : 'PUT';
                
                const data = await this.apiRequest(url, {
                    method: method,
                    body: formData
                });
                
                this.showNotification(
                    action === 'createMovie' ? 'Movie created successfully!' : 'Movie updated successfully!',
                    'success'
                );
                
                this.closeModal();
                this.loadMoviesData();
                
            } catch (error) {
                this.showNotification(error.message || 'Operation failed', 'error');
            }
        });
    }
    
    async viewMovie(movieId) {
        try {
            const data = await this.apiRequest(`${this.baseUrl}/movies/${movieId}`);
            const movie = data.movie;
            
            const modalHtml = this.getMovieViewModal(movie);
            this.showModal(modalHtml);
            
        } catch (error) {
            this.showNotification('Failed to load movie details', 'error');
        }
    }
    
    getMovieViewModal(movie) {
        return `
            <div class="modal" style="max-width: 800px;">
                <div class="modal-header">
                    <h3 class="modal-title">${movie.title} (${movie.year})</h3>
                    <button class="modal-close" onclick="admin.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="movie-details-view">
                        <div class="movie-poster-large">
                            <img src="${movie.img}" 
                                 alt="${movie.title}"
                                 onerror="this.src='/static/images/poster-not-available.jpg'">
                        </div>
                        
                        <div class="movie-info-details">
                            <div class="detail-row">
                                <span class="detail-label">Rating:</span>
                                <span class="detail-value">${movie.rating ? '⭐ ' + movie.rating : 'Not rated'}</span>
                            </div>
                            
                            <div class="detail-row">
                                <span class="detail-label">Runtime:</span>
                                <span class="detail-value">${movie.runtime ? movie.runtime + ' min' : 'N/A'}</span>
                            </div>
                            
                            <div class="detail-row">
                                <span class="detail-label">Genres:</span>
                                <span class="detail-value">${movie.genres || 'N/A'}</span>
                            </div>
                            
                            <div class="detail-row">
                                <span class="detail-label">Director:</span>
                                <span class="detail-value">${movie.director || 'N/A'}</span>
                            </div>
                            
                            <div class="detail-row full-width">
                                <span class="detail-label">Plot:</span>
                                <p class="detail-value">${movie.plot || 'No description available'}</p>
                            </div>
                            
                            <div class="detail-row">
                                <span class="detail-label">Movie ID:</span>
                                <span class="detail-value">${movie.id}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="admin.closeModal()">
                            Close
                        </button>
                        <button class="btn btn-primary" onclick="admin.showEditMovieModal(${movie.id})">
                            Edit Movie
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    async deleteMovie(movieId) {
        if (!confirm('Are you sure you want to delete this movie? This action cannot be undone.')) {
            return;
        }
        
        try {
            await this.apiRequest(`${this.baseUrl}/movies/${movieId}`, {
                method: 'DELETE'
            });
            
            this.showNotification('Movie deleted successfully!', 'success');
            this.loadMoviesData();
            
        } catch (error) {
            this.showNotification(error.message || 'Failed to delete movie', 'error');
        }
    }
    
    // ========== USER MANAGEMENT ==========
    async showEditUserModal(userId) {
        try {
            const data = await this.apiRequest(`${this.baseUrl}/users/${userId}`);
            const user = data.user;
            
            const modalHtml = this.getUserFormModal(user);
            this.showModal(modalHtml);
            this.setupUserFormHandler(userId);
            
        } catch (error) {
            this.showNotification('Failed to load user details', 'error');
        }
    }
    
    getUserFormModal(user) {
        return `
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">Edit User: ${user.name}</h3>
                    <button class="modal-close" onclick="admin.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="userForm">
                        <input type="hidden" id="userId" value="${user.id}">
                        
                        <div class="form-group">
                            <label for="userName">Name</label>
                            <input type="text" id="userName" value="${user.name}">
                        </div>
                        
                        <div class="form-group">
                            <label for="userEmail">Email</label>
                            <input type="email" id="userEmail" value="${user.email}" disabled>
                            <small>Email cannot be changed</small>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="userIsAdmin" ${user.is_admin ? 'checked' : ''}>
                                    <span>Administrator</span>
                                </label>
                            </div>
                            
                            <div class="form-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="userIsActive" ${user.is_active ? 'checked' : ''}>
                                    <span>Active Account</span>
                                </label>
                            </div>
                        </div>
                        
                        <div class="form-footer">
                            <button type="button" class="btn btn-secondary" onclick="admin.closeModal()">
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                Update User
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }
    
    setupUserFormHandler(userId) {
        const form = document.getElementById('userForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                name: document.getElementById('userName').value,
                is_admin: document.getElementById('userIsAdmin').checked,
                is_active: document.getElementById('userIsActive').checked
            };
            
            try {
                await this.apiRequest(`${this.baseUrl}/users/${userId}`, {
                    method: 'PUT',
                    body: formData
                });
                
                this.showNotification('User updated successfully!', 'success');
                this.closeModal();
                this.loadUsersData();
                
            } catch (error) {
                this.showNotification(error.message || 'Failed to update user', 'error');
            }
        });
    }
    
    async viewUser(userId) {
        try {
            const data = await this.apiRequest(`${this.baseUrl}/users/${userId}`);
            const user = data.user;
            
            const modalHtml = this.getUserViewModal(user);
            this.showModal(modalHtml);
            
        } catch (error) {
            this.showNotification('Failed to load user details', 'error');
        }
    }
    
    getUserViewModal(user) {
        return `
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">User Details</h3>
                    <button class="modal-close" onclick="admin.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="user-details-view">
                        <div class="user-avatar-large">
                            ${user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                        </div>
                        
                        <div class="user-info-details">
                            <h4>${user.name}</h4>
                            <p class="user-email">${user.email}</p>
                            
                            <div class="user-stats-grid">
                                <div class="user-stat">
                                    <span class="stat-label">User ID</span>
                                    <span class="stat-value">${user.id}</span>
                                </div>
                                
                                <div class="user-stat">
                                    <span class="stat-label">Role</span>
                                    <span class="stat-value ${user.is_admin ? 'admin-role' : 'user-role'}">
                                        ${user.is_admin ? 'Administrator' : 'Regular User'}
                                    </span>
                                </div>
                                
                                <div class="user-stat">
                                    <span class="stat-label">Status</span>
                                    <span class="stat-value ${user.is_active ? 'active-status' : 'inactive-status'}">
                                        ${user.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                
                                <div class="user-stat">
                                    <span class="stat-label">Joined</span>
                                    <span class="stat-value">${new Date(user.join_date).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="admin.closeModal()">
                            Close
                        </button>
                        <button class="btn btn-primary" onclick="admin.showEditUserModal(${user.id})">
                            Edit User
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }
        
        try {
            await this.apiRequest(`${this.baseUrl}/users/${userId}`, {
                method: 'DELETE'
            });
            
            this.showNotification('User deleted successfully!', 'success');
            this.loadUsersData();
            
        } catch (error) {
            this.showNotification(error.message || 'Failed to delete user', 'error');
        }
    }
    
    // ========== SEARCH FUNCTIONALITY ==========
   // Update these methods in your AdminDashboard class:

async filterMovies(searchTerm) {
    try {
        const url = searchTerm ? 
            `${this.baseUrl}/movies?search=${encodeURIComponent(searchTerm)}` :
            `${this.baseUrl}/movies`;
            
        const data = await this.apiRequest(url);
        this.movies = data.movies || [];
        
        this.updateMoviesTable(this.movies);
        
    } catch (error) {
        console.error('Error filtering movies:', error);
        this.updateMoviesTable([]);
    }
}

async filterUsers(searchTerm) {
    try {
        const url = searchTerm ? 
            `${this.baseUrl}/users?search=${encodeURIComponent(searchTerm)}` :
            `${this.baseUrl}/users`;
            
        const data = await this.apiRequest(url);
        this.users = data.users || [];
        
        this.updateUsersTable(this.users);
        
    } catch (error) {
        console.error('Error filtering users:', error);
        this.updateUsersTable([]);
    }
} 
    async showSearchModal(query) {
        try {
            const data = await this.apiRequest(`${this.baseUrl}/search?q=${encodeURIComponent(query)}`);
            
            const modalHtml = `
                <div class="modal" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3 class="modal-title">Search Results for "${query}"</h3>
                        <button class="modal-close" onclick="admin.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${this.getSearchResultsHtml(data, query)}
                    </div>
                </div>
            `;
            
            this.showModal(modalHtml);
            
        } catch (error) {
            console.error('Search error:', error);
        }
    }
    
    getSearchResultsHtml(data, query) {
        if (data.movies.length === 0 && data.users.length === 0) {
            return `
                <div class="empty-search">
                    <i class="fas fa-search"></i>
                    <h4>No results found</h4>
                    <p>Try different search terms</p>
                </div>
            `;
        }
        
        let html = '';
        
        if (data.movies.length > 0) {
            html += `
                <div class="search-section">
                    <h4>Movies (${data.movies.length})</h4>
                    <div class="search-results">
                        ${data.movies.map(movie => `
                            <div class="search-result-item" onclick="admin.viewMovie(${movie.id})">
                                <img src="${movie.img}" alt="${movie.title}" 
                                     onerror="this.src='/static/images/poster-not-available.jpg'">
                                <div class="search-result-info">
                                    <h5>${movie.title} (${movie.year})</h5>
                                    <p>${movie.genres || 'No genres'}</p>
                                    <small>Rating: ${movie.rating ? '⭐ ' + movie.rating : 'N/A'}</small>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        if (data.users.length > 0) {
            html += `
                <div class="search-section">
                    <h4>Users (${data.users.length})</h4>
                    <div class="search-results">
                        ${data.users.map(user => `
                            <div class="search-result-item" onclick="admin.viewUser(${user.id})">
                                <div class="user-avatar-small">
                                    ${user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                                </div>
                                <div class="search-result-info">
                                    <h5>${user.name}</h5>
                                    <p>${user.email}</p>
                                    <small>Role: ${user.is_admin ? 'Admin' : 'User'}</small>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        return html;
    }
    
    // ========== UTILITY METHODS ==========
    async apiRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        };
        
        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };
        
        if (options.body) {
            finalOptions.body = JSON.stringify(options.body);
        }
        
        const response = await fetch(url, finalOptions);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'API request failed');
        }
        
        return data;
    }
    
showNotification(message, type = 'info') {
    console.log('🔔 Notification triggered:', { message, type });
    
    // Remove existing notifications
    const existing = document.querySelector('.notification-toast');
    if (existing) {
        console.log('🗑️ Removing existing notification');
        existing.remove();
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    
    // Set inner HTML WITHOUT inline styles
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 
                              type === 'error' ? 'exclamation-circle' : 
                              'info-circle'}"></i>
            <span class="toast-message">${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    // Calculate dynamic position based on header height
    const header = document.querySelector('.admin-header');
    if (header) {
        const headerHeight = header.offsetHeight;
        const headerTop = header.getBoundingClientRect().top;
        const totalHeaderSpace = headerHeight + headerTop;
        
        // Position notification 20px below the header
        toast.style.top = `${totalHeaderSpace + 20}px`;
        console.log('📏 Position calculated:', {
            headerHeight,
            headerTop,
            totalHeaderSpace,
            notificationTop: totalHeaderSpace + 20
        });
    }
    
    // Add to DOM
    document.body.appendChild(toast);
    
    console.log('✅ Notification created:', toast);
    console.log('📋 Toast position:', {
        computedTop: window.getComputedStyle(toast).top,
        offsetTop: toast.offsetTop,
        rect: toast.getBoundingClientRect()
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            console.log('⏰ Auto-removing notification after 5 seconds');
            toast.remove();
        }
    }, 5000);
    
    // Return for debugging
    return toast;
}
    showBulkUploadModal() {
        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">Bulk Upload</h3>
                    <button class="modal-close" onclick="admin.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="empty-state">
                        <i class="fas fa-upload"></i>
                        <h3>Bulk Upload Coming Soon</h3>
                        <p>Upload multiple movies via CSV or JSON functionality will be available soon.</p>
                    </div>
                </div>
            </div>
        `;
        
        this.showModal(modalHtml);
    }
    
    logout() {
    localStorage.removeItem('token');  // ✅ Remove 'token'
    window.location.href = '/admin-login';
    // No return statement needed
}
loadQuizAnalyticsContent() {
    return `
        <div class="quiz-analytics-page">
            <div class="page-header">
                <h2>📊 Quiz Analytics</h2>
                <p>User preferences from movie quizzes</p>
            </div>
            
            <!-- Simple Stats -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
                        <i class="fas fa-poll"></i>
                    </div>
                    <div class="stat-info">
                        <h3 id="totalQuizzes">0</h3>
                        <p>Total Quizzes</p>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c);">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-info">
                        <h3 id="uniqueUsers">0</h3>
                        <p>Unique Users</p>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe, #00f2fe);">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="stat-info">
                        <h3 id="avgQuizzes">0</h3>
                        <p>Avg per User</p>
                    </div>
                </div>
            </div>
            
            <!-- Top Genres Bar Chart -->
            <div class="card">
                <div class="card-header">
                    <h3>Top Genres</h3>
                    <button class="btn btn-sm btn-primary" onclick="admin.exportData('quiz-results')">
                        <i class="fas fa-download"></i> Export Data
                    </button>
                </div>
                <div class="card-body">
                    <div id="genreChart" style="height: 300px;">
                        <div class="loading-small">Loading genre chart...</div>
                    </div>
                </div>
            </div>
            
            <!-- Top Genres List -->
            <div class="card">
                <div class="card-header">
                    <h3>Genre Rankings</h3>
                </div>
                <div class="card-body">
                    <div id="genreList" class="genre-tags">
                        <div class="loading-small">Loading genre rankings...</div>
                    </div>
                </div>
            </div>
            
            <!-- Recent Results -->
            <div class="card">
                <div class="card-header">
                    <h3>Recent Quiz Results</h3>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Top Genres</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody id="quizResultsTable">
                                <tr>
                                    <td colspan="3" class="text-center">
                                        <div class="loading-small">Loading results...</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async loadQuizAnalyticsData() {
    try {
        console.log('📊 Loading quiz analytics...');
        
        const data = await this.apiRequest(`${this.baseUrl}/quiz-analytics/stats`);
        
        this.updateQuizStats(data);
        this.updateGenreChart(data);
        this.updateGenresList(data);
        this.updateQuizResultsTable(data);
        
    } catch (error) {
        console.error('❌ Error loading quiz analytics:', error);
        this.showSimpleError();
    }
}

updateQuizStats(data) {
    document.getElementById('totalQuizzes').textContent = data.stats?.total_quizzes || 0;
    document.getElementById('uniqueUsers').textContent = data.stats?.unique_users || 0;
    document.getElementById('avgQuizzes').textContent = 
        data.stats?.avg_quizzes_per_user?.toFixed(1) || '0';
}

updateGenreChart(data) {
    const chartContainer = document.getElementById('genreChart');
    if (!chartContainer) return;
    
    const topGenres = data.top_genres || [];
    
    if (topGenres.length === 0) {
        chartContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-bar"></i>
                <p>No genre data available</p>
            </div>
        `;
        return;
    }
    
    // Calculate total for percentages
    const total = topGenres.reduce((sum, genre) => sum + genre.count, 0);
    
    // Create bar chart
    chartContainer.innerHTML = `
        <div class="genre-chart">
            ${topGenres.map(genre => {
                const percentage = ((genre.count / total) * 100).toFixed(1);
                return `
                    <div class="chart-row">
                        <div class="chart-label">${genre.genre}</div>
                        <div class="chart-bar-container">
                            <div class="chart-bar" style="width: ${percentage}%">
                                <span class="chart-value">${genre.count} (${percentage}%)</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

updateGenresList(data) {
    const genreList = document.getElementById('genreList');
    if (!genreList) return;
    
    const topGenres = data.top_genres || [];
    
    if (topGenres.length === 0) {
        genreList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-info-circle"></i>
                <p>No genre data available</p>
            </div>
        `;
        return;
    }
    
    genreList.innerHTML = topGenres.map((genre, index) => `
        <div class="genre-rank-item">
            <span class="rank-badge">${index + 1}</span>
            <span class="genre-name">${genre.genre}</span>
            <span class="genre-count">${genre.count}</span>
        </div>
    `).join('');
}

updateQuizResultsTable(data) {
    const tbody = document.getElementById('quizResultsTable');
    if (!tbody) return;
    
    const quizzes = data.recent_quizzes || [];
    
    if (quizzes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-poll"></i>
                        <p>No quiz results yet</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = quizzes.map(quiz => `
        <tr>
            <td>
                <div class="user-info-small">
                    <div class="user-avatar-small">${quiz.user_name?.charAt(0) || 'U'}</div>
                    <div>
                        <div class="user-name">${quiz.user_name || 'Unknown'}</div>
                        <div class="user-email">${quiz.user_email || ''}</div>
                    </div>
                </div>
            </td>
            <td>
                <div class="genres-small">
                    ${(quiz.top_genres || []).slice(0, 3).map(genre => `
                        <span class="genre-chip">${genre}</span>
                    `).join('')}
                </div>
            </td>
            <td>
                ${quiz.created_at ? new Date(quiz.created_at).toLocaleDateString() : 'Unknown'}
            </td>
        </tr>
    `).join('');
}

showSimpleError() {
    // Simple error display
    const elements = ['genreChart', 'genreList', 'quizResultsTable'];
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to load data</p>
                </div>
            `;
        }
    });
}

loadReportsContent() {
    return `
        <div class="reports-page">
            <div class="page-header">
                <h2>Data Export</h2>
                <p>Export your data in CSV format</p>
            </div>
            
            <!-- Export Cards Container -->
            <div class="export-cards">
                <!-- User Data Export -->
                <div class="export-card">
                    <div class="export-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <h3>User Data Export</h3>
                    <p>Export all user information including registration dates and activity</p>
                    <div class="export-info">
                        <span><i class="fas fa-file-csv"></i> CSV Format</span>
                        <span><i class="fas fa-database"></i> All Fields</span>
                    </div>
                    <button class="btn btn-primary" onclick="admin.exportData('users')">
                        <i class="fas fa-download"></i> Export Users
                    </button>
                </div>
                
                <!-- Movie Data Export -->
                <div class="export-card">
                    <div class="export-icon">
                        <i class="fas fa-film"></i>
                    </div>
                    <h3>Movie Catalog Export</h3>
                    <p>Export complete movie database with genres, ratings, and details</p>
                    <div class="export-info">
                        <span><i class="fas fa-file-csv"></i> CSV Format</span>
                        <span><i class="fas fa-film"></i> Full Catalog</span>
                    </div>
                    <button class="btn btn-primary" onclick="admin.exportData('movies')">
                        <i class="fas fa-download"></i> Export Movies
                    </button>
                </div>
                
                <!-- Quiz Results Export -->
                <div class="export-card">
                    <div class="export-icon">
                        <i class="fas fa-poll"></i>
                    </div>
                    <h3>Quiz Results Export</h3>
                    <p>Export all quiz results with user preferences and timestamps</p>
                    <div class="export-info">
                        <span><i class="fas fa-file-csv"></i> CSV Format</span>
                        <span><i class="fas fa-chart-bar"></i> Analytics Ready</span>
                    </div>
                    <button class="btn btn-primary" onclick="admin.exportData('quiz-results')">
                        <i class="fas fa-download"></i> Export Quiz Results
                    </button>
                </div>
            </div>
            
            <!-- Quick Stats -->
            <div class="card">
                <div class="card-header">
                    <h3>Export Statistics</h3>
                </div>
                <div class="card-body">
                    <div class="stats-row">
                        <div class="stat-item">
                            <span class="stat-label">Total Users:</span>
                            <span class="stat-value" id="totalUsersStat">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Total Movies:</span>
                            <span class="stat-value" id="totalMoviesStat">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Total Quizzes:</span>
                            <span class="stat-value" id="totalQuizzesStat">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Last Export:</span>
                            <span class="stat-value" id="lastExport">Never</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
async exportData(reportType) {
    try {
        console.log('🔍 ===== EXPORT DEBUG START =====');
        console.log('📊 Report Type:', reportType);
        
        // 1. Check token
        const token = localStorage.getItem('admin_token');
        console.log('🔑 Token in localStorage:', token ? `Found (${token.length} chars)` : 'NOT FOUND');
        console.log('🔑 Token preview:', token ? token.substring(0, 30) + '...' : 'N/A');
        
        if (!token) {
            alert('❌ ERROR: No token found in localStorage!\nPlease login again.');
            this.logout();
            return;
        }
        
        // 2. Show alert before starting
        const userConfirmed = confirm(`📤 Export ${reportType}\n\nDebug info will be shown in console.\nClick OK to continue or Cancel to stop.`);
        if (!userConfirmed) {
            console.log('🚫 Export cancelled by user');
            return;
        }
        
        // 3. Try fetch method with detailed logging
        console.log('🔄 Trying fetch method...');
        console.log('📡 Endpoint:', `${this.baseUrl}/reports/export/${reportType}`);
        
        try {
            const response = await fetch(`${this.baseUrl}/reports/export/${reportType}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('📥 Response received:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: Object.fromEntries(response.headers.entries())
            });
            
            // Check response
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Server error:', errorText);
                
                alert(`❌ Export Failed!\n\nStatus: ${response.status} ${response.statusText}\n\nError: ${errorText}\n\nCheck console for details.`);
                
                if (response.status === 401) {
                    alert('⚠️ 401 Unauthorized: Token is invalid or expired.\nYou will be logged out.');
                    this.logout();
                    return;
                }
                
                if (response.status === 403) {
                    alert('🚫 403 Forbidden: Admin access required.');
                    return;
                }
                
                throw new Error(`Server returned ${response.status}: ${errorText}`);
            }
            
            // Success - handle download
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `${reportType}_export.csv`;
            
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) {
                    filename = match[1];
                }
            }
            
            console.log('💾 Downloading file:', filename);
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                console.log('✅ Download completed:', filename);
                alert(`✅ Export Successful!\n\nFile: ${filename}\n\nCheck your downloads folder.`);
            }, 100);
            
        } catch (fetchError) {
            console.error('❌ Fetch method failed:', fetchError);
            alert(`❌ Fetch method failed!\n\nError: ${fetchError.message}\n\nTrying fallback method...`);
            
            // 4. Fallback to iframe method
            console.log('🔄 Trying iframe fallback method...');
            this.exportViaIframe(reportType, token);
        }
        
    } catch (error) {
        console.error('💥 EXPORT FATAL ERROR:', error);
        console.trace('Stack trace:');
        alert(`💥 EXPORT CRASHED!\n\nError: ${error.message}\n\nCheck browser console for details.`);
    } finally {
        console.log('🔍 ===== EXPORT DEBUG END =====');
    }
}

exportViaIframe(reportType, token) {
    console.log('🔧 Iframe method started...');
    console.log('🔧 Token for iframe:', token ? 'Provided' : 'Missing');
    
    try {
        // Clean up any existing iframes
        const existingIframes = document.querySelectorAll('iframe[name="exportFrame"]');
        existingIframes.forEach(iframe => {
            console.log('🧹 Removing old iframe');
            iframe.remove();
        });
        
        // Create hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.name = 'exportFrame';
        
        // Add load handler for debugging
        iframe.onload = () => {
            console.log('📄 Iframe loaded');
            try {
                console.log('📄 Iframe content:', iframe.contentDocument?.body?.innerHTML || 'No content');
            } catch (e) {
                console.log('⚠️ Cannot access iframe content (CORS)');
            }
        };
        
        iframe.onerror = (error) => {
            console.error('❌ Iframe error:', error);
            alert('❌ Iframe download failed!');
        };
        
        document.body.appendChild(iframe);
        console.log('📄 Iframe created and appended');
        
        // Create hidden form
        const form = document.createElement('form');
        form.method = 'GET';
        form.action = `${this.baseUrl}/reports/export/${reportType}`;
        form.target = 'exportFrame';
        form.style.display = 'none';
        
        // Add token as hidden input
        const tokenInput = document.createElement('input');
        tokenInput.type = 'hidden';
        tokenInput.name = 'token';
        tokenInput.value = token;
        form.appendChild(tokenInput);
        
        document.body.appendChild(form);
        console.log('📄 Form created with token');
        
        // Submit form
        form.submit();
        console.log('📄 Form submitted');
        
        // Show success message after delay
        setTimeout(() => {
            console.log('✅ Iframe method completed (assumed success)');
            alert(`📤 Export initiated for ${reportType}\n\nIf download doesn't start, check:\n1. Popup blocker\n2. Downloads folder\n3. Browser console`);
        }, 2000);
        
        // Cleanup
        setTimeout(() => {
            form.remove();
            console.log('🧹 Form removed');
        }, 5000);
        
    } catch (iframeError) {
        console.error('💥 Iframe method crashed:', iframeError);
        alert(`💥 Iframe method failed!\n\nError: ${iframeError.message}`);
    }
}
loadSettingsContent() {
    return `
        <div class="settings-page">
            <div class="page-header">
                <h2>Platform Settings</h2>
                <p>Configure basic platform options</p>
            </div>
            
            <!-- Simple Settings Form -->
            <div class="card">
                <div class="card-header">
                    <h3>General Settings</h3>
                </div>
                <div class="card-body">
                    <form id="settingsForm" onsubmit="admin.saveSettings(event)">
                        <!-- Site Information -->
                        <div class="form-section">
                            <h4>Site Information</h4>
                            <div class="form-group">
                                <label for="siteTitle">Site Title</label>
                                <input type="text" id="siteTitle" 
                                       value="MovieMind" 
                                       placeholder="Your site name">
                            </div>
                            <div class="form-group">
                                <label for="siteDescription">Site Description</label>
                                <textarea id="siteDescription" rows="2">
                                    Smart movie recommendations based on your preferences
                                </textarea>
                            </div>
                        </div>
                        
                        <!-- Display Settings -->
                        <div class="form-section">
                            <h4>Display Settings</h4>
                            <div class="form-group">
                                <label for="itemsPerPage">Items Per Page</label>
                                <select id="itemsPerPage">
                                    <option value="10">10 items</option>
                                    <option value="20" selected>20 items</option>
                                    <option value="50">50 items</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="showRatings" checked>
                                    <span>Show movie ratings by default</span>
                                </label>
                            </div>
                        </div>
                        
                        <!-- User Settings -->
                        <div class="form-section">
                            <h4>User Settings</h4>
                            <div class="form-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="allowRegistrations" checked>
                                    <span>Allow new user registrations</span>
                                </label>
                            </div>
                            <div class="form-group">
                                <label for="defaultUserRole">Default User Role</label>
                                <select id="defaultUserRole">
                                    <option value="user" selected>Regular User</option>
                                    <option value="premium">Premium User</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-footer">
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save"></i> Save Settings
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="admin.resetSettings()">
                                Reset to Defaults
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- System Information -->
            <div class="card">
                <div class="card-header">
                    <h3>System Information</h3>
                </div>
                <div class="card-body">
                    <div class="system-info">
                        <div class="info-item">
                            <span class="info-label">Platform Version:</span>
                            <span class="info-value">1.0.0</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Database Records:</span>
                            <span class="info-value" id="dbRecords">Loading...</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Last Backup:</span>
                            <span class="info-value" id="lastBackup">Never</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">System Status:</span>
                            <span class="info-value status-active">
                                <i class="fas fa-circle"></i> Operational
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Add these methods
async saveSettings(event) {
    event.preventDefault();
    
    const settings = {
        siteTitle: document.getElementById('siteTitle').value,
        siteDescription: document.getElementById('siteDescription').value,
        itemsPerPage: document.getElementById('itemsPerPage').value,
        showRatings: document.getElementById('showRatings').checked,
        allowRegistrations: document.getElementById('allowRegistrations').checked,
        defaultUserRole: document.getElementById('defaultUserRole').value
    };
    
    // Save to localStorage (simple implementation)
    localStorage.setItem('movieMindSettings', JSON.stringify(settings));
    
    this.showNotification('Settings saved successfully!', 'success');
}

loadSettings() {
    const saved = localStorage.getItem('movieMindSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        // Populate form fields...
    }
}


}