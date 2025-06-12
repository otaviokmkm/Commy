// server/database/database.js
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');

// Database file paths
const USERS_DB_PATH = path.join(__dirname, '../../data/users.json');
const GAME_DATA_DB_PATH = path.join(__dirname, '../../data/gameData.json');

// Initialize databases
let usersDb;
let gameDataDb;

/**
 * Initialize the database connections
 */
async function initializeDatabase() {
    try {
        // Ensure data directory exists
        const fs = require('fs');
        const dataDir = path.join(__dirname, '../../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Initialize users database
        const usersAdapter = new JSONFile(USERS_DB_PATH);
        usersDb = new Low(usersAdapter, { users: [] });
        await usersDb.read();

        // Initialize game data database
        const gameDataAdapter = new JSONFile(GAME_DATA_DB_PATH);
        gameDataDb = new Low(gameDataAdapter, { 
            maps: {},
            globalStats: {
                totalUsers: 0,
                activeUsers: 0,
                lastReset: new Date().toISOString()
            }
        });
        await gameDataDb.read();

        console.log('✅ Database initialized successfully');
        
        // Migrate existing users.json if it exists
        await migrateExistingUsers();
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
}

/**
 * Migrate existing users.json to new database format
 */
async function migrateExistingUsers() {
    try {
        const fs = require('fs');
        const oldUsersFile = path.join(__dirname, '../../users.json');
        
        if (fs.existsSync(oldUsersFile) && usersDb.data.users.length === 0) {
            console.log('🔄 Migrating existing users...');
            
            const oldUsers = JSON.parse(fs.readFileSync(oldUsersFile, 'utf8'));
            
            for (const user of oldUsers) {
                if (user.login) {
                    // Note: Old passwords are plaintext, they'll need to be re-hashed on next login
                    user.needsPasswordRehash = true;
                    user.migratedAt = new Date().toISOString();
                    usersDb.data.users.push(user);
                }
            }
            
            await usersDb.write();
            console.log(`✅ Migrated ${oldUsers.length} users to new database`);
            
            // Backup old file
            fs.renameSync(oldUsersFile, oldUsersFile + '.backup');
        }
    } catch (error) {
        console.error('⚠️  User migration failed (continuing anyway):', error);
    }
}

/**
 * Get user by login
 * @param {string} login - Username
 * @returns {Promise<Object|null>} - User object or null
 */
async function getUserByLogin(login) {
    try {
        await usersDb.read();
        return usersDb.data.users.find(user => user.login === login) || null;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}

/**
 * Create a new user
 * @param {Object} userData - User data object
 * @returns {Promise<boolean>} - True if successful
 */
async function createUser(userData) {
    try {
        await usersDb.read();
        usersDb.data.users.push(userData);
        await usersDb.write();
        
        // Update global stats
        await updateGlobalStats({ totalUsers: usersDb.data.users.length });
        
        return true;
    } catch (error) {
        console.error('Error creating user:', error);
        return false;
    }
}

/**
 * Update user data
 * @param {string} login - Username
 * @param {Object} updates - Fields to update
 * @returns {Promise<boolean>} - True if successful
 */
async function updateUser(login, updates) {
    try {
        await usersDb.read();
        const userIndex = usersDb.data.users.findIndex(user => user.login === login);
        
        if (userIndex === -1) {
            return false;
        }
        
        // Merge updates
        Object.assign(usersDb.data.users[userIndex], updates);
        await usersDb.write();
        
        return true;
    } catch (error) {
        console.error('Error updating user:', error);
        return false;
    }
}

/**
 * Delete a user
 * @param {string} login - Username
 * @returns {Promise<boolean>} - True if successful
 */
async function deleteUser(login) {
    try {
        await usersDb.read();
        const initialLength = usersDb.data.users.length;
        usersDb.data.users = usersDb.data.users.filter(user => user.login !== login);
        
        if (usersDb.data.users.length < initialLength) {
            await usersDb.write();
            await updateGlobalStats({ totalUsers: usersDb.data.users.length });
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error deleting user:', error);
        return false;
    }
}

/**
 * Save player progress
 * @param {string} login - Username
 * @param {Object} progress - Progress data
 * @param {string} triggerType - What triggered the save
 * @returns {Promise<boolean>} - True if successful
 */
async function savePlayerProgress(login, progress, triggerType = 'manual') {
    try {
        const updates = {
            progress,
            lastSave: new Date().toISOString(),
            lastSaveTrigger: triggerType
        };
        
        const success = await updateUser(login, updates);
        
        if (success) {
            console.log(`✅ Progress saved for ${login} (${triggerType})`);
        } else {
            console.error(`❌ Failed to save progress for ${login}`);
        }
        
        return success;
    } catch (error) {
        console.error('Error saving player progress:', error);
        return false;
    }
}

/**
 * Get all users (for admin purposes)
 * @returns {Promise<Array>} - Array of users (without passwords)
 */
async function getAllUsers() {
    try {
        await usersDb.read();
        return usersDb.data.users.map(user => ({
            login: user.login,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            lastSave: user.lastSave
        }));
    } catch (error) {
        console.error('Error getting all users:', error);
        return [];
    }
}

/**
 * Update global game statistics
 * @param {Object} stats - Stats to update
 * @returns {Promise<boolean>} - True if successful
 */
async function updateGlobalStats(stats) {
    try {
        await gameDataDb.read();
        Object.assign(gameDataDb.data.globalStats, stats, {
            lastUpdated: new Date().toISOString()
        });
        await gameDataDb.write();
        return true;
    } catch (error) {
        console.error('Error updating global stats:', error);
        return false;
    }
}

/**
 * Get global game statistics
 * @returns {Promise<Object>} - Global stats object
 */
async function getGlobalStats() {
    try {
        await gameDataDb.read();
        return gameDataDb.data.globalStats;
    } catch (error) {
        console.error('Error getting global stats:', error);
        return {};
    }
}

/**
 * Initialize player statistics
 * @param {string} login - User login
 * @returns {Object} - Player statistics object
 */
function initializePlayerStats(login) {
    return {
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
            mapsVisited: [],
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
            unlockedAchievements: [],
            totalPoints: 0
        }
    };
}

/**
 * Get player progress and statistics
 * @param {string} login - User login
 * @returns {Promise<Object>} - Player data object
 */
async function getPlayerData(login) {
    try {
        const user = await getUserByLogin(login);
        if (!user) {
            return { error: 'User not found' };
        }

        const progress = user.progress || {};
        const statistics = initializePlayerStats(login);

        return {
            progress,
            statistics,
            message: 'Player data loaded successfully'
        };
    } catch (error) {
        console.error('Error getting player data:', error);
        return { error: 'Failed to load player data' };
    }
}

/**
 * Cleanup function to close database connections
 */
async function closeDatabase() {
    try {
        // lowdb doesn't require explicit closing, but we can ensure final writes
        if (usersDb) await usersDb.write();
        if (gameDataDb) await gameDataDb.write();
        console.log('✅ Database connections closed');
    } catch (error) {
        console.error('Error closing database:', error);
    }
}

module.exports = {
    initializeDatabase,
    getUserByLogin,
    createUser,
    updateUser,
    deleteUser,
    savePlayerProgress,
    getAllUsers,
    updateGlobalStats,
    getGlobalStats,
    initializePlayerStats,
    getPlayerData,
    closeDatabase
};
