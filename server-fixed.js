// Clean working MMORPG server - fixed version
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const TacticalCombat = require('./TacticalCombat');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Game state
const WORLD_SIZE = 200;
const players = new Map();
const enemies = new Map();
const mapTiles = new Map();

// Initialize tactical combat system
const combatSystem = new TacticalCombat(io, players, enemies);

console.log('🚀 Starting MMORPG Server with Tactical Combat...');

// Initialize map and enemies
function initializeWorld() {
    console.log('🌍 Initializing world...');
    
    // Define starting village area
    const VILLAGE_CENTER_X = 100;
    const VILLAGE_CENTER_Y = 100;
    const VILLAGE_SIZE = 10;
    
    // Generate map tiles
    for (let y = 0; y < WORLD_SIZE; y++) {
        for (let x = 0; x < WORLD_SIZE; x++) {
            const key = `${x},${y}`;
            let tileType = 0; // grass
            
            // Check if we're in the starting village area
            const distanceFromVillage = Math.abs(x - VILLAGE_CENTER_X) + Math.abs(y - VILLAGE_CENTER_Y);
            
            if (distanceFromVillage <= VILLAGE_SIZE) {
                // Village area - keep it clear of obstacles
                tileType = 0; // grass only
                
                // Add some village structures
                if (distanceFromVillage === VILLAGE_SIZE && Math.random() < 0.3) {
                    tileType = 3; // village structure
                }
            } else {
                // Outside village - normal terrain generation
                if ((x + y) % 15 === 0) tileType = 1; // rock
                if ((x * y) % 23 === 0 && tileType === 0) tileType = 2; // tree
            }
            
            mapTiles.set(key, {
                x, y, type: tileType
            });
        }
    }
    
    // Generate enemies - FIXED: Using the format your client expects
    // Don't spawn enemies too close to the starting village
    for (let i = 0; i < 50; i++) {
        let x, y;
        let attempts = 0;
        do {
            x = Math.floor(Math.random() * (WORLD_SIZE - 20)) + 10;
            y = Math.floor(Math.random() * (WORLD_SIZE - 20)) + 10;
            attempts++;
        } while (attempts < 20 && (Math.abs(x - VILLAGE_CENTER_X) + Math.abs(y - VILLAGE_CENTER_Y)) < VILLAGE_SIZE + 5);
        
        // Make sure enemy is not on a rock or village structure
        const tileKey = `${x},${y}`;
        const tile = mapTiles.get(tileKey);
        if (tile && (tile.type === 1 || tile.type === 3)) continue; // skip rocks and village structures
          enemies.set(i, {
            id: i,
            name: `Goblin ${i + 1}`,
            overworldX: x,  // Use overworldX format your client expects
            overworldY: y,  // Use overworldY format your client expects
            hp: 50,
            maxHp: 50,
            level: Math.floor(Math.random() * 15) + 1, // Level 1-15
            isAliveOverworld: true,  // Use isAliveOverworld format
            lastMove: Date.now(),
            aiState: 'roaming', // 'roaming', 'hunting', 'fleeing'
            target: null,            lastAIAction: Date.now()
        });
    }
    
    console.log(`✅ World initialized: ${mapTiles.size} tiles, ${enemies.size} enemies`);
}

// Helper functions
function isValidPosition(x, y) {
    if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE) return false;
    
    const tile = mapTiles.get(`${x},${y}`);
    return !tile || tile.type !== 1; // not a rock
}

function getEnemiesArray() {
    return Array.from(enemies.values()).filter(e => e.isAliveOverworld);
}

// Generate map array for client
function generateMapArray() {
    const tiles = [];
    for (let y = 0; y < WORLD_SIZE; y++) {
        const row = [];
        for (let x = 0; x < WORLD_SIZE; x++) {
            const tile = mapTiles.get(`${x},${y}`);
            row.push(tile ? tile.type : 0);
        }
        tiles.push(row);
    }
    return tiles;
}

