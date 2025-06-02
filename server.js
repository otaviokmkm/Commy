// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Authentication Data ---
const USERS_FILE = path.join(__dirname, 'users.json');
function readUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE);
            return JSON.parse(data);
        }
    } catch (err) {
        console.error("Error reading users file:", err);
    }
    return {};
}
function writeUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (err) {
        console.error("Error writing users file:", err);
    }
}

// --- Authentication Routes ---
app.post('/api/register', (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    }
    const users = readUsers();
    if (users[login]) {
        return res.status(400).json({ error: 'Usuário já existe.' });
    }
    users[login] = { password }; // Store hashed password in a real app
    writeUsers(users);
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
});

app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    }
    const users = readUsers();
    const user = users[login];
    if (!user || user.password !== password) { // Compare hashed passwords in a real app
        return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }
    res.json({ message: 'Login bem-sucedido!', token: `fake-token-for-${login}` });
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

// --- Map Generation Logic (Server-Side) ---
function generateServerMapLayout(mapId, G_COLS, G_ROWS) {
    const layout = [];
    const currentMapConnections = mapConnections[mapId] || {}; // Get connections for the current map

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
    // Add random obstacles and decorations (similar to client, but server is the authority)
    let rockDensity = (mapId === 'mapa_chefe') ? 0.1 : 0.05;
    let decorDensity = (mapId === 'mapa_chefe') ? 0.05 : 0.1;

    for (let r = 1; r < G_ROWS - 1; r++) {
        for (let c = 1; c < G_COLS - 1; c++) {
            // Basic check to avoid placing obstacles on common spawn areas (e.g., near edges)
            // A more robust check would consider actual player/enemy spawn points if they are fixed.
            if (r < 3 && c < 3) continue; // Example: keep top-left area clearer

            if (Math.random() < rockDensity) {
                layout[r][c] = MAP_TILES.OBSTACLE_ROCK;
            } else if (Math.random() < decorDensity) {
                layout[r][c] = Math.random() < 0.5 ? MAP_TILES.DECORATION_TREE : MAP_TILES.DECORATION_BUSH;
            }
        }
    }
    return layout;
}

const mapConnections = { // Define this on server too for map generation logic
    'mapa1': { right: 'mapa2', gridCols: 20, gridRows: 15 },
    'mapa2': { left: 'mapa1', right: 'mapa_chefe', gridCols: 20, gridRows: 15 },
    'mapa_chefe': { left: 'mapa2', gridCols: 25, gridRows: 20 }, // Boss map might be larger
    [OPEN_WORLD_ID]: { gridCols: OPEN_WORLD_SIZE, gridRows: OPEN_WORLD_SIZE } // Special case for open world
};


const serverGeneratedMapLayouts = {}; // Store generated layouts

// Ensure mapInitialEnemies is properly initialized
const mapInitialEnemies = {}; // Add this if mapInitialEnemies is not defined elsewhere

// Debugging log to check the value of mapInitialEnemies
console.log('mapInitialEnemies:', mapInitialEnemies);

// Initialize map structures and generate layouts on server start
for (const mapId in mapConnections) {
    const G_COLS = mapConnections[mapId].gridCols || DEFAULT_GRID_COLS;
    const G_ROWS = mapConnections[mapId].gridRows || DEFAULT_GRID_ROWS;
    serverGeneratedMapLayouts[mapId] = generateServerMapLayout(mapId, G_COLS, G_ROWS);

    // Validate mapInitialEnemies[mapId] and provide a fallback
    const initialEnemies = Array.isArray(mapInitialEnemies[mapId]) ? mapInitialEnemies[mapId] : [];

    maps[mapId] = {
        players: new Set(),
        mapLayoutData: serverGeneratedMapLayouts[mapId],
        enemies: JSON.parse(JSON.stringify(initialEnemies)).map(enemyConfig => ({
            id: enemyConfig.id,
            originalOverworldX: enemyConfig.originalOverworldX,
            originalOverworldY: enemyConfig.originalOverworldY,
            overworldX: enemyConfig.originalOverworldX,
            overworldY: enemyConfig.originalOverworldY,
            isAliveOverworld: true,
            hp: enemyConfig.data.combatStats.maxHp,
            combatStats: enemyConfig.data.combatStats,
            aggroRange: enemyConfig.data.aggroRange,
            respawnTimer: null
        }))
    };
}

