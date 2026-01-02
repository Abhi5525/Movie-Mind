// Admin Dashboard JavaScript - CORRECTED
class AdminDashboard {
    constructor() {
        // Only ONE constructor!
        this.currentPage = 'dashboard';
        this.token = localStorage.getItem('admin_token');
        this.currentUser = null;
        
        console.log('🔧 AdminDashboard initialized');
        console.log('🔧 Token:', this.token ? this.token.substring(0, 30) + '...' : 'None');
        
        this.init();
    }
    
    init() {
        console.log('🔧 init() called');
        this.checkAuth();
        this.setupEventListeners();
        // Don't call loadPage here - checkAuth will handle it
    }
    
    checkAuth() {
        console.log('🔧 checkAuth() called');
        
        if (!this.token) {
            console.log('❌ No token found, redirecting to login');
            window.location.href = '/admin-login';
            return;
        }
        
        console.log('🔧 Token found, checking validity...');
        this.loadCurrentUser();
    }
    
    async loadCurrentUser() {
        console.log('🔧 loadCurrentUser() called');
        
        try {
            console.log('🔧 Making request to /auth/admin/dashboard');
            const response = await fetch('/admin/dashboard', {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('🔧 Response status:', response.status);
            console.log('🔧 Response headers:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                const errorText = await response.text();
                console.log('❌ Response not OK. Error:', errorText);
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('🔧 Response data:', data);
            
            if (!data.success) {
                console.log('❌ API returned success=false');
                throw new Error(data.error || 'API error');
            }
            
            // Update admin info
            document.getElementById('adminName').textContent = data.user?.name || 'Administrator';
            document.getElementById('adminRole').textContent = data.user?.is_admin ? 'Super Admin' : 'Admin';
            
            // Update avatar with initials
            const name = data.user?.name || 'Admin';
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
            document.getElementById('adminAvatar').textContent = initials.substring(0, 2);
            
            this.currentUser = data.user;
            
            // Now load the dashboard page
            this.loadPage('dashboard');
            
        } catch (error) {
            console.error('🔧 Auth error details:', error);
            console.error('🔧 Error stack:', error.stack);
            
            // Show error to user
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
            
            // Clear invalid token
            localStorage.removeItem('admin_token');
        }
    }
    
    // ... rest of your methods (setupEventListeners, loadPage, etc.) stay the same ...
    
   


    setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                this.loadPage(page);
                
                // Update active state
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
                this.search(e.target.value);
            }
        });
        
        // Notification bell
        document.getElementById('notificationBell').addEventListener('click', () => {
            this.showNotifications();
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
                '<div class="alert alert-danger">Error loading page</div>';
        }
    }
    