// Socket handling
io.on('connection', (socket) => {
    console.log(`🔌 Player connected: ${socket.id}`);
      // Handle both playerJoin formats
    socket.on('playerJoin', (data) => {
        console.log(`👤 Player join request:`, data);
        
        const playerName = data.username || data.name || 'Player';
        const x = data.position?.x || 100;
        const y = data.position?.y || 100;        const player = {
            id: socket.id,
            name: playerName,
            x: x,
            y: y,
            hp: 100,
            maxHp: 100,
            level: 1, // Start at level 1
            experience: 0,
            socketId: socket.id,
            class: data.class || 'mage' // Add class selection
        };
        
        players.set(socket.id, player);
        console.log(`👤 ${playerName} joined at (${x}, ${y})`);
        
        // Send complete game state to joining player
        const playersArray = Array.from(players.values());
        const enemyArray = getEnemiesArray();
        
        socket.emit('gameState', {
            player: player,
            players: playersArray,
            enemies: enemyArray,
            mapData: {
                width: WORLD_SIZE,
                height: WORLD_SIZE,
                tiles: generateMapArray()
            }
        });
        
        console.log(`📡 Sent complete game state: ${playersArray.length} players, ${enemyArray.length} enemies`);
        
        // Notify other players about new player
        socket.broadcast.emit('playerJoined', {
            id: socket.id,
            name: playerName,
            x: x,
            y: y
        });
    });
    
    // Handle joinMap
    socket.on('joinMap', (data) => {
        console.log(`🗺️ Join map request:`, data);

        // Send enemies again
        const enemyArray = getEnemiesArray();
        console.log(`📡 Sending ${enemyArray.length} enemies via joinMap`);

        socket.emit('mapEnemies', {
            mapId: data.mapId || 'open_world',
            enemies: enemyArray
        });
    });

    // Player movement
    socket.on('playerMove', (data) => {
        const { x, y } = data;
        const player = players.get(socket.id);
        
        if (!player) return;
        
        // In simultaneous combat, movement is handled by the combat system
        // For overworld movement, proceed normally
        
        if (!isValidPosition(x, y)) {
            socket.emit('moveRejected', { reason: 'Invalid position' });
            return;
        }
        
        // Check for collisions with enemies (start PvE combat)
        let enemyCollision = null;
        enemies.forEach(enemy => {
            if (enemy.isAliveOverworld && enemy.overworldX === x && enemy.overworldY === y) {
                enemyCollision = enemy;
            }
        });
        
        // Check for collisions with other players (start PvP combat)
        let playerCollision = null;
        players.forEach(otherPlayer => {
            if (otherPlayer.id !== socket.id && otherPlayer.x === x && otherPlayer.y === y) {
                playerCollision = otherPlayer;
            }
        });
        
        if (enemyCollision) {
            // Start PvE combat
            const combatId = combatSystem.startCombat(player, enemyCollision, 'pve');
            socket.emit('moveRejected', { 
                reason: 'Enemy encountered!', 
                combat: true,
                combatId: combatId 
            });
            return;
        }
        
        if (playerCollision) {
            // Start PvP combat
            const combatId = combatSystem.startCombat(player, playerCollision, 'pvp');
            socket.emit('moveRejected', { 
                reason: 'Player encountered!', 
                combat: true,
                combatId: combatId 
            });
            return;
        }
        
        // Update position
        player.x = x;
        player.y = y;
        
        // Broadcast to all players including self for sync
        io.emit('playerMoved', {
            id: socket.id,
            name: player.name,
            x: x,
            y: y
        });
        
        console.log(`🚶 ${player.name} moved to (${x}, ${y})`);
    });
    
    // Combat
    socket.on('attackEnemy', (data) => {
        const { enemyId } = data;
        const player = players.get(socket.id);
        const enemy = enemies.get(enemyId);
        if (!player || !enemy || !enemy.isAliveOverworld) return;

        const distance = Math.abs(player.x - enemy.overworldX)
                       + Math.abs(player.y - enemy.overworldY);
        if (distance > 1) {
            socket.emit('attackFailed', { reason: 'Too far away' });
            return;
        }

        enemy.hp -= 25;
        if (enemy.hp <= 0) {
            enemy.isAliveOverworld = false;
            socket.emit('enemyDefeated', { enemyId, xp: 10 });
            io.emit('enemyDied',    { enemyId, enemy });
            console.log(`💀 ${enemy.name} defeated by ${player.name}`);
        } else {
            socket.emit('attackSuccess', { enemyId, damage: 25 });
        }

        io.emit('enemyUpdate', {
            mapId: 'open_world',
            enemies: [enemy]
        });
    });
    
    // Tactical Combat Events
    socket.on('combatMove', (data) => {
        const result = combatSystem.handleCombatMove(socket.id, data.x, data.y);
        socket.emit('combatMoveResult', result);
    });
    
    socket.on('combatAction', (data) => {
        const result = combatSystem.handleCombatAction(socket.id, data);
        socket.emit('combatActionResult', result);
    });

    socket.on('combatSpell', (data) => {
        const result = combatSystem.handleCombatAction(socket.id, {
            type: 'spell',
            spellId: data.spellId,
            targetX: data.targetX,
            targetY: data.targetY,
            cost: 1
        });
        socket.emit('combatSpellResult', result);
    });
    
    socket.on('combatEndTurn', () => {
        const result = combatSystem.endTurn(socket.id);
        socket.emit('combatEndTurnResult', result);
    });
    
    socket.on('combatFlee', () => {
        const result = combatSystem.handleFleeCombat(socket.id);
        socket.emit('combatFleeResult', result);
    });
    
    // Chat
    socket.on('chatMessage', (data) => {
        const { message } = data;
        const player = players.get(socket.id);
        
        if (!player) return;
        
        io.emit('chatMessage', {
            playerName: player.name,
            message: message,
            timestamp: Date.now()
        });
        
            console.log(`💬 ${player.name}: ${message}`);
        });
        
        // Disconnect
        socket.on('disconnect', () => {
            const player = players.get(socket.id);
            if (player) {
                console.log(`👋 ${player.name} disconnected`);
                players.delete(socket.id);
                socket.broadcast.emit('playerLeft', { id: socket.id });
            }
        });
    });

