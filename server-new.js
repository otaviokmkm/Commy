// server.js - Refactored and Modular Game Server
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

// Import modular components
const { initializeDatabase, closeDatabase } = require('./server/database/database');
const { router: apiRoutes, activeSessions } = require('./server/routes/apiRoutes');
const { initializeSocketHandlers } = require('./server/socket/socketHandlers');
const MapManager = require('./server/gameLogic/mapManager');
const CombatManager = require('./server/gameLogic/combatManager');

// Initialize Express and Socket.IO
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Game state
const players = {}; // { socketId: { id, name, mapId, x, y, color, ... } }
let mapManager;
let combatManager;

/**
 * Initialize server middleware
 */
function setupMiddleware() {    // Body parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Static files with proper MIME types
    app.use(express.static(path.join(__dirname, 'public'), {
        setHeaders: (res, path, stat) => {
            if (path.endsWith('.css')) {
                res.set('Content-Type', 'text/css');
            } else if (path.endsWith('.js')) {
                res.set('Content-Type', 'application/javascript');
            } else if (path.endsWith('.html')) {
                res.set('Content-Type', 'text/html');
            }
        }
    }));
    
    // Security headers
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        next();
    });
    
    // Request logging in development
    if (NODE_ENV === 'development') {
        app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }
    
    console.log('✅ Middleware configured');
}

/**
 * Initialize game managers
 */
function initializeGameManagers() {
    try {
        // Initialize map manager
        mapManager = new MapManager();
        mapManager.initializeMaps();
        
        // Initialize combat manager
        combatManager = new CombatManager();
        
        // Log enemy count for debugging
        const maps = mapManager.getAllMaps();
        console.log('🗺️ Map initialization complete:');
        Object.keys(maps).forEach(mapId => {
            const map = maps[mapId];
            console.log(`  ${mapId}: ${map.enemies?.length || 0} enemies`);
        });
        
        console.log('✅ Game managers initialized');
    } catch (error) {
        console.error('❌ Failed to initialize game managers:', error);
        throw error;
    }
}

/**
 * Setup API routes
 */
function setupRoutes() {
    // API routes
    app.use('/api', apiRoutes);
    
    // Health check endpoint
    app.get('/health', (req, res) => {
        const stats = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            activePlayers: Object.keys(players).length,
            activeSessions: activeSessions.size,
            activeCombats: combatManager ? combatManager.getCombatStats().activeCombats : 0,
            maps: mapManager ? Object.keys(mapManager.getAllMaps()).length : 0
        };
        
        res.json(stats);
    });
    
    // Serve main game page
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
    
    // 404 handler
    app.use('*', (req, res) => {
        res.status(404).json({ 
            error: 'Not Found',
            message: 'The requested resource was not found',
            path: req.originalUrl
        });
    });
    
    // Error handler
    app.use((error, req, res, next) => {
        console.error('Unhandled error:', error);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    });
    
    console.log('✅ Routes configured');
}

/**
 * Initialize socket handling
 */
function initializeSocketIO() {
    try {
        // Pass required objects to socket handlers
        initializeSocketHandlers(io, {
            combatManager,
            mapManager,
            gameData: {
                maps: mapManager.getAllMaps()
            }
        });
        
        console.log('✅ Socket.IO initialized');
    } catch (error) {
        console.error('❌ Failed to initialize Socket.IO:', error);
        throw error;
    }
}

/**
 * Setup graceful shutdown
 */
function setupGracefulShutdown() {
    const shutdown = async (signal) => {
        console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
        
        try {
            // Close HTTP server
            server.close(() => {
                console.log('✅ HTTP server closed');
            });
            
            // Disconnect all sockets
            io.disconnectSockets();
            console.log('✅ All sockets disconnected');
            
            // Close database connections
            await closeDatabase();
            
            console.log('✅ Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
            process.exit(1);
        }
    };
    
    // Listen for termination signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error('💥 Uncaught Exception:', error);
        shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
        shutdown('unhandledRejection');
    });
    
    console.log('✅ Graceful shutdown handlers configured');
}

/**
 * Start the server
 */
async function startServer() {
    try {
        console.log('🚀 Starting MMORPG Server...');
        console.log(`Environment: ${NODE_ENV}`);
        console.log(`Port: ${PORT}`);
        
        // Initialize database
        await initializeDatabase();
        
        // Setup middleware
        setupMiddleware();
        
        // Initialize game managers
        initializeGameManagers();
        
        // Setup routes
        setupRoutes();
        
        // Initialize Socket.IO
        initializeSocketIO();
        
        // Setup graceful shutdown
        setupGracefulShutdown();
        
        // Start listening
        server.listen(PORT, () => {
            console.log('🎮 MMORPG Server started successfully!');
            console.log(`📡 Server listening on port ${PORT}`);
            console.log(`🌐 Game available at: http://localhost:${PORT}`);
            console.log(`💾 Database initialized`);
            console.log(`🗺️  Maps loaded: ${Object.keys(mapManager.getAllMaps()).length}`);
            console.log('✨ Ready for players!');
        });
        
    } catch (error) {
        console.error('💥 Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
if (require.main === module) {
    startServer();
}

// Export for testing
module.exports = {
    app,
    server,
    io,
    players,
    mapManager,
    combatManager,
    activeSessions
};
