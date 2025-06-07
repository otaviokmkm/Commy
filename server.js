// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Authentication System ---
const USERS_FILE = './users.json';

// Função para ler usuários do arquivo
function readUsers() {
    console.log('Reading users.json file...');
    if (!fs.existsSync(USERS_FILE)) {
        console.log('users.json file does not exist, returning empty array');
        return [];
    }
    try {
        const data = fs.readFileSync(USERS_FILE);
        const users = JSON.parse(data);
        console.log('Successfully loaded', users.length, 'users from file');
        return users;
    } catch (error) {
        console.error('Erro ao ler users.json:', error);
        return [];
    }
}

// Função para salvar usuários no arquivo
function saveUsers(users) {
    console.log('Saving', users.length, 'users to file...');
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        console.log('Successfully saved users to file');
    } catch (error) {
        console.error('Erro ao salvar users.json:', error);
    }
}

// Cadastro
app.post('/api/register', (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Login e senha obrigatórios.' });
    const users = readUsers();
    if (users.find(u => u.login === login)) return res.status(400).json({ error: 'Login já existe.' });
    users.push({ login, password, progress: {} }); // já cria o campo progress vazio
    saveUsers(users);
    res.json({ success: true });
});

// Login
app.post('/api/login', (req, res) => {
    console.log('=== LOGIN ATTEMPT DEBUG ===');
    console.log('Request body received:', req.body);
    
    const { login, password } = req.body;
    console.log('Extracted login:', login);
    console.log('Extracted password:', password);
    
    if (!login || !password) {
        console.log('ERROR: Missing login or password');
        return res.status(400).json({ error: 'Login e senha obrigatórios.' });
    }
    
    const users = readUsers();
    console.log('Total users in database:', users.length);
    console.log('Valid users (with login field):', users.filter(u => u.login).length);
    
    // Log all valid users for debugging (without passwords)
    users.forEach((user, index) => {
        if (user.login) {
            console.log(`User ${index}: login="${user.login}", hasPassword=${!!user.password}`);
        }
    });
    
    const user = users.find(u => u.login === login && u.password === password);
    console.log('User found:', !!user);
    
    if (!user) {
        console.log('ERROR: Invalid credentials - user not found or password mismatch');
        return res.status(401).json({ error: 'Login ou senha inválidos.' });
    }    // Check if user already has an active session and disconnect them
    if (activeSessions.has(login)) {
        console.log('FOUND EXISTING SESSION: User already logged in, invalidating previous session');
        
        const existingSession = activeSessions.get(login);
        const socketId = existingSession.socketId;
        
        // Find and disconnect existing socket connection
        if (socketId) {
            console.log(`Disconnecting existing session for user ${login} on socket ${socketId}`);
            
            // Clean up player data if exists
            if (players[socketId]) {
                const player = players[socketId];
                if (maps[player.mapId]) {
                    maps[player.mapId].players.delete(socketId);
                    // Notify other players in the map that this player left
                    io.to(player.mapId).emit('playerLeft', { playerId: player.id, mapId: player.mapId });
                }
                // Remove player from server state
                delete players[socketId];
            }
            
            // Disconnect the socket
            const   socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit('sessionInvalidated', { message: 'Sua sessão foi invalidada por um novo login.' });
                socket.disconnect(true);
            }
        }
        
        // Always remove from active sessions to allow new login
        activeSessions.delete(login);
        console.log(`Removed existing session for user ${login}`);
    }
      // Generate a new unique token
    const token = crypto.randomBytes(16).toString('hex');
    console.log('Generated token:', token);
    
    user.sessionToken = token;
    saveUsers(users);
    
    // Add to active sessions immediately after login (before socket authentication)
    // This prevents race conditions where multiple logins happen before socket auth
    activeSessions.set(login, { socketId: null, sessionToken: token });
    console.log(`Added pending session for user ${login}`);
    
    console.log('SUCCESS: User authenticated and token saved');
    console.log('=== END LOGIN DEBUG ===');
    
    res.json({ success: true, token, login });
});

// Enhanced save progress API endpoint - RESTRICTED: Only combat victory saves allowed
app.post('/api/save-progress', (req, res) => {
    const { login, progress, triggerType = 'manual' } = req.body;
    if (!login || !progress) {
        return res.status(400).json({ error: 'Dados insuficientes.' });
    }
    
    // SIMPLIFIED SYSTEM: Only allow combat victory saves
    if (triggerType !== 'combatVictory') {
        console.log(`❌ Save blocked for ${login} - triggerType: ${triggerType} (only combatVictory allowed)`);
        return res.json({ success: false, message: 'Save blocked - only combat victory saves allowed' });
    }
    
    const success = savePlayerProgress(login, progress, triggerType);
    if (success) {
        res.json({ success: true, message: 'Progresso salvo com sucesso!' });
    } else {
        res.status(500).json({ error: 'Erro ao salvar progresso.' });
    }
});

// NEW: Session cleanup endpoint to fix authentication issues
app.post('/api/cleanup-session', (req, res) => {
    const { login } = req.body;
    if (!login) {
        return res.status(400).json({ error: 'Login é obrigatório.' });
    }
    
    console.log(`[SESSION CLEANUP] Cleaning up session for user: ${login}`);
    
    // Remove from active sessions
    if (activeSessions.has(login)) {
        const session = activeSessions.get(login);
        console.log(`[SESSION CLEANUP] Found active session for ${login}, removing...`);
        
        // Disconnect socket if exists
        if (session.socketId) {
            const socket = io.sockets.sockets.get(session.socketId);
            if (socket) {
                socket.disconnect(true);
                console.log(`[SESSION CLEANUP] Disconnected socket ${session.socketId}`);
            }
        }
        
        activeSessions.delete(login);
        console.log(`[SESSION CLEANUP] Session removed for ${login}`);
    }
    
    // Clear session token in database
    const users = readUsers();
    const user = users.find(u => u.login === login);
    if (user) {
        delete user.sessionToken;
        saveUsers(users);
        console.log(`[SESSION CLEANUP] Cleared session token for ${login} in database`);
    }
    
    res.json({ success: true, message: 'Sessão limpa com sucesso!' });
});

// NEW: Create user endpoint for missing users
app.post('/api/create-user', (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) {
        return res.status(400).json({ error: 'Login e senha são obrigatórios.' });
    }
    
    console.log(`[CREATE USER] Creating user: ${login}`);
    
    const users = readUsers();
    const existingUser = users.find(u => u.login === login);
    
    if (existingUser) {
        return res.status(409).json({ error: 'Usuário já existe.' });
    }
    
    // Create new user with default progress
    const newUser = {
        login,
        password,
        progress: {
            hp: 100,
            maxHp: 100,
            ap: 60,
            maxAp: 60,
            mp: 30,
            maxMp: 30,
            attackPower: 15,
            attackRange: 2,
            gold: 0,
            level: 1,
            experience: 0,
            overworldX: 100,
            overworldY: 100,
            mapId: "open_world",
            lastSaved: Date.now(),
            saveVersion: "2.0"
        }
    };
    
    users.push(newUser);
    saveUsers(users);
    
    console.log(`[CREATE USER] User ${login} created successfully`);
    res.json({ success: true, message: 'Usuário criado com sucesso!' });
});

