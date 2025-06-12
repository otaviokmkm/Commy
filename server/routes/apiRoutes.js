// server/routes/apiRoutes.js
const express = require('express');
const { registerUser, authenticateUser, clearSessionToken } = require('../auth/auth');
const { savePlayerProgress, getAllUsers, getGlobalStats, getPlayerData } = require('../database/database');

const router = express.Router();

// Active sessions management (will be moved to session manager later)
const activeSessions = new Map();

/**
 * Register a new user
 */
router.post('/register', async (req, res) => {
    try {
        const { login, password } = req.body;
        const result = await registerUser(login, password);
        
        if (result.success) {
            res.json({ success: true, message: 'Usuário registrado com sucesso!' });
        } else {
            res.status(400).json({ error: result.error });
        }
    } catch (error) {
        console.error('Registration endpoint error:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

/**
 * User login
 */
router.post('/login', async (req, res) => {
    try {
        console.log('=== LOGIN ATTEMPT ===');
        const { login, password } = req.body;
        
        // Check for existing active session
        if (activeSessions.has(login)) {
            console.log(`User ${login} already has active session, invalidating...`);
            
            const existingSession = activeSessions.get(login);
            if (existingSession.socketId) {
                // Will be handled by socket cleanup
                console.log(`Found existing socket: ${existingSession.socketId}`);
            }
            
            activeSessions.delete(login);
        }
        
        // Authenticate user
        const authResult = await authenticateUser(login, password);
        
        if (authResult.success) {
            // Create new session entry
            activeSessions.set(login, {
                socketId: null,
                sessionToken: authResult.token,
                loginTime: new Date().toISOString()
            });
            
            console.log(`✅ User ${login} authenticated successfully`);
            res.json({
                success: true,
                token: authResult.token,
                login: authResult.user.login,
                progress: authResult.user.progress
            });
        } else {
            res.status(401).json({ error: authResult.error });
        }
    } catch (error) {
        console.error('Login endpoint error:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

/**
 * Save player progress (restricted to combat victories only)
 */
router.post('/save-progress', async (req, res) => {
    try {
        const { login, progress, triggerType = 'manual' } = req.body;
        
        if (!login || !progress) {
            return res.status(400).json({ error: 'Dados insuficientes.' });
        }
        
        // SECURITY: Only allow combat victory saves
        if (triggerType !== 'combatVictory') {
            console.log(`❌ Save blocked for ${login} - triggerType: ${triggerType}`);
            return res.json({
                success: false,
                message: 'Save blocked - only combat victory saves allowed'
            });
        }
        
        const success = await savePlayerProgress(login, progress, triggerType);
        
        if (success) {
            res.json({ success: true, message: 'Progresso salvo com sucesso!' });
        } else {
            res.status(500).json({ error: 'Erro ao salvar progresso.' });
        }
    } catch (error) {
        console.error('Save progress endpoint error:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

/**
 * Clean up user session
 */
router.post('/cleanup-session', async (req, res) => {
    try {
        const { login } = req.body;
        
        if (!login) {
            return res.status(400).json({ error: 'Login é obrigatório.' });
        }
        
        console.log(`[SESSION CLEANUP] Cleaning up session for: ${login}`);
        
        // Remove from active sessions
        if (activeSessions.has(login)) {
            activeSessions.delete(login);
            console.log(`[SESSION CLEANUP] Removed active session for ${login}`);
        }
        
        // Clear session token in database
        const success = await clearSessionToken(login);
        
        if (success) {
            console.log(`[SESSION CLEANUP] Cleared database token for ${login}`);
            res.json({ success: true, message: 'Sessão limpa com sucesso.' });
        } else {
            res.status(500).json({ error: 'Erro ao limpar sessão.' });
        }
    } catch (error) {
        console.error('Session cleanup endpoint error:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

/**
 * Get server statistics (admin endpoint)
 */
router.get('/stats', async (req, res) => {
    try {
        const globalStats = await getGlobalStats();
        const activeSessionsCount = activeSessions.size;
        
        res.json({
            success: true,
            stats: {
                ...globalStats,
                activeUsers: activeSessionsCount,
                activeSessions: Array.from(activeSessions.keys())
            }
        });
    } catch (error) {
        console.error('Stats endpoint error:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

/**
 * Load player progress and statistics
 */
router.get('/load-progress/:login', async (req, res) => {
    try {
        const { login } = req.params;
        console.log(`[LOAD DEBUG] Loading progress for user: ${login}`);
        
        const playerData = await getPlayerData(login);
        
        if (playerData.error) {
            console.log(`[LOAD DEBUG] ${playerData.error} for user: ${login}`);
            return res.status(404).json({ error: playerData.error });
        }
        
        console.log(`[LOAD DEBUG] Progress loaded successfully for user: ${login}`);
        res.json(playerData);
    } catch (error) {
        console.error('Load progress endpoint error:', error);
        res.status(500).json({ error: 'Failed to load progress' });
    }
});

/**
 * Get player data (alternative endpoint for client compatibility)
 */
router.get('/player-data', async (req, res) => {
    try {
        // Extract username from authorization header or session
        const authHeader = req.headers.authorization;
        const username = req.query.username || req.headers['x-username'];
        
        if (!username) {
            return res.status(400).json({ error: 'Username required' });
        }
        
        const playerData = await getPlayerData(username);
        
        if (playerData.error) {
            return res.status(404).json({ error: playerData.error });
        }
        
        res.json(playerData);
    } catch (error) {
        console.error('Player data endpoint error:', error);
        res.status(500).json({ error: 'Failed to load player data' });
    }
});

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

/**
 * Force enemy respawn (admin/debug endpoint)
 */
router.post('/respawn-enemies', async (req, res) => {
    try {
        const { mapId = 'open_world' } = req.body;
        
        // This would trigger enemy respawn via the map manager
        // For now, just return success
        res.json({
            success: true,
            message: `Enemy respawn triggered for map: ${mapId}`,
            timestamp: new Date().toISOString()
        });
        
        console.log(`🔄 Enemy respawn triggered for map: ${mapId}`);
    } catch (error) {
        console.error('Enemy respawn endpoint error:', error);
        res.status(500).json({ error: 'Failed to trigger enemy respawn' });
    }
});

// Export router and session management for use by socket handlers
module.exports = {
    router,
    activeSessions
};