// Debugging: Log the value of mapInitialEnemies[mapId] for troubleshooting
console.log('mapInitialEnemies:', mapInitialEnemies);

const ENEMY_RESPAWN_TIME = 30000; // 30 segundos

io.on('connection', (socket) => {
    console.log('Usuário conectado:', socket.id);

    socket.on('joinMap', (data) => {
        const { mapId, playerId, x, y, name, color } = data;
        if (!mapId || !playerId || !maps[mapId]) {
            console.warn(`Tentativa de joinMap inválida: mapId=${mapId}, playerId=${playerId}`);
            return;
        }

        // Leave previous room if any
        if (players[socket.id] && players[socket.id].mapId && players[socket.id].mapId !== mapId) {
            const oldMapId = players[socket.id].mapId;
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
        maps[mapId].players.add(socket.id);

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
        });

        socket.emit('mapState', {
            mapId: mapId,
            players: playersInMap,
            mapLayoutData: maps[mapId].mapLayoutData, // Envia o layout do mapa do servidor
            enemies: maps[mapId].enemies.map(e => ({ // Envia estado atual dos inimigos
                id: e.id,
                overworldX: e.overworldX, overworldY: e.overworldY,
                isAliveOverworld: e.isAliveOverworld,
                hp: e.hp, // Enviar HP atual para o cliente
                combatStats: e.combatStats,
                aggroRange: e.aggroRange
            }))
        });

        socket.to(mapId).emit('playerJoined', {
            playerId: playerId, x: x, y: y, name: name, color: players[socket.id].color, mapId: mapId
        });
        console.log(`${name} (${playerId}) entrou no mapa ${mapId}`);
    });

    socket.on('leaveMap', (data) => {
        const { playerId, mapId } = data;
        if (players[socket.id] && maps[mapId] && players[socket.id].mapId === mapId) {
            socket.leave(mapId);
            maps[mapId].players.delete(socket.id);
            socket.to(mapId).emit('playerLeft', { playerId: playerId, mapId: mapId });
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
    });

    socket.on('chatMessage', (data) => {
        const { senderId, senderName, message, mapId } = data;
        if (players[socket.id] && players[socket.id].mapId === mapId) {
            io.to(mapId).emit('chatMessage', { senderId, senderName, message });
        }
    });

    socket.on('enemyDefeated', (data) => { 
        const { enemyId, mapId } = data;
        if (maps[mapId] && maps[mapId].enemies) {
            const enemy = maps[mapId].enemies.find(e => e.id === enemyId);
            if (enemy && enemy.isAliveOverworld) {
                enemy.isAliveOverworld = false;
                enemy.hp = 0; // Garante que o HP seja 0
                console.log(`Inimigo ${enemyId} (${enemy.combatStats.name}) no mapa ${mapId} derrotado. Iniciando timer de respawn.`);
                
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
        }
    });

    socket.on('playerDisconnecting', () => { 
        handleDisconnect(socket);
    });

    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });

    function handleDisconnect(socketInstance) {
        const player = players[socketInstance.id];
        if (player) {
            console.log(`${player.name} (${player.id}) desconectou.`);
            if (maps[player.mapId]) {
                maps[player.mapId].players.delete(socketInstance.id);
                socketInstance.to(player.mapId).emit('playerLeft', { playerId: player.id, mapId: player.mapId });
            }
            delete players[socketInstance.id];
        } else {
            // console.log('Um usuário desconectou (sem dados de jogador):', socketInstance.id);
        }
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Servidor MMORPG rodando na porta ${PORT}`);
    console.log(`Acesse o jogo em http://localhost:${PORT}`);
});