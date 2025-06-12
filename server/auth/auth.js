// server/auth/auth.js
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { getUserByLogin, createUser, updateUser } = require('../database/database');

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(password) {
    try {
        return await bcrypt.hash(password, SALT_ROUNDS);
    } catch (error) {
        console.error('Error hashing password:', error);
        throw new Error('Password hashing failed');
    }
}

/**
 * Verify a password against its hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} - True if password matches
 */
async function verifyPassword(password, hash) {
    try {
        return await bcrypt.compare(password, hash);
    } catch (error) {
        console.error('Error verifying password:', error);
        return false;
    }
}

/**
 * Generate a secure session token
 * @returns {string} - Random hex token
 */
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Register a new user
 * @param {string} login - Username
 * @param {string} password - Plain text password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function registerUser(login, password) {
    try {
        // Validate input
        if (!login || !password) {
            return { success: false, error: 'Login e senha obrigatórios.' };
        }

        if (login.length < 3) {
            return { success: false, error: 'Login deve ter pelo menos 3 caracteres.' };
        }

        if (password.length < 6) {
            return { success: false, error: 'Senha deve ter pelo menos 6 caracteres.' };
        }

        // Check if user already exists
        const existingUser = await getUserByLogin(login);
        if (existingUser) {
            return { success: false, error: 'Login já existe.' };
        }

        // Hash password and create user
        const hashedPassword = await hashPassword(password);
        const newUser = {
            login,
            password: hashedPassword,
            progress: {},
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        await createUser(newUser);
        console.log(`New user registered: ${login}`);
        
        return { success: true };
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, error: 'Erro interno do servidor.' };
    }
}

/**
 * Authenticate a user login
 * @param {string} login - Username
 * @param {string} password - Plain text password
 * @returns {Promise<{success: boolean, token?: string, error?: string}>}
 */
async function authenticateUser(login, password) {
    try {
        // Validate input
        if (!login || !password) {
            return { success: false, error: 'Login e senha obrigatórios.' };
        }

        // Get user from database
        const user = await getUserByLogin(login);
        if (!user) {
            return { success: false, error: 'Login ou senha inválidos.' };
        }

        // Verify password
        const isPasswordValid = await verifyPassword(password, user.password);
        if (!isPasswordValid) {
            return { success: false, error: 'Login ou senha inválidos.' };
        }

        // Generate session token
        const sessionToken = generateSessionToken();
        
        // Update user with session token and last login
        await updateUser(login, {
            sessionToken,
            lastLogin: new Date().toISOString()
        });

        console.log(`User authenticated: ${login}`);
        
        return { 
            success: true, 
            token: sessionToken,
            user: {
                login: user.login,
                progress: user.progress || {}
            }
        };
    } catch (error) {
        console.error('Authentication error:', error);
        return { success: false, error: 'Erro interno do servidor.' };
    }
}

/**
 * Verify a session token
 * @param {string} login - Username
 * @param {string} token - Session token
 * @returns {Promise<boolean>} - True if token is valid
 */
async function verifySessionToken(login, token) {
    try {
        if (!login || !token) {
            return false;
        }

        const user = await getUserByLogin(login);
        return user && user.sessionToken === token;
    } catch (error) {
        console.error('Session verification error:', error);
        return false;
    }
}

/**
 * Clear a user's session token
 * @param {string} login - Username
 * @returns {Promise<boolean>} - True if successful
 */
async function clearSessionToken(login) {
    try {
        await updateUser(login, { sessionToken: null });
        return true;
    } catch (error) {
        console.error('Error clearing session token:', error);
        return false;
    }
}

module.exports = {
    hashPassword,
    verifyPassword,
    generateSessionToken,
    registerUser,
    authenticateUser,
    verifySessionToken,
    clearSessionToken
};