// Enhanced load progress API endpoint
app.get('/api/load-progress/:login', (req, res) => {
    const { login } = req.params;
    console.log(`[LOAD DEBUG SERVER] Loading progress for user: ${login}`);
    
    const users = readUsers();
    const user = users.find(u => u.login === login);
    
    if (!user) {
        console.log(`[LOAD DEBUG SERVER] User ${login} not found`);
        return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    
    // Initialize player stats if not exists
    initializePlayerStats(login);
    
    const progress = user.progress || {};
    const stats = playerStats[login];
    
    console.log(`[LOAD DEBUG SERVER] Progress data being sent:`, progress);
    console.log(`[LOAD DEBUG SERVER] Gold value in progress: ${progress.gold}`);
    
    res.json({ 
        progress,
        statistics: stats,
        message: 'Progresso carregado com sucesso!'
    });
});

// New API endpoints for enhanced player data management
// Trigger save API endpoint - DISABLED: Only combat victory saves allowed
app.post('/api/trigger-save', (req, res) => {
    const { login, triggerType, data } = req.body;
    if (!login || !triggerType) {
        return res.status(400).json({ error: 'Login e tipo de trigger obrigatórios.' });
    }
    
    // SIMPLIFIED SYSTEM: Block all trigger saves except combat victory
    if (triggerType !== 'combatVictory') {
        console.log(`❌ Trigger save blocked for ${login} - triggerType: ${triggerType} (only combatVictory allowed)`);
        return res.json({ success: false, message: 'Trigger save blocked - only combat victory saves allowed' });
    }
    
    const users = readUsers();
    const user = users.find(u => u.login === login);
    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    
    const success = savePlayerProgress(login, data || user.progress, triggerType);
    res.json({ success, message: success ? 'Save triggered successfully' : 'Save failed' });
});

app.get('/api/player-stats/:login', (req, res) => {
    const { login } = req.params;
    const stats = playerStats[login];
    
    if (!stats) {
        return res.status(404).json({ error: 'Estatísticas não encontradas.' });
    }
    
    // Convert Sets to arrays for JSON serialization
    const serializedStats = {
        ...stats,
        exploration: {
            ...stats.exploration,
            mapsVisited: Array.from(stats.exploration.mapsVisited),
        },
        achievements: {
            ...stats.achievements,
            firstTimeAchievements: Array.from(stats.achievements.firstTimeAchievements)
        }
    };
    
    res.json({ statistics: serializedStats });
});

app.post('/api/update-stats', (req, res) => {
    const { login, statType, data } = req.body;
    if (!login || !statType || !data) {
        return res.status(400).json({ error: 'Dados insuficientes.' });
    }
    
    const stats = initializePlayerStats(login);
    
    // Update specific stat category
    switch (statType) {
        case 'combat':
            Object.assign(stats.combat, data);
            break;
        case 'exploration':
            Object.assign(stats.exploration, data);
            if (data.mapsVisited) {
                data.mapsVisited.forEach(map => stats.exploration.mapsVisited.add(map));
            }
            break;
        case 'progression':
            Object.assign(stats.progression, data);
            break;
        case 'achievements':
            Object.assign(stats.achievements, data);
            if (data.firstTimeAchievements) {
                data.firstTimeAchievements.forEach(achievement => 
                    stats.achievements.firstTimeAchievements.add(achievement)
                );
            }
            break;
    }
    
    res.json({ success: true, message: 'Estatísticas atualizadas!' });
});

// --- Game Constants (Shared with Client Logic if possible, or ensure consistency) ---
const MAP_TILES = { EMPTY: 0, OBSTACLE_ROCK: 1, DECORATION_TREE: 2, DECORATION_BUSH: 3 };
const OPEN_WORLD_ID = 'open_world';
const OPEN_WORLD_SIZE = 200; // Should match client if client generates fallback
const DEFAULT_GRID_COLS = 20; // Default for smaller maps if not specified
const DEFAULT_GRID_ROWS = 15; // Default for smaller maps if not specified


// --- Game State Management (Server-Side) ---
const players = {}; // { socketId: { id, name, mapId, x, y, color, ... } }
const maps = {};    // { mapId: { players: Set<socketId>, mapLayoutData: [...], enemies: [...] } }
const activeSessions = new Map(); // { login: { socketId, sessionToken } }

// Enhanced Player Statistics and Auto-Save System
const playerStats = {};
const autoSaveIntervals = {};

// Auto-save configuration - SIMPLIFIED: Only save after combat victory
const AUTO_SAVE_CONFIG = {
    interval: 30000, // 30 seconds
    enabled: false,  // Disable auto-save completely
    triggers: {
        levelUp: false,          // Disabled
        combatVictory: true,     // ONLY this one enabled
        itemAcquisition: false,  // Disabled
        mapChange: false,        // Disabled
        significantProgress: false, // Disabled
        periodicSave: false      // Disabled completamente
    }
};

// Player statistics tracking structure
function initializePlayerStats(login) {
    if (!playerStats[login]) {
        playerStats[login] = {
            session: {
                loginTime: Date.now(),
                lastSaveTime: Date.now(),
                totalPlayTime: 0,
                sessionPlayTime: 0
            },
            combat: {
                battlesWon: 0,
                battlesLost: 0,
                totalDamageDealt: 0,
                totalDamageTaken: 0,
                enemiesDefeated: 0,
                pvpWins: 0,
                pvpLosses: 0,
                criticalHits: 0,
                spellsCast: 0
            },
            exploration: {
                mapsVisited: new Set(),
                areasDiscovered: 0,
                distanceTraveled: 0,
                secretsFound: 0,
                treasuresCollected: 0
            },
            progression: {
                levelsGained: 0,
                experienceGained: 0,
                skillPointsEarned: 0,
                goldEarned: 0,
                itemsAcquired: 0,
                questsCompleted: 0
            },
            achievements: {
                milestones: [],
                firstTimeAchievements: new Set()
            }
        };
    }
    return playerStats[login];
}

// Enhanced save progress function
function savePlayerProgress(login, progressData, triggerType = 'manual') {
    const users = readUsers();
    const user = users.find(u => u.login === login);
    
    if (!user) {
        console.error(`Cannot save progress: User ${login} not found`);
        return false;
    }
    
    // Update player statistics
    const stats = playerStats[login];
    if (stats) {
        stats.session.lastSaveTime = Date.now();
        stats.session.sessionPlayTime = Date.now() - stats.session.loginTime;
        
        // Track specific triggers
        switch (triggerType) {
            case 'levelUp':
                stats.progression.levelsGained++;
                stats.progression.experienceGained += progressData.experience || 0;
                break;
            case 'combatVictory':
                stats.combat.battlesWon++;
                stats.combat.enemiesDefeated++;
                break;
            case 'itemAcquisition':
                stats.progression.itemsAcquired++;
                break;
            case 'mapChange':
                if (progressData.mapId) {
                    stats.exploration.mapsVisited.add(progressData.mapId);
                }
                break;
        }
    }
      // Create clean backup data without metadata to prevent recursion
    const cleanBackupData = user.progress ? {
        ...user.progress,
        saveMetadata: undefined, // Remove metadata to prevent recursion
        statistics: undefined    // Remove stats to keep backup lean
    } : {};
    
    // Remove undefined properties
    Object.keys(cleanBackupData).forEach(key => {
        if (cleanBackupData[key] === undefined) {
            delete cleanBackupData[key];
        }
    });
    
    // Enhanced progress data with metadata
    const enhancedProgress = {
        ...progressData,
        lastSaved: Date.now(),
        saveVersion: '2.0',
        statistics: stats,
        saveMetadata: {
            triggerType,
            saveCount: (user.progress?.saveMetadata?.saveCount || 0) + 1,
            backupData: cleanBackupData // Keep clean backup without recursion
        }
    };
    
    user.progress = enhancedProgress;
    
    try {
        saveUsers(users);
        console.log(`✅ Progress saved for ${login} (trigger: ${triggerType})`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to save progress for ${login}:`, error);
        return false;
    }
}

// Auto-save system
function startAutoSave(login, socketId) {
    if (!AUTO_SAVE_CONFIG.enabled || !AUTO_SAVE_CONFIG.triggers.periodicSave) return;
    
    // Clear existing interval if any
    if (autoSaveIntervals[login]) {
        clearInterval(autoSaveIntervals[login]);
    }
      autoSaveIntervals[login] = setInterval(() => {
        const player = players[socketId];
        if (player && activeSessions.has(login)) {
            // Only save position and basic data for periodic auto-save
            // Do NOT overwrite critical game progress data like gold, levels, etc.
            const currentProgress = {
                overworldX: player.x || 0,
                overworldY: player.y || 0,
                mapId: player.mapId || 'open_world',
                lastAutoSave: Date.now()
            };
              // Get existing user data to preserve critical progress
            const users = readUsers();
            const user = users.find(u => u.login === login);
            if (user && user.progress) {
                // Merge with existing progress, preserving critical data
                const preservedProgress = {
                    ...user.progress, // Keep existing progress
                    ...currentProgress // Only update position and timestamp  
                };
                console.log(`[AUTO-SAVE DEBUG] Preserving gold: ${user.progress.gold} for user ${login}`);
                savePlayerProgress(login, preservedProgress, 'periodicSave');
            } else {
                // Fallback for new users
                console.log(`[AUTO-SAVE DEBUG] New user fallback for ${login}`);
                savePlayerProgress(login, currentProgress, 'periodicSave');
            }
        }
    }, AUTO_SAVE_CONFIG.interval);
    
    console.log(`🔄 Auto-save started for ${login} (interval: ${AUTO_SAVE_CONFIG.interval}ms)`);
}

function stopAutoSave(login) {
    if (autoSaveIntervals[login]) {
        clearInterval(autoSaveIntervals[login]);
        delete autoSaveIntervals[login];
        console.log(`⏹️ Auto-save stopped for ${login}`);
    }
}

// --- Map Generation Logic (Server-Side) ---
// Seeded random number generator for consistent map generation
class SeededRandom {
    constructor(seed) {
        this.m = 0x80000000; // 2**31
        this.a = 1103515245;
        this.c = 12345;
        this.state = seed ? seed : Math.floor(Math.random() * (this.m - 1));
    }
    nextInt() {
        this.state = (this.a * this.state + this.c) % this.m;
        return this.state;
    }
    next() {
        return this.nextInt() / (this.m - 1);
    }
}

// Fixed seed for open world to ensure consistency across all players
const OPEN_WORLD_SEED = 42; // Fixed seed for persistent open world

function generateServerMapLayout(mapId, G_COLS, G_ROWS) {
    const layout = [];
    const currentMapConnections = mapConnections[mapId] || {}; // Get connections for the current map
    
    // Use seeded random for open world, regular random for other maps
    const rng = mapId === OPEN_WORLD_ID ? new SeededRandom(OPEN_WORLD_SEED) : { next: () => Math.random() };

    for (let r = 0; r < G_ROWS; r++) {
        layout[r] = [];
        for (let c = 0; c < G_COLS; c++) {
            if (r === 0 || r === G_ROWS - 1 || c === 0 || c === G_COLS - 1) {
                // Check for connection points before placing a wall
                let isConnection = false;
                if (r === 0 && currentMapConnections.up) isConnection = true;
                else if (r === G_ROWS - 1 && currentMapConnections.down) isConnection = true;
                else if (c === 0 && currentMapConnections.left) isConnection = true;
                else if (c === G_COLS - 1 && currentMapConnections.right) isConnection = true;
                
                layout[r][c] = isConnection ? MAP_TILES.EMPTY : MAP_TILES.OBSTACLE_ROCK;
            } else {
                layout[r][c] = MAP_TILES.EMPTY;
            }
        }
    }    
    
    // Different densities for open world vs other maps
    let rockDensity, decorDensity;
    if (mapId === OPEN_WORLD_ID) {
        rockDensity = 0.07; // Match client density
        decorDensity = 0.10;
    } else {
        rockDensity = 0.05;
        decorDensity = 0.1;
    }

    for (let r = 1; r < G_ROWS - 1; r++) {
        for (let c = 1; c < G_COLS - 1; c++) {
            // Basic check to avoid placing obstacles on common spawn areas (e.g., near edges)
            // A more robust check would consider actual player/enemy spawn points if they are fixed.
            if (r < 3 && c < 3) continue; // Example: keep top-left area clearer

            if (rng.next() < rockDensity) {
                layout[r][c] = MAP_TILES.OBSTACLE_ROCK;
            } else if (rng.next() < decorDensity) {
                layout[r][c] = rng.next() < 0.5 ? MAP_TILES.DECORATION_TREE : MAP_TILES.DECORATION_BUSH;
            }
        }
    }
    return layout;
}

const mapConnections = { // Define this on server too for map generation logic
    // Tutorial maps removed - game starts directly in open world
    [OPEN_WORLD_ID]: { gridCols: OPEN_WORLD_SIZE, gridRows: OPEN_WORLD_SIZE } // Open world only
};


const serverGeneratedMapLayouts = {}; // Store generated layouts

// Ensure mapInitialEnemies is properly initialized with persistent open world enemies
const mapInitialEnemies = {}; 

// Generate persistent enemies for open world using seeded random
function generateOpenWorldEnemies() {
    const enemies = [];
    const rng = new SeededRandom(OPEN_WORLD_SEED + 1000); // Different seed for enemies
    
    for (let i = 0; i < 40; i++) {
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 100) { // Prevent infinite loop
            let x = 2 + Math.floor(rng.next() * (OPEN_WORLD_SIZE - 4));
            let y = 2 + Math.floor(rng.next() * (OPEN_WORLD_SIZE - 4));
            
            // Check if position is empty (we'll validate against the generated map)
            const mapLayout = serverGeneratedMapLayouts[OPEN_WORLD_ID];
            if (mapLayout && mapLayout[y] && mapLayout[y][x] === MAP_TILES.EMPTY) {
                const colors = ['#eab308', '#f87171', '#34d399', '#818cf8'];
                enemies.push({
                    id: 1000 + i,
                    originalOverworldX: x,
                    originalOverworldY: y,
                    data: {
                        aggroRange: 5 + Math.floor(rng.next() * 5),
                        combatStats: {
                            size: 18, // TILE_SIZE * 0.9 equivalent
                            color: colors[i % 4],
                            hp: 60 + Math.floor(rng.next() * 60),
                            maxHp: 60 + Math.floor(rng.next() * 60),
                            ap: 4 + Math.floor(rng.next() * 3),
                            maxAp: 4 + Math.floor(rng.next() * 3),
                            mp: 2 + Math.floor(rng.next() * 2),
                            maxMp: 2 + Math.floor(rng.next() * 2),
                            attackPower: 10 + Math.floor(rng.next() * 10),
                            attackRange: 1,
                            name: 'Monstro Selvagem',
                            loot: { gold: 10 + Math.floor(rng.next() * 20) }
                        }
                    }
                });
                placed = true;
            }
            attempts++;
        }
    }
    return enemies;
}

// Initialize map structures and generate layouts on server start
for (const mapId in mapConnections) {
    const G_COLS = mapConnections[mapId].gridCols || DEFAULT_GRID_COLS;
    const G_ROWS = mapConnections[mapId].gridRows || DEFAULT_GRID_ROWS;
    serverGeneratedMapLayouts[mapId] = generateServerMapLayout(mapId, G_COLS, G_ROWS);

    // Generate persistent enemies for open world after map layout is created
    if (mapId === OPEN_WORLD_ID) {
        mapInitialEnemies[OPEN_WORLD_ID] = generateOpenWorldEnemies();
        console.log('✅ Generated', mapInitialEnemies[OPEN_WORLD_ID].length, 'enemies for open world');
    } else {
        // Initialize empty array for other maps
        mapInitialEnemies[mapId] = [];
    }    // Validate mapInitialEnemies[mapId] and provide a fallback
    const initialEnemies = Array.isArray(mapInitialEnemies[mapId]) ? mapInitialEnemies[mapId] : [];
    console.log(`📊 Initializing map ${mapId} with ${initialEnemies.length} enemies`);

    maps[mapId] = {
        players: new Set(),
        mapLayoutData: serverGeneratedMapLayouts[mapId],        enemies: JSON.parse(JSON.stringify(initialEnemies)).map(enemyConfig => ({
            id: enemyConfig.id,
            originalOverworldX: enemyConfig.originalOverworldX,
            originalOverworldY: enemyConfig.originalOverworldY,
            overworldX: enemyConfig.originalOverworldX,
            overworldY: enemyConfig.originalOverworldY,
            isAliveOverworld: true,
            hp: enemyConfig.data.combatStats.maxHp,
            combatStats: enemyConfig.data.combatStats,
            aggroRange: enemyConfig.data.aggroRange,
            respawnTimer: null,
            inCombat: false,
            combatPlayerId: null
        }))
    };
    
    console.log(`✅ Map ${mapId} initialized with ${maps[mapId].enemies.length} enemies`);
}

// Debugging: Log the value of mapInitialEnemies[mapId] for troubleshooting
console.log('mapInitialEnemies:', mapInitialEnemies);

const ENEMY_RESPAWN_TIME = 30000; // 30 segundos

// Server-side monster AI system
const MONSTER_AI_UPDATE_INTERVAL = 1000; // 1 second
const mapMonsterAITimers = {}; // Store AI timers for each map

// Periodic map state broadcast system to prevent client desynchronization
const MAP_STATE_BROADCAST_INTERVAL = 1000; // 1 second
const mapStateBroadcastTimers = {}; // Store broadcast timers for each map

// Function to update monster AI for a specific map
function updateMapMonsterAI(mapId) {
    if (!maps[mapId] || !maps[mapId].enemies || maps[mapId].enemies.length === 0) {
        return;
    }

    const mapObj = maps[mapId];
    const playersInMap = Array.from(mapObj.players).map(socketId => players[socketId]).filter(p => p);
    
    if (playersInMap.length === 0) {
        // No players in map, stop AI updates
        return;
    }

    let anyMonsterMoved = false;
    const monsterUpdates = [];

    mapObj.enemies.forEach(enemy => {
        if (!enemy.isAliveOverworld) return;

        // Find closest player for aggro detection
        let closestPlayer = null;
        let closestDistance = Infinity;

        playersInMap.forEach(player => {
            const distance = Math.sqrt(
                Math.pow(player.x - enemy.overworldX, 2) + 
                Math.pow(player.y - enemy.overworldY, 2)
            );
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPlayer = player;
            }
        });

        // If a player is within aggro range, move towards them
        if (closestPlayer && closestDistance <= enemy.aggroRange && closestDistance > 0) {
            const dx = Math.sign(closestPlayer.x - enemy.overworldX);
            const dy = Math.sign(closestPlayer.y - enemy.overworldY);
            
            let moved = false;
            
            // Try horizontal movement first
            if (dx !== 0 && !moved) {
                const nextX = enemy.overworldX + dx;
                const nextY = enemy.overworldY;
                
                if (isValidMonsterPosition(mapId, nextX, nextY, enemy.id)) {
                    enemy.overworldX = nextX;
                    moved = true;
                    anyMonsterMoved = true;
                    
                    monsterUpdates.push({
                        id: enemy.id,
                        overworldX: enemy.overworldX,
                        overworldY: enemy.overworldY
                    });
                }
            }
            
            // Try vertical movement if horizontal failed
            if (dy !== 0 && !moved) {
                const nextX = enemy.overworldX;
                const nextY = enemy.overworldY + dy;
                
                if (isValidMonsterPosition(mapId, nextX, nextY, enemy.id)) {
                    enemy.overworldY = nextY;
                    moved = true;
                    anyMonsterMoved = true;
                    
                    monsterUpdates.push({
                        id: enemy.id,
                        overworldX: enemy.overworldX,
                        overworldY: enemy.overworldY
                    });
                }
            }
        }
    });

    // Broadcast monster position updates to all players in the map
    if (anyMonsterMoved && monsterUpdates.length > 0) {
        io.to(mapId).emit('monsterPositionUpdate', {
            mapId: mapId,
            monsters: monsterUpdates
        });
        console.log(`🔄 Monster AI Update - ${monsterUpdates.length} monsters moved in ${mapId}`);
    }
}

// Function to validate monster position (check for collisions)
function isValidMonsterPosition(mapId, x, y, excludeEnemyId = null) {
    const mapObj = maps[mapId];
    if (!mapObj) return false;

    // Check bounds
    if (mapId === OPEN_WORLD_ID) {
        if (x < 0 || x >= OPEN_WORLD_SIZE || y < 0 || y >= OPEN_WORLD_SIZE) return false;
    } else {
        const G_COLS = mapConnections[mapId]?.gridCols || DEFAULT_GRID_COLS;
        const G_ROWS = mapConnections[mapId]?.gridRows || DEFAULT_GRID_ROWS;
        if (x < 0 || x >= G_COLS || y < 0 || y >= G_ROWS) return false;
    }

    // Check map layout for obstacles
    if (mapObj.mapLayoutData && mapObj.mapLayoutData[y] && mapObj.mapLayoutData[y][x] === MAP_TILES.OBSTACLE_ROCK) {
        return false;
    }

    // Check collision with players
    const playersInMap = Array.from(mapObj.players).map(socketId => players[socketId]).filter(p => p);
    for (const player of playersInMap) {
        if (player.x === x && player.y === y) {
            return false; // Player collision
        }
    }

    // Check collision with other monsters
    for (const enemy of mapObj.enemies) {
        if (enemy.id !== excludeEnemyId && enemy.isAliveOverworld && 
            enemy.overworldX === x && enemy.overworldY === y) {
            return false; // Monster collision
        }
    }

    return true;
}

// Function to start AI updates for a map
function startMapMonsterAI(mapId) {
    if (mapMonsterAITimers[mapId]) {
        clearInterval(mapMonsterAITimers[mapId]);
    }
    
    mapMonsterAITimers[mapId] = setInterval(() => {
        updateMapMonsterAI(mapId);
    }, MONSTER_AI_UPDATE_INTERVAL);
    
    console.log(`🤖 Started monster AI for map: ${mapId}`);
}

// Function to stop AI updates for a map
function stopMapMonsterAI(mapId) {
    if (mapMonsterAITimers[mapId]) {
        clearInterval(mapMonsterAITimers[mapId]);
        delete mapMonsterAITimers[mapId];
        console.log(`🤖 Stopped monster AI for map: ${mapId}`);
    }
}

// Function to broadcast complete map state periodically to prevent client desynchronization
function broadcastMapState(mapId) {
    if (!maps[mapId]) return;
    
    const playersInMap = [];
    maps[mapId].players.forEach(playerSocketId => {
        if (players[playerSocketId]) {
            playersInMap.push({
                playerId: players[playerSocketId].id,
                x: players[playerSocketId].x,
                y: players[playerSocketId].y,
                name: players[playerSocketId].name,
                color: players[playerSocketId].color,
                mapId: players[playerSocketId].mapId
            });
        }
    });

    const mapStateData = {
        mapId: mapId,
        players: playersInMap,
        mapLayoutData: maps[mapId].mapLayoutData,
        enemies: maps[mapId].enemies.map(e => ({
            id: e.id,
            overworldX: e.overworldX,
            overworldY: e.overworldY,
            isAliveOverworld: e.isAliveOverworld,
            hp: e.hp,
            combatStats: e.combatStats,
            aggroRange: e.aggroRange,
            inCombat: e.inCombat,
            combatPlayerId: e.combatPlayerId
        }))
    };

    // Broadcast to all players in the map
    io.to(mapId).emit('mapStateSync', mapStateData);
    console.log(`🔄 Map state synced for ${mapId} - ${playersInMap.length} players, ${maps[mapId].enemies.filter(e => e.isAliveOverworld).length}/${maps[mapId].enemies.length} enemies alive`);
}

// Function to start periodic map state broadcasts for a map
function startMapStateBroadcast(mapId) {
    if (mapStateBroadcastTimers[mapId]) {
        clearInterval(mapStateBroadcastTimers[mapId]);
    }
    
    mapStateBroadcastTimers[mapId] = setInterval(() => {
        broadcastMapState(mapId);
    }, MAP_STATE_BROADCAST_INTERVAL);
    
    console.log(`📡 Started periodic map state broadcast for map: ${mapId}`);
}

// Function to stop periodic map state broadcasts for a map
function stopMapStateBroadcast(mapId) {
    if (mapStateBroadcastTimers[mapId]) {
        clearInterval(mapStateBroadcastTimers[mapId]);
        delete mapStateBroadcastTimers[mapId];
        console.log(`📡 Stopped periodic map state broadcast for map: ${mapId}`);
    }
}

io.on('connection', (socket) => {
    console.log('Usuário conectado:', socket.id);// Authentication event to associate socket with user session
    socket.on('authenticate', (data) => {
        const { login, sessionToken } = data;
        console.log(`=== SOCKET AUTHENTICATION DEBUG ===`);
        console.log(`Timestamp: ${new Date().toISOString()}`);
        console.log(`Authenticating socket ${socket.id} for user ${login}`);
        console.log(`Session token provided: ${!!sessionToken}`);
        console.log(`Active sessions count: ${activeSessions.size}`);
        
        // Verify session token
        const users = readUsers();
        console.log(`Total users in system: ${users.length}`);
        
        const user = users.find(u => u.login === login && u.sessionToken === sessionToken);
        console.log(`User found in database: ${!!user}`);
        
        if (user) {
            console.log(`Authentication successful for ${login}`);
            console.log(`User session token matches: ${user.sessionToken === sessionToken}`);
            
            // Check if user already has an active session
            if (activeSessions.has(login)) {
                const existingSession = activeSessions.get(login);
                const oldSocketId = existingSession.socketId;
                
                // Only disconnect if there's actually a different existing socket connection
                if (oldSocketId && oldSocketId !== socket.id) {
                    console.log(`Disconnecting previous session for ${login} on socket ${oldSocketId}`);
                    
                    // Clean up old player data first
                    if (players[oldSocketId]) {
                        const oldPlayer = players[oldSocketId];
                        if (maps[oldPlayer.mapId]) {
                            maps[oldPlayer.mapId].players.delete(oldSocketId);
                            io.to(oldPlayer.mapId).emit('playerLeft', { playerId: oldPlayer.id, mapId: oldPlayer.mapId });
                        }
                        delete players[oldSocketId];
                    }
                    
                    // Disconnect old socket
                    const oldSocket = io.sockets.sockets.get(oldSocketId);
                    if (oldSocket) {
                        oldSocket.emit('sessionInvalidated', { message: 'Sua sessão foi invalidada por um novo login.' });
                        oldSocket.disconnect(true);
                    }
                } else if (!oldSocketId) {
                    console.log(`Updating pending session for ${login} with socket ID ${socket.id}`);
                } else {
                    console.log(`Same socket ID ${socket.id} attempting to re-authenticate for ${login}`);
                }
            }
              // Register or update active session with socket ID
            activeSessions.set(login, { socketId: socket.id, sessionToken: sessionToken });
            
            // Store user login for this socket for cleanup purposes
            socket.userLogin = login;
              // Initialize player statistics - NO AUTO-SAVE
            initializePlayerStats(login);
            // AUTO-SAVE COMPLETELY DISABLED - Only save after combat victory
            
            console.log(`Session registered: ${login} -> ${socket.id}`);
            console.log(`Total active sessions: ${activeSessions.size}`);
            console.log(`=== END SOCKET AUTHENTICATION DEBUG ===`);
              socket.emit('authenticationSuccess', { message: 'Autenticação bem-sucedida' });        } else {
            console.log(`Authentication failed for ${login}`);
            console.log(`Token mismatch details:`);
            
            // Find user by login to check token mismatch
            const userByLogin = users.find(u => u.login === login);
            if (userByLogin) {
                console.log(`User exists but token mismatch`);
                console.log(`Expected token: ${userByLogin.sessionToken ? userByLogin.sessionToken.substring(0, 8) + '...' : 'none'}`);
                console.log(`Provided token: ${sessionToken ? sessionToken.substring(0, 8) + '...' : 'none'}`);
                
                // IMPROVED: Don't immediately disconnect, suggest session cleanup
                socket.emit('authenticationFailed', { 
                    message: 'Token de sessão inválido. Tente fazer logout e login novamente.',
                    code: 'TOKEN_MISMATCH',
                    userExists: true,
                    login: login
                });
            } else {
                console.log(`User ${login} not found in database`);
                socket.emit('authenticationFailed', { 
                    message: 'Usuário não encontrado. Tente criar uma nova conta.',
                    code: 'USER_NOT_FOUND',
                    userExists: false,
                    login: login
                });
            }
            
            console.log(`=== END SOCKET AUTHENTICATION DEBUG ===`);
            // Don't disconnect immediately - let client handle the error
        }
    });

    socket.on('joinMap', (data) => {
        const { mapId, playerId, x, y, name, color } = data;
        if (!mapId || !playerId || !maps[mapId]) {
            console.warn(`Tentativa de joinMap inválida: mapId=${mapId}, playerId=${playerId}`);
            return;
        }        // Leave previous room if any and trigger map change save
        let oldMapId = null;
        if (players[socket.id] && players[socket.id].mapId && players[socket.id].mapId !== mapId) {
            oldMapId = players[socket.id].mapId;
            socket.leave(oldMapId);
            if (maps[oldMapId]) {
                maps[oldMapId].players.delete(socket.id);
                socket.to(oldMapId).emit('playerLeft', { playerId: players[socket.id].id, mapId: oldMapId });
            }
        }
        
        socket.join(mapId);
        
        players[socket.id] = {
            id: playerId, socketId: socket.id, name: name, mapId: mapId,
            x: x, y: y, color: color || '#00ff00'
        };
        maps[mapId].players.add(socket.id);        // NO AUTO-SAVE for map change - simplified system
        console.log(`[MAP CHANGE] ${socket.userLogin} moved to ${mapId} (NO AUTO-SAVE)`);
        // Only save after combat victory

        const playersInMap = [];
        maps[mapId].players.forEach(playerSocketId => {
            if (players[playerSocketId]) {
                playersInMap.push({
                    playerId: players[playerSocketId].id,
                    x: players[playerSocketId].x, y: players[playerSocketId].y,
                    name: players[playerSocketId].name, color: players[playerSocketId].color,
                    mapId: players[playerSocketId].mapId
                });
            }
        });        socket.emit('mapState', {
            mapId: mapId,
            players: playersInMap,
            mapLayoutData: maps[mapId].mapLayoutData, // Envia o layout do mapa do servidor
            enemies: maps[mapId].enemies.map(e => ({ // Envia estado atual dos inimigos
                id: e.id,
                overworldX: e.overworldX, overworldY: e.overworldY,
                isAliveOverworld: e.isAliveOverworld,
                hp: e.hp, // Enviar HP atual para o cliente
                combatStats: e.combatStats,
                aggroRange: e.aggroRange,
                inCombat: e.inCombat,
                combatPlayerId: e.combatPlayerId
            }))
        });socket.to(mapId).emit('playerJoined', {
            playerId: playerId, x: x, y: y, name: name, color: players[socket.id].color, mapId: mapId
        });
          // Start monster AI if this is the first player in the map
        if (maps[mapId].players.size === 1) {
            startMapMonsterAI(mapId);
            startMapStateBroadcast(mapId);
        }
        
        console.log(`${name} (${playerId}) entrou no mapa ${mapId}`);
    });    socket.on('leaveMap', (data) => {
        const { playerId, mapId } = data;
        if (players[socket.id] && maps[mapId] && players[socket.id].mapId === mapId) {
            socket.leave(mapId);
            maps[mapId].players.delete(socket.id);
            socket.to(mapId).emit('playerLeft', { playerId: playerId, mapId: mapId });
              // Stop monster AI if no players left in the map
            if (maps[mapId].players.size === 0) {
                stopMapMonsterAI(mapId);
                stopMapStateBroadcast(mapId);
            }
            
            // console.log(`${players[socket.id]?.name} saiu do mapa ${mapId}`);
            // Não deleta players[socket.id] aqui, pois o jogador pode estar apenas mudando de mapa
        }
    });

    socket.on('playerMoved', (data) => {
        const { playerId, mapId, x, y } = data;
        if (players[socket.id] && players[socket.id].mapId === mapId) {
            players[socket.id].x = x;
            players[socket.id].y = y;
            socket.to(mapId).emit('playerMoved', { playerId, mapId, x, y });
        }
    });    socket.on('chatMessage', (data) => {
        const { senderId, senderName, message, mapId } = data;
        console.log(`[DEBUG] Received chatMessage: ${message} from ${senderName} on map ${mapId}`);

        if (players[socket.id] && players[socket.id].mapId === mapId) {
            io.to(mapId).emit('chatMessage', { senderId, senderName, message });
            console.log(`[DEBUG] Emitted chatMessage to map ${mapId}`);

            // Check if the message is a PvP challenge
            if (message.toLowerCase().startsWith('/challenge ')) {
                const targetName = message.substring('/challenge '.length).trim();
                const targetPlayer = Object.values(players).find(p => p.name === targetName && p.mapId === mapId);
                
                if (targetPlayer && targetPlayer.id !== senderId) {
                    console.log(`[PvP] ${senderName} challenged ${targetName} to combat`);
                    
                    // Send challenge notification to target player
                    io.to(targetPlayer.socketId).emit('pvpChallenge', {
                        challengerId: senderId,
                        challengerName: senderName,
                        message: `${senderName} te desafiou para um duelo! Digite '/accept ${senderName}' para aceitar ou '/decline ${senderName}' para recusar.`
                    });
                    
                    // Notify challenger
                    io.to(socket.id).emit('chatMessage', {
                        senderId: 'system',
                        senderName: 'Sistema',
                        message: `Desafio enviado para ${targetName}. Aguardando resposta...`
                    });
                } else if (!targetPlayer) {
                    io.to(socket.id).emit('chatMessage', {
                        senderId: 'system',
                        senderName: 'Sistema', 
                        message: `Jogador '${targetName}' não encontrado neste mapa.`
                    });
                } else {
                    io.to(socket.id).emit('chatMessage', {
                        senderId: 'system',
                        senderName: 'Sistema',
                        message: 'Você não pode se desafiar!'
                    });
                }
            }
            // Handle challenge acceptance
            else if (message.toLowerCase().startsWith('/accept ')) {
                const challengerName = message.substring('/accept '.length).trim();
                const challengerPlayer = Object.values(players).find(p => p.name === challengerName && p.mapId === mapId);
                
                if (challengerPlayer && challengerPlayer.id !== senderId) {
                    console.log(`[PvP] ${senderName} accepted challenge from ${challengerName}`);
                    initiatePvPCombat(challengerPlayer, players[socket.id], mapId);
                } else {
                    io.to(socket.id).emit('chatMessage', {
                        senderId: 'system',
                        senderName: 'Sistema',
                        message: `Desafiante '${challengerName}' não encontrado.`
                    });
                }
            }
            // Handle challenge decline
            else if (message.toLowerCase().startsWith('/decline ')) {
                const challengerName = message.substring('/decline '.length).trim();
                const challengerPlayer = Object.values(players).find(p => p.name === challengerName && p.mapId === mapId);
                
                if (challengerPlayer) {
                    io.to(challengerPlayer.socketId).emit('chatMessage', {
                        senderId: 'system',
                        senderName: 'Sistema',
                        message: `${senderName} recusou seu desafio.`
                    });
                    
                    io.to(socket.id).emit('chatMessage', {
                        senderId: 'system',
                        senderName: 'Sistema',
                        message: `Você recusou o desafio de ${challengerName}.`
                    });
                }
            }
        }
    });    socket.on('enemyDefeated', (data) => { 
        const { enemyId, mapId, playerData } = data;
        if (maps[mapId] && maps[mapId].enemies) {
            const enemy = maps[mapId].enemies.find(e => e.id === enemyId);
            if (enemy && enemy.isAliveOverworld) {
                enemy.isAliveOverworld = false;
                enemy.hp = 0;
                console.log(`Inimigo ${enemyId} (${enemy.combatStats.name}) no mapa ${mapId} derrotado. Iniciando timer de respawn.`);
                
                // Broadcast enemy defeat to all other players in the map
                socket.to(mapId).emit('enemyDefeated', { enemyId, mapId });
                
                // Trigger auto-save for combat victory
                if (socket.userLogin && AUTO_SAVE_CONFIG.triggers.combatVictory) {
                    const stats = playerStats[socket.userLogin];
                    if (stats) {
                        stats.combat.battlesWon++;
                        stats.combat.enemiesDefeated++;
                        stats.combat.totalDamageDealt += playerData?.damageDealt || 0;
                    }
                    
                    savePlayerProgress(socket.userLogin, playerData || {}, 'combatVictory');
                }
                
                if (enemy.respawnTimer) clearTimeout(enemy.respawnTimer);
                
                enemy.respawnTimer = setTimeout(() => {
                    enemy.isAliveOverworld = true;
                    enemy.hp = enemy.combatStats.maxHp; 
                    enemy.overworldX = enemy.originalOverworldX; 
                    enemy.overworldY = enemy.originalOverworldY;
                    
                    io.to(mapId).emit('enemyRespawned', {
                        id: enemy.id,
                        mapId: mapId,
                        overworldX: enemy.overworldX,
                        overworldY: enemy.overworldY,
                        isAliveOverworld: true,
                        hp: enemy.hp,
                        combatStats: enemy.combatStats, 
                        aggroRange: enemy.aggroRange
                    });
                    console.log(`Inimigo ${enemyId} (${enemy.combatStats.name}) no mapa ${mapId} reapareceu.`);
                    enemy.respawnTimer = null;
                }, ENEMY_RESPAWN_TIME);
            }
        }    });

    // Handle enemy combat start
    socket.on('enemyCombatStarted', (data) => {
        const { enemyId, mapId, playerId } = data;
        if (maps[mapId] && maps[mapId].enemies) {
            const enemy = maps[mapId].enemies.find(e => e.id === enemyId);
            if (enemy && enemy.isAliveOverworld && !enemy.inCombat) {
                enemy.inCombat = true;
                enemy.combatPlayerId = playerId;
                
                console.log(`Inimigo ${enemyId} (${enemy.combatStats.name}) entrou em combate com jogador ${playerId}`);
                
                // Broadcast enemy combat status to all players in the map
                io.to(mapId).emit('enemyCombatStatusChanged', {
                    enemyId: enemyId,
                    inCombat: true,
                    combatPlayerId: playerId
                });
            }
        }
    });

    // Handle enemy combat end
    socket.on('enemyCombatEnded', (data) => {
        const { enemyId, mapId, victory } = data;
        if (maps[mapId] && maps[mapId].enemies) {
            const enemy = maps[mapId].enemies.find(e => e.id === enemyId);
            if (enemy && enemy.inCombat) {
                enemy.inCombat = false;
                enemy.combatPlayerId = null;
                
                console.log(`Inimigo ${enemyId} (${enemy.combatStats.name}) saiu de combate. Vitória: ${victory}`);
                
                // Broadcast enemy combat status to all players in the map
                io.to(mapId).emit('enemyCombatStatusChanged', {
                    enemyId: enemyId,
                    inCombat: false,
                    combatPlayerId: null
                });
            }
        }
    });

    socket.on('playerDisconnecting', () => {
        handleDisconnect(socket);
    });

    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });    function handleDisconnect(socketInstance) {
        console.log(`=== DISCONNECT HANDLER DEBUG ===`);
        console.log(`Socket ${socketInstance.id} disconnecting...`);
        
        const player = players[socketInstance.id];
        if (player) {
            console.log(`Player found: ${player.name} (${player.id}) disconnecting from map ${player.mapId}`);
            
            // Remove from map
            if (maps[player.mapId]) {
                maps[player.mapId].players.delete(socketInstance.id);
                socketInstance.to(player.mapId).emit('playerLeft', { playerId: player.id, mapId: player.mapId });
                console.log(`Removed player from map ${player.mapId}`);
                  // Stop monster AI if no players left in the map
                if (maps[player.mapId].players.size === 0) {
                    stopMapMonsterAI(player.mapId);
                    stopMapStateBroadcast(player.mapId);
                }
            }
              // Reset enemy combat state if this player was in combat
            if (maps[player.mapId] && maps[player.mapId].enemies) {
                maps[player.mapId].enemies.forEach(enemy => {
                    if (enemy.inCombat && enemy.combatPlayerId === player.id) {
                        enemy.inCombat = false;
                        enemy.combatPlayerId = null;
                        console.log(`Reset combat state for enemy ${enemy.id} (${enemy.combatStats.name}) after player ${player.name} disconnected`);
                        
                        // Broadcast enemy combat status change to remaining players in the map
                        socketInstance.to(player.mapId).emit('enemyCombatStatusChanged', {
                            enemyId: enemy.id,
                            inCombat: false,
                            combatPlayerId: null
                        });
                    }
                });
            }
            
            // Remove player data
            delete players[socketInstance.id];
            console.log(`Removed player data for socket ${socketInstance.id}`);
        }
          // Clean up session data - check both by socket ID and userLogin property
        let sessionRemoved = false;
        let userLogin = null;
        
        // First try to remove by userLogin property if available
        if (socketInstance.userLogin && activeSessions.has(socketInstance.userLogin)) {
            const session = activeSessions.get(socketInstance.userLogin);
            if (session.socketId === socketInstance.id) {
                userLogin = socketInstance.userLogin;
                activeSessions.delete(socketInstance.userLogin);
                console.log(`Removed active session for user ${socketInstance.userLogin} via userLogin property`);
                sessionRemoved = true;
            }
        }
        
        // If not removed yet, search through all sessions by socket ID
        if (!sessionRemoved) {
            for (const [login, session] of activeSessions.entries()) {
                if (session.socketId === socketInstance.id) {
                    userLogin = login;
                    activeSessions.delete(login);
                    console.log(`Removed active session for user ${login} via socket ID search`);
                    sessionRemoved = true;
                    break;
                }
            }        }
        
        // NO AUTO-SAVE TRIGGERS - Only manual combat victory saves
        if (userLogin) {
            console.log(`[DISCONNECT] User ${userLogin} disconnecting - NO AUTO-SAVE (simplified system)`);
            // No final save - only save after combat victory
        }
        
        if (!sessionRemoved) {
            console.log(`No active session found for socket ${socketInstance.id}`);
        }
        
        console.log(`Remaining active sessions: ${activeSessions.size}`);
        console.log(`=== END DISCONNECT HANDLER DEBUG ===`);
    }

    // PvP Combat Initiation Function
    function initiatePvPCombat(challenger, challenged, mapId) {
        const combatId = `pvp_${challenger.id}_vs_${challenged.id}_${Date.now()}`;
        
        console.log(`[PvP] Initiating combat: ${challenger.name} vs ${challenged.name}`);
        
        // Notify both players that combat is starting
        io.to(challenger.socketId).emit('pvpCombatStarted', {
            combatId,
            opponent: {
                id: challenged.id,
                name: challenged.name,
                x: challenged.x,
                y: challenged.y,
                color: challenged.color
            },
            role: 'challenger'
        });
        
        io.to(challenged.socketId).emit('pvpCombatStarted', {
            combatId,
            opponent: {
                id: challenger.id,
                name: challenger.name,
                x: challenger.x,
                y: challenger.y,
                color: challenger.color
            },
            role: 'challenged'
        });
        
        // Notify other players in the map
        Object.values(players).forEach(player => {
            if (player.mapId === mapId && player.id !== challenger.id && player.id !== challenged.id) {
                io.to(player.socketId).emit('chatMessage', {
                    senderId: 'system',
                    senderName: 'Sistema',
                    message: `⚔️ ${challenger.name} está duelando com ${challenged.name}!`
                });
            }
        });
    }// Server-side mobs data - tutorial maps removed
    const mobs = {
        // Only open world enemies handled by client generation
    };    // Handle client request for mobs data
    socket.on('requestMobs', (mapId) => {
        if (mobs[mapId]) {
            socket.emit('mobsData', mobs[mapId]);
        }
    });

    // PvP Challenge System
    socket.on('challengePlayer', (data) => {
        const { challengedId, mapId } = data;
        const challenger = players[socket.id];
        const challenged = Object.values(players).find(p => p.id === challengedId);
        
        if (challenger && challenged && challenger.mapId === mapId && challenged.mapId === mapId) {
            console.log(`[PvP] ${challenger.name} is challenging ${challenged.name} to a duel`);
            
            // Send challenge to the challenged player
            io.to(challenged.socketId).emit('pvpChallengeReceived', {
                challengerId: challenger.id,
                challengerName: challenger.name,
                mapId: mapId
            });
            
            // Confirm to challenger
            socket.emit('challengeSent', {
                challengedName: challenged.name
            });
        }
    });

    socket.on('acceptChallenge', (data) => {
        const { challengerId, mapId } = data;
        const challenged = players[socket.id];
        const challenger = Object.values(players).find(p => p.id === challengerId);
        
        if (challenger && challenged && challenger.mapId === mapId && challenged.mapId === mapId) {
            const combatId = `pvp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            console.log(`[PvP] Combat accepted: ${challenger.name} vs ${challenged.name} (Combat ID: ${combatId})`);
            
            // Start PvP combat for both players
            io.to(challenger.socketId).emit('pvpCombatStarted', {
                combatId,
                opponent: {
                    id: challenged.id,
                    name: challenged.name,
                    x: challenged.x,
                    y: challenged.y,
                    color: challenged.color
                },
                role: 'challenger',
                startingTurn: 'challenger'
            });
            
            io.to(challenged.socketId).emit('pvpCombatStarted', {
                combatId,
                opponent: {
                    id: challenger.id,
                    name: challenger.name,
                    x: challenger.x,
                    y: challenger.y,
                    color: challenger.color
                },
                role: 'challenged',
                startingTurn: 'challenger'
            });
            
            // Notify other players in the map
            Object.values(players).forEach(player => {
                if (player.mapId === mapId && player.id !== challenger.id && player.id !== challenged.id) {
                    io.to(player.socketId).emit('chatMessage', {
                        senderId: 'system',
                        senderName: 'Sistema',
                        message: `⚔️ ${challenger.name} está duelando com ${challenged.name}!`
                    });
                }
            });
        }
    });

    socket.on('declineChallenge', (data) => {
        const { challengerId } = data;
        const challenger = Object.values(players).find(p => p.id === challengerId);
        
        if (challenger) {
            io.to(challenger.socketId).emit('challengeDeclined', {
                challengedName: players[socket.id]?.name || 'Jogador'
            });
        }
    });

    // PvP Combat Actions
    socket.on('pvpAction', (data) => {
        const { combatId, action, targetId, mapId } = data;
        console.log(`[PvP] Action received: ${action} from ${players[socket.id]?.name} targeting ${targetId}`);
        
        if (players[socket.id] && players[socket.id].mapId === mapId) {
            // Broadcast the action to all players in the combat
            io.to(mapId).emit('pvpActionResult', {
                combatId,
                playerId: players[socket.id].id,
                playerName: players[socket.id].name,
                action,
                targetId
            });
        }
    });

    // PvP Combat End
    socket.on('pvpCombatEnd', (data) => {
        const { winnerId, loserId, mapId } = data;
        console.log(`[PvP] Combat ended: Winner=${winnerId}, Loser=${loserId}`);
        
        if (maps[mapId]) {
            io.to(mapId).emit('pvpCombatResult', {
                winnerId,
                loserId,
                message: `${players[winnerId]?.name || winnerId} venceu o duelo contra ${players[loserId]?.name || loserId}!`
            });
        }    });    // Level Up - DISABLED: Only save after combat victory
    socket.on('levelUp', (data) => {
        const { newLevel, experience, skillPoints, playerData } = data;
        if (socket.userLogin) {
            console.log(`🎉 Level up event for ${socket.userLogin} - Level ${newLevel} (NO AUTO-SAVE)`);
            // NO SAVE: Simplified system only saves after combat victory
        }
    });    socket.on('itemAcquired', (data) => {
        const { itemId, itemType, quantity, playerData } = data;
        if (socket.userLogin) {
            console.log(`💎 Item acquired event for ${socket.userLogin} - ${itemId} (NO AUTO-SAVE)`);
            // NO SAVE: Simplified system only saves after combat victory
        }
    });    socket.on('significantProgress', (data) => {
        const { progressType, value, playerData } = data;
        if (socket.userLogin) {
            console.log(`⭐ Significant progress event for ${socket.userLogin} - ${progressType} (NO AUTO-SAVE)`);
            // NO SAVE: Simplified system only saves after combat victory
        }
    });    socket.on('updatePlayerData', (data) => {
        const { playerData, triggerType = 'manual' } = data;
        if (socket.userLogin) {
            console.log(`📊 Player data update event for ${socket.userLogin} - ${triggerType} (NO AUTO-SAVE)`);
            // NO SAVE: Simplified system only saves after combat victory
        }
    });

    socket.on('requestPlayerStats', () => {
        if (socket.userLogin) {
            const stats = playerStats[socket.userLogin];
            if (stats) {
                const serializedStats = {
                    ...stats,
                    exploration: {
                        ...stats.exploration,
                        mapsVisited: Array.from(stats.exploration.mapsVisited),
                    },
                    achievements: {
                        ...stats.achievements,
                        firstTimeAchievements: Array.from(stats.achievements.firstTimeAchievements)
                    }
                };
                socket.emit('playerStatsUpdate', serializedStats);
            }
        }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Add a health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Check if the port is already in use and handle EADDRINUSE error
server.listen(PORT, () => {
    console.log(`Servidor MMORPG rodando na porta ${PORT}`);
    console.log(`Acesse o jogo em http://localhost:${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Erro: A porta ${PORT} já está em uso. Tentando outra porta...`);
        server.listen(0, () => {
            const newPort = server.address().port;
            console.log(`Servidor agora rodando na porta ${newPort}`);
            console.log(`Acesse o jogo em http://localhost:${newPort}`);
        });
    } else {        console.error('Erro ao iniciar o servidor:', err);
    }
});