// Enemy AI and synchronization
setInterval(() => {
    const aliveEnemies = getEnemiesArray();
    const updatedEnemies = [];
    
    aliveEnemies.forEach(enemy => {
        // AI decision making every 2 seconds
        if (Date.now() - enemy.lastAIAction > 2000) {
            const nearbyPlayers = Array.from(players.values()).filter(player => {
                const distance = Math.abs(player.x - enemy.overworldX) + Math.abs(player.y - enemy.overworldY);
                return distance <= 8; // Detection range
            });

            if (nearbyPlayers.length > 0) {
                const closestPlayer = nearbyPlayers.reduce((closest, player) => {
                    const distToPlayer = Math.abs(player.x - enemy.overworldX) + Math.abs(player.y - enemy.overworldY);
                    const distToClosest = Math.abs(closest.x - enemy.overworldX) + Math.abs(closest.y - enemy.overworldY);
                    return distToPlayer < distToClosest ? player : closest;
                });

                const levelDifference = closestPlayer.level - enemy.level;
                const distance = Math.abs(closestPlayer.x - enemy.overworldX) + Math.abs(closestPlayer.y - enemy.overworldY);

                // AI Behavior Logic
                if (levelDifference >= 10) {
                    // Player is much stronger, flee!
                    enemy.aiState = 'fleeing';
                    enemy.target = closestPlayer.id;
                    console.log(`🏃 ${enemy.name} (Lv.${enemy.level}) fleeing from ${closestPlayer.name} (Lv.${closestPlayer.level})`);
                } else if (distance <= 5) {
                    // Player is close and not too strong, hunt them!
                    enemy.aiState = 'hunting';
                    enemy.target = closestPlayer.id;
                    console.log(`🎯 ${enemy.name} (Lv.${enemy.level}) hunting ${closestPlayer.name} (Lv.${closestPlayer.level})`);
                } else {
                    // Continue roaming
                    enemy.aiState = 'roaming';
                    enemy.target = null;
                }
            } else {
                // No players nearby, roam
                enemy.aiState = 'roaming';
                enemy.target = null;
            }

            enemy.lastAIAction = Date.now();
        }

        // Movement logic based on AI state
        if (Date.now() - enemy.lastMove > 1500) {
            let newX = enemy.overworldX;
            let newY = enemy.overworldY;

            if (enemy.aiState === 'hunting' && enemy.target) {
                const targetPlayer = players.get(enemy.target);
                if (targetPlayer) {
                    // Move toward player aggressively
                    if (targetPlayer.x > enemy.overworldX) newX++;
                    else if (targetPlayer.x < enemy.overworldX) newX--;
                    else if (targetPlayer.y > enemy.overworldY) newY++;
                    else if (targetPlayer.y < enemy.overworldY) newY--;
                }
            } else if (enemy.aiState === 'fleeing' && enemy.target) {
                const targetPlayer = players.get(enemy.target);
                if (targetPlayer) {
                    // Move away from player
                    if (targetPlayer.x > enemy.overworldX) newX--;
                    else if (targetPlayer.x < enemy.overworldX) newX++;
                    else if (targetPlayer.y > enemy.overworldY) newY--;
                    else if (targetPlayer.y < enemy.overworldY) newY++;
                }
            } else {
                // Random roaming
                const directions = [
                    { x: 0, y: -1 }, { x: 0, y: 1 },
                    { x: -1, y: 0 }, { x: 1, y: 0 }
                ];
                const direction = directions[Math.floor(Math.random() * directions.length)];
                newX += direction.x;
                newY += direction.y;
            }

            // Validate and apply movement
            newX = Math.max(10, Math.min(WORLD_SIZE - 10, newX));
            newY = Math.max(10, Math.min(WORLD_SIZE - 10, newY));

            if (isValidPosition(newX, newY)) {
                enemy.overworldX = newX;
                enemy.overworldY = newY;
                enemy.lastMove = Date.now();
                updatedEnemies.push(enemy);
            }
        }
    });
    
    // Broadcast enemy movements to all players
    if (updatedEnemies.length > 0 && players.size > 0) {
        io.emit('enemyUpdate', {
            mapId: 'open_world',
            enemies: updatedEnemies
        });
        
        if (updatedEnemies.length > 10) {
            console.log(`🔄 Updated ${updatedEnemies.length} enemy positions (${updatedEnemies.filter(e => e.aiState === 'hunting').length} hunting, ${updatedEnemies.filter(e => e.aiState === 'fleeing').length} fleeing)`);
        }
    }
}, 1000); // Every 1 second for more responsive AI

