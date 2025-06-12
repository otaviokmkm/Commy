// server/socket/socketHandlers.js
const { Server } = require("socket.io");

// Global variables for tracking
let io;
let players = {};
let combatManager;
let mapManager;
let gameData;

/**
 * Initialize socket handlers with required dependencies
 * @param {Server} socketIo - Socket.IO server instance
 * @param {Object} deps - Dependencies (combatManager, mapManager, gameData)
 */
function initializeSocketHandlers(socketIo, deps) {
    io = socketIo;
    combatManager = deps.combatManager;
    mapManager = deps.mapManager;
    gameData = deps.gameData;
    
    io.on('connection', (socket) => {
        console.log(`🔌 New socket connection: ${socket.id}`);
        
        // Setup event handlers for this connection
        setupPlayerHandlers(socket);
        setupCombatHandlers(socket);
        setupPartyHandlers(socket);
        setupChatHandlers(socket);
        setupMapHandlers(socket);
        
        // Handle disconnection
        socket.on('disconnect', () => {
            handleDisconnect(socket);
        });
    });
    
    // Start enemy update interval
    setupEnemyUpdateInterval();
    
    // Debug enemy generation after a short delay
    setTimeout(() => {
        debugEnemyGeneration();
    }, 1000);
    
    console.log('✅ Socket handlers initialized');
}

/**
 * Setup player-related event handlers
 */
function setupPlayerHandlers(socket) {
    socket.on('playerJoin', (data) => {
        console.log(`🔍 [SERVER] playerJoin event received from ${socket.id}:`, data);
        
        // Handle player joining the game
        const { playerId, username, position, mapId } = data;
        
        // Store player data
        players[socket.id] = {
            id: playerId,
            name: username,
            socket: socket,
            x: position?.x || 0,
            y: position?.y || 0,
            mapId: mapId || 'open_world'
        };
        
        console.log(`👤 Player joined: ${username} (${playerId})`);
        
        // Join the appropriate map room
        socket.join(mapId || 'open_world');
        console.log(`🔄 Player ${username} joined map room: ${mapId || 'open_world'}`);
        
        // Notify other players in the same map only
        socket.to(mapId || 'open_world').emit('playerJoined', {
            id: playerId,
            name: username,
            x: players[socket.id].x,
            y: players[socket.id].y,
            mapId: players[socket.id].mapId,
            playerData: {
                name: username,
                x: players[socket.id].x,
                y: players[socket.id].y,
                mapId: players[socket.id].mapId
            }
        });
        
        // Send map data to player
        if (mapManager) {
            const mapData = mapManager.getMapData(mapId || 'open_world');
            console.log(`📡 Map data for ${mapId || 'open_world'}:`, mapData ? 'exists' : 'missing');
            
            socket.emit('mapData', { mapId: mapId || 'open_world', data: mapData });
            
            // Send map enemies to player - FIXED: Send consistent enemy data
            const enemies = mapData?.enemies || [];
            console.log(`📡 Sending ${enemies.length} enemies to player ${username} for map ${mapId || 'open_world'}`);
            
            // Log first few enemies for debugging
            if (enemies.length > 0) {
                console.log(`👹 First enemy sample:`, {
                    id: enemies[0].id,
                    name: enemies[0].name,
                    position: `(${enemies[0].overworldX}, ${enemies[0].overworldY})`,
                    alive: enemies[0].isAliveOverworld
                });
            }
            
            socket.emit('mapEnemies', { 
                mapId: mapId || 'open_world', 
                enemies: enemies 
            });
        } else {
            console.warn('⚠️ MapManager not available when player joined');
        }
    });
    
    socket.on('playerMove', (data) => {
        // Handle player movement
        const { x, y, mapId } = data;
        const player = players[socket.id];
        
        if (player) {
            // Update player position
            player.x = x;
            player.y = y;
            player.mapId = mapId || player.mapId;
            
            // Broadcast movement only to players in the same map
            socket.to(player.mapId).emit('playerMoved', {
                id: player.id,
                x, y, mapId: player.mapId
            });
        }
    });
}

/**
 * Setup map-related event handlers
 */
