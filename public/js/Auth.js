// public/js/Auth.js
/**
 * Authentication Module
 * Handles user login, registration, and session management
 */
class Auth {
    constructor() {
        this.sessionToken = null;
        this.username = null;
        this.onLoginSuccess = null;
        this.onLogoutSuccess = null;
        this.setupEventListeners();
    }

    /**
     * Set up authentication form event listeners
     */
    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Register form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        console.log('🔐 Auth event listeners configured');
    }

    /**
     * Handle login form submission
     */
    async handleLogin(e) {
        e.preventDefault();
        this.clearAuthError();

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (!username || !password) {
            this.setAuthError('Username and password are required.');
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login: username, password })
            });

            if (response.ok) {
                const data = await response.json();
                this.saveSession(data.token, username);
                this.hideAuthModal();
                
                if (this.onLoginSuccess) {
                    this.onLoginSuccess(username, data.token);
                }
                
                console.log(`✅ Login successful for user: ${username}`);
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Invalid username or password.' }));
                this.setAuthError(errorData.error || 'Invalid username or password.');
            }
        } catch (error) {
            console.error('❌ Login error:', error);
            this.setAuthError('Connection error while trying to login.');
        }
    }

    /**
     * Handle registration form submission
     */
    async handleRegister(e) {
        e.preventDefault();
        this.clearAuthError();

        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;

        if (!username || !password) {
            this.setAuthError('Username and password are required.');
            return;
        }

        if (password.length < 4) {
            this.setAuthError('Password must be at least 4 characters long.');
            return;
        }

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login: username, password })
            });

            if (response.ok) {
                // Auto-login after successful registration
                const loginResponse = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ login: username, password })
                });

                if (loginResponse.ok) {
                    const loginData = await loginResponse.json();
                    this.saveSession(loginData.token, username);
                    this.hideAuthModal();
                    
                    if (this.onLoginSuccess) {
                        this.onLoginSuccess(username, loginData.token);
                    }
                    
                    console.log(`✅ Registration and auto-login successful for user: ${username}`);
                } else {
                    this.setAuthError('Registration successful, but auto-login failed.');
                }
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Registration failed.' }));
                this.setAuthError(errorData.error || 'Registration failed.');
            }
        } catch (error) {
            console.error('❌ Registration error:', error);
            this.setAuthError('Connection error while trying to register.');
        }
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            // Clean up session on server
            await this.cleanupSession();
            
            // Clear local session
            this.clearSession();
            
            // Show auth modal
            this.showAuthModal();
            
            if (this.onLogoutSuccess) {
                this.onLogoutSuccess();
            }
            
            console.log('✅ Logout successful');
            
            // Reload page to clear game state
            window.location.reload();
        } catch (error) {
            console.error('❌ Logout error:', error);
        }
    }

    /**
     * Clean up session on server
     */
    async cleanupSession() {
        const session = this.getSession();
        if (!session.username) {
            console.log('🔧 No session to cleanup');
            return;
        }

        try {
            console.log(`🧹 Cleaning up session for user: ${session.username}`);
            const response = await fetch('/api/cleanup-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login: session.username })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Session cleanup successful:', data.message);
            } else {
                const errorData = await response.text();
                console.warn('⚠️ Session cleanup failed:', errorData);
            }
        } catch (error) {
            console.warn('⚠️ Session cleanup error (non-critical):', error.message);
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        const session = this.getSession();
        return !!(session.token && session.username);
    }

    /**
     * Get current session
     */
    getSession() {
        return {
            token: localStorage.getItem('sessionToken'),
            username: localStorage.getItem('username')
        };
    }

    /**
     * Save session to localStorage
     */
    saveSession(token, username) {
        localStorage.setItem('sessionToken', token);
        localStorage.setItem('username', username);
        this.sessionToken = token;
        this.username = username;
    }

    /**
     * Clear session from localStorage
     */
    clearSession() {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('username');
        this.sessionToken = null;
        this.username = null;
    }

    /**
     * Show authentication modal
     */
    showAuthModal() {
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.style.display = 'flex';
        }
    }

    /**
     * Hide authentication modal
     */
    hideAuthModal() {
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.style.display = 'none';
        }
    }

    /**
     * Set authentication error message
     */
    setAuthError(message) {
        const errorElement = document.getElementById('auth-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    /**
     * Clear authentication error message
     */
    clearAuthError() {
        const errorElement = document.getElementById('auth-error');
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    }

    /**
     * Create logout button in player panel
     */
    createLogoutButton(container) {
        let button = document.getElementById('logout-btn');
        if (!button) {
            button = document.createElement('button');
            button.id = 'logout-btn';
            button.textContent = 'Logout';
            button.className = 'action-button w-full bg-red-600 hover:bg-red-700 mt-3';
            button.onclick = () => this.logout();
            
            if (container) {
                container.appendChild(button);
            }
        }
        return button;
    }

    /**
     * Check session on page load
     */
    checkExistingSession() {
        const session = this.getSession();
        if (session.token && session.username) {
            this.sessionToken = session.token;
            this.username = session.username;
            this.hideAuthModal();
            
            if (this.onLoginSuccess) {
                this.onLoginSuccess(session.username, session.token);
            }
            
            return true;
        } else {
            this.showAuthModal();
            return false;
        }
    }

    /**
     * Set login success callback
     */
    onLogin(callback) {
        this.onLoginSuccess = callback;
    }

    /**
     * Set logout success callback
     */
    onLogout(callback) {
        this.onLogoutSuccess = callback;
    }

    /**
     * Get current username
     */
    getUsername() {
        return this.username || this.getSession().username;
    }

    /**
     * Get current session token
     */
    getToken() {
        return this.sessionToken || this.getSession().token;
    }
}

// Export for use in other modules
window.Auth = Auth;