// Player synchronization - broadcast all player positions periodically
setInterval(() => {
    if (players.size > 1) {
        const playersArray = Array.from(players.values());
        io.emit('playersSync', {
            players: playersArray
        });
        console.log(`🔄 Synced ${playersArray.length} player positions`);
    }
}, 1000); // Every 1 second

// Static files
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Initialize world and start server
initializeWorld();


// Try different ports if 3000 is in use
const PORTS_TO_TRY = [3002, 3003, 3004, 3005, 3001];

function tryStartServer(ports, index = 0) {
    if (index >= ports.length) {
        console.log('❌ Could not find an available port!');
        console.log('💡 Try stopping other servers or restart your computer');
        process.exit(1);
    }
    
    const PORT = ports[index];
    
    server.listen(PORT)
        .on('listening', () => {
            console.log('🚀 MMORPG Server running on port', PORT);
            console.log('🌐 Open http://localhost:' + PORT + ' to play!');
            console.log('👥 Players:', players.size);
            console.log('👹 Enemies:', enemies.size);
            console.log('🗺️ Map tiles:', mapTiles.size);
            console.log('✅ Server ready for connections!');
        })
        .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`⚠️ Port ${PORT} is in use, trying next port...`);
                tryStartServer(ports, index + 1);
            } else {
                console.error('❌ Server error:', err);
                process.exit(1);
            }
        });
}

tryStartServer(PORTS_TO_TRY);