    formatPageTitle(page) {
        return page.split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    async loadDashboardContent() {
        try {
            const response = await fetch('/admin/dashboard', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to load dashboard');
            
            const data = await response.json();
            
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
                        
                        <div class="quick-action-card" onclick="admin.showUploadModal()">
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
                            <input type="text" class="search-input" placeholder="Search movies..." id="movieSearch">
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
                            <input type="text" class="search-input" placeholder="Search users..." id="userSearch">
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
    
    loadQuizAnalyticsContent() {
        return `
            <div class="quiz-analytics-page">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Quiz Analytics</h3>
                        <p class="card-subtitle">User preferences and quiz results analysis</p>
                    </div>
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-chart-bar"></i>
                            <h3>Analytics Coming Soon</h3>
                            <p>Quiz analytics and user preference reports will be available soon.</p>
                            <button class="btn btn-primary" onclick="admin.loadPage('dashboard')">
                                Go to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    loadReportsContent() {
        return `
            <div class="reports-page">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Reports</h3>
                        <p class="card-subtitle">System reports and exports</p>
                    </div>
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-file-alt"></i>
                            <h3>Reports Coming Soon</h3>
                            <p>Detailed system reports and export functionality will be available soon.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    loadSettingsContent() {
        return `
            <div class="settings-page">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Settings</h3>
                        <p class="card-subtitle">System configuration and preferences</p>
                    </div>
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-cog"></i>
                            <h3>Settings Coming Soon</h3>
                            <p>System settings and configuration will be available soon.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    initPageScripts() {
        // Initialize page-specific scripts
        switch(this.currentPage) {
            case 'movies':
                this.loadMoviesData();
                break;
            case 'users':
                this.loadUsersData();
                break;
        }
    }
    
    async loadMoviesData(page = 1) {
        try {
            const response = await fetch(`/admin/movies?page=${page}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to load movies');
            
            const data = await response.json();
            
            // Update table
            const tbody = document.getElementById('moviesTableBody');
            if (tbody) {
                tbody.innerHTML = data.movies?.map(movie => `
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
                                <button class="action-btn edit" onclick="admin.editMovie(${movie.id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn delete" onclick="admin.deleteMovie(${movie.id})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('') || '<tr><td colspan="6" class="text-center">No movies found</td></tr>';
            }
            
        } catch (error) {
            console.error('Error loading movies:', error);
            const tbody = document.getElementById('moviesTableBody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center">
                            <div class="alert alert-danger">Error loading movies: ${error.message}</div>
                        </td>
                    </tr>
                `;
            }
        }
    }
    
    async loadUsersData(page = 1) {
        try {
            const response = await fetch(`/admin/users?page=${page}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to load users');
            
            const data = await response.json();
            
            // Update table
            const tbody = document.getElementById('usersTableBody');
            if (tbody) {
                tbody.innerHTML = data.users?.map(user => `
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
                                <button class="action-btn edit" onclick="admin.editUser(${user.id})">
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
                `).join('') || '<tr><td colspan="6" class="text-center">No users found</td></tr>';
            }
            
        } catch (error) {
            console.error('Error loading users:', error);
            const tbody = document.getElementById('usersTableBody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center">
                            <div class="alert alert-danger">Error loading users: ${error.message}</div>
                        </td>
                    </tr>
                `;
            }
        }
    }
    
    showAddMovieModal() {
        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">Add New Movie</h3>
                    <button class="modal-close" onclick="admin.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Movie creation form will be implemented in the next step.</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="admin.closeModal()">Cancel</button>
                    <button class="btn btn-primary">Save Movie</button>
                </div>
            </div>
        `;
        
        this.showModal(modalHtml);
    }
    
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
    
     logout() {
        console.log('🔧 logout() called - clearing token');
        localStorage.removeItem('admin_token');
        window.location.href = '/admin-login';
    }
    search(query) {
        console.log('Searching for:', query);
        // Implementation depends on current page
        if (this.currentPage === 'movies') {
            // Filter movies
        } else if (this.currentPage === 'users') {
            // Filter users
        }
    }
    
    showNotifications() {
        const modalHtml = `
            <div class="modal" style="max-width: 400px;">
                <div class="modal-header">
                    <h3 class="modal-title">Notifications</h3>
                    <button class="modal-close" onclick="admin.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Notification system will be implemented in the next phase.</p>
                </div>
            </div>
        `;
        
        this.showModal(modalHtml);
    }
    
    // Placeholder methods for movie/user operations
    viewMovie(movieId) {
        alert(`View movie ${movieId} - To be implemented`);
    }
    
    editMovie(movieId) {
        alert(`Edit movie ${movieId} - To be implemented`);
    }
    
    deleteMovie(movieId) {
        if (confirm('Are you sure you want to delete this movie?')) {
            alert(`Delete movie ${movieId} - To be implemented`);
        }
    }
    
    viewUser(userId) {
        alert(`View user ${userId} - To be implemented`);
    }
    
    editUser(userId) {
        alert(`Edit user ${userId} - To be implemented`);
    }
    
    deleteUser(userId) {
        if (confirm('Are you sure you want to delete this user?')) {
            alert('Delete user ' + userId + ' - To be implemented');
        }
    }
    
    showUploadModal() {
        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">Bulk Upload</h3>
                    <button class="modal-close" onclick="admin.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Bulk upload functionality will be implemented in the next phase.</p>
                </div>
            </div>
        `;
        
        this.showModal(modalHtml);
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 DOM loaded, initializing AdminDashboard');
    window.admin = new AdminDashboard();
});