function setupMapHandlers(socket) {
    console.log(`🔧 Setting up map handlers for socket: ${socket.id}`);
    
    socket.on('joinMap', (data) => {
        console.log(`🗺️ [SERVER] joinMap event received from ${socket.id}:`, data);
        
        const { mapId, playerId, x, y, name, color } = data;
        const player = players[socket.id];
        
        if (!player) {
            console.warn(`⚠️ No player found for socket ${socket.id} in joinMap`);
            return;
        }
        
        console.log(`🗺️ Player ${player.name} is joining map: ${mapId}`);
        
        // Leave any current map room
        if (player.mapId && player.mapId !== mapId) {
            socket.leave(player.mapId);
        }
        
        // Join the new map room
        socket.join(mapId);
        
        // Update player data
        player.mapId = mapId;
        player.x = x || player.x;
        player.y = y || player.y;
        
        // Add player to map in MapManager
        if (mapManager) {
            mapManager.addPlayerToMap(mapId, socket.id);
            
            // Send map data
            const mapData = mapManager.getMapData(mapId);
            console.log(`📡 Map data for ${mapId}:`, mapData ? 'exists' : 'missing');
            
            socket.emit('mapData', { mapId: mapId, data: mapData });
            
            // Send map enemies - FIXED: Always send enemies with debugging
            const enemies = mapData?.enemies || [];
            console.log(`📡 Sending ${enemies.length} enemies to joining player for map ${mapId}`);
            
            // Log enemy sample for debugging
            if (enemies.length > 0) {
                console.log(`👹 Enemy sample:`, {
                    id: enemies[0].id,
                    name: enemies[0].name,
                    position: `(${enemies[0].overworldX}, ${enemies[0].overworldY})`,
                    alive: enemies[0].isAliveOverworld
                });
            } else {
                console.warn(`⚠️ No enemies found for map ${mapId}`);
            }
            
            socket.emit('mapEnemies', { 
                mapId: mapId, 
                enemies: enemies 
            });
        } else {
            console.warn('⚠️ MapManager not available in joinMap handler');
        }
        
        console.log(`✅ Player ${player.name} joined map: ${mapId}`);
    });
}

/**
 * Setup combat-related event handlers
 */
function setupCombatHandlers(socket) {
    // Simplified for now - add combat handlers as needed
}

/**
 * Setup party-related event handlers
 */
function setupPartyHandlers(socket) {
    // Party system handlers would go here
}

/**
 * Setup chat handlers
 */
function setupChatHandlers(socket) {
    socket.on('chatMessage', (data) => {
        const { message, mapId } = data;
        const player = players[socket.id];
        
        if (!player) return;
        
        const chatData = {
            senderId: player.id,
            sender: player.name,
            message,
            timestamp: new Date().toISOString()
        };
        
        // Send message to all players in the same map using the room
        io.to(mapId || player.mapId).emit('chatMessage', chatData);
        console.log(`💬 Chat in ${mapId || player.mapId}: ${player.name}: ${message}`);
    });
}

/**
 * Handle player disconnection
 */
function handleDisconnect(socket) {
    const player = players[socket.id];
    if (player) {
        console.log(`👋 Player disconnected: ${player.name} (${player.id})`);
        io.to(player.mapId).emit('playerLeft', { id: player.id });

        if (mapManager) {
            mapManager.removePlayerFromMap(player.mapId, socket.id);
        }
        delete players[socket.id];
    }
}

/**
 * Setup enemy update interval
 */
function setupEnemyUpdateInterval() {
    // Broadcast enemy data every second to ensure clients are synchronized
    setInterval(() => {
        if (mapManager && mapManager.maps) {
            Object.values(mapManager.maps).forEach(map => {
                if (map.players && map.players.size > 0) {
                    // Get current enemy data
                    const enemies = map.enemies || [];
                    
                    if (enemies.length > 0) {
                        // Broadcast to all players in this map
                        io.to(map.id).emit('enemyUpdate', {
                            mapId: map.id,
                            enemies: enemies
                        });
                        
                        console.log(`🔄 Broadcasting ${enemies.length} enemies to ${map.players.size} players in map ${map.id}`);
                    }
                }
            });
        }
    }, 1000); // Every 1 second
}

/**
 * Debug function to check enemy generation
 */
function debugEnemyGeneration() {
    console.log('🧪 Debug: Checking enemy generation...');
    
    if (mapManager) {
        const openWorldMap = mapManager.getMap('open_world');
        if (openWorldMap) {
            console.log(`📍 Open World Map found:`);
            console.log(`- Size: ${openWorldMap.width}x${openWorldMap.height}`);
            console.log(`- Enemies: ${openWorldMap.enemies.length}`);
            console.log(`- Players: ${openWorldMap.players.size}`);
            
            if (openWorldMap.enemies.length > 0) {
                console.log(`👹 First 3 enemies:`);
                openWorldMap.enemies.slice(0, 3).forEach((enemy, i) => {
                    console.log(`${i + 1}. ${enemy.name} at (${enemy.overworldX}, ${enemy.overworldY}) - HP: ${enemy.hp} - Alive: ${enemy.isAliveOverworld}`);
                });
            } else {
                console.log('❌ No enemies found in open world map!');
            }
            
            // Test getMapData method
            const mapData = mapManager.getMapData('open_world');
            console.log(`📡 getMapData returns ${mapData?.enemies?.length || 0} enemies`);
            
        } else {
            console.log('❌ Open world map not found!');
        }
    } else {
        console.log('❌ MapManager not initialized!');
    }
    
    console.log('🧪 Debug complete.');
}

module.exports = {
    initializeSocketHandlers
};