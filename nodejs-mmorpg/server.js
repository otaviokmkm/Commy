// Clean Node.js MMORPG Server
// No more complex dependencies or broken code!

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

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

// Initialize map and enemies
function initializeWorld() {
    console.log('🌍 Initializing world...');
    
    // Generate map tiles
    for (let y = 0; y < WORLD_SIZE; y++) {
        for (let x = 0; x < WORLD_SIZE; x++) {
            const key = `${x},${y}`;
            let tileType = 0; // grass
            
            // Add some rocks and trees
            if ((x + y) % 15 === 0) tileType = 1; // rock
            if ((x * y) % 23 === 0 && tileType === 0) tileType = 2; // tree
            
            mapTiles.set(key, {
                x, y, type: tileType
            });
        }
    }
    
    // Generate enemies
    for (let i = 0; i < 50; i++) {
        const x = Math.floor(Math.random() * (WORLD_SIZE - 20)) + 10;
        const y = Math.floor(Math.random() * (WORLD_SIZE - 20)) + 10;
        
        // Make sure enemy is not on a rock
        const tileKey = `${x},${y}`;
        const tile = mapTiles.get(tileKey);
        if (tile && tile.type === 1) continue; // skip rocks
        
        enemies.set(i, {
            id: i,
            name: `Goblin ${i + 1}`,
            x: x,
            y: y,
            originalX: x,
            originalY: y,
            hp: 50,
            maxHp: 50,
            isAlive: true,
            lastMove: Date.now()
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

function getPlayersArray() {
    return Array.from(players.values()).map(p => ({
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y
    }));
}

function getEnemiesArray() {
    return Array.from(enemies.values()).filter(e => e.isAlive);
}

function getMapData() {
    const tiles = [];
    for (let y = 0; y < WORLD_SIZE; y++) {
        const row = [];
        for (let x = 0; x < WORLD_SIZE; x++) {
            const tile = mapTiles.get(`${x},${y}`);
            row.push(tile ? tile.type : 0);
        }
        tiles.push(row);
    }
    return {
        width: WORLD_SIZE,
        height: WORLD_SIZE,
        tiles: tiles
    };
}

// Socket handling
io.on('connection', (socket) => {
    console.log(`🔌 Player connected: ${socket.id}`);
    
    // Player join
    socket.on('playerJoin', (data) => {
        const { name, x = 100, y = 100 } = data;
        
        const player = {
            id: socket.id,
            name: name,
            x: x,
            y: y,
            hp: 100,
            maxHp: 100,
            socketId: socket.id
        };
        
        players.set(socket.id, player);
        
        console.log(`👤 ${name} joined at (${x}, ${y})`);
        
        // Send initial data to player
        socket.emit('gameState', {
            player: player,
            players: getPlayersArray(),
            enemies: getEnemiesArray(),
            mapData: getMapData()
        });
        
        // Notify other players
        socket.broadcast.emit('playerJoined', {
            id: socket.id,
            name: name,
            x: x,
            y: y
        });
    });
    
    // Player movement
    socket.on('playerMove', (data) => {
        const { x, y } = data;
        const player = players.get(socket.id);
        
        if (!player) return;
        
        if (!isValidPosition(x, y)) {
            socket.emit('moveRejected', { reason: 'Invalid position' });
            return;
        }
        
        // Check for enemy collision
        for (const enemy of enemies.values()) {
            if (enemy.isAlive && enemy.x === x && enemy.y === y) {
                socket.emit('enemyCollision', { enemyId: enemy.id });
                return;
            }
        }
        
        // Update position
        player.x = x;
        player.y = y;
        
        // Broadcast to other players
        socket.broadcast.emit('playerMoved', {
            id: socket.id,
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
        
        if (!player || !enemy || !enemy.isAlive) return;
        
        // Check if player is close enough
        const distance = Math.abs(player.x - enemy.x) + Math.abs(player.y - enemy.y);
        if (distance > 1) {
            socket.emit('attackFailed', { reason: 'Too far away' });
            return;
        }
        
        // Deal damage
        enemy.hp -= 25;
        
        if (enemy.hp <= 0) {
            enemy.isAlive = false;
            socket.emit('enemyDefeated', { enemyId: enemyId, xp: 10 });
            io.emit('enemyDied', { enemyId: enemyId });
            console.log(`💀 ${enemy.name} defeated by ${player.name}`);
        } else {
            socket.emit('attackSuccess', { enemyId: enemyId, damage: 25 });
        }
        
        // Broadcast enemy update
        io.emit('enemyUpdate', {
            enemyId: enemyId,
            hp: enemy.hp,
            isAlive: enemy.isAlive
        });
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

// Enemy AI (simple movement)
setInterval(() => {
    for (const enemy of enemies.values()) {
        if (!enemy.isAlive) continue;
        
        // Simple random movement
        if (Date.now() - enemy.lastMove > 3000) { // Move every 3 seconds
            const directions = [
                { x: 0, y: -1 }, { x: 0, y: 1 },
                { x: -1, y: 0 }, { x: 1, y: 0 }
            ];
            
            const direction = directions[Math.floor(Math.random() * directions.length)];
            const newX = enemy.x + direction.x;
            const newY = enemy.y + direction.y;
            
            if (isValidPosition(newX, newY)) {
                enemy.x = newX;
                enemy.y = newY;
                enemy.lastMove = Date.now();
                
                // Broadcast enemy movement
                io.emit('enemyMoved', {
                    enemyId: enemy.id,
                    x: newX,
                    y: newY
                });
            }
        }
    }
}, 1000);

// Static files
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize world and start server
initializeWorld();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('🚀 Clean MMORPG Server running on port', PORT);
    console.log('🌐 Open http://localhost:' + PORT + ' to play!');
    console.log('👥 Players:', players.size);
    console.log('👹 Enemies:', enemies.size);
    console.log('🗺️ Map tiles:', mapTiles.size);
});