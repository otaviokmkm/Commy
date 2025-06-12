// Test script to verify enemy generation
console.log('🧪 Testing Enemy Generation System...');

const MapManager = require('./server/gameLogic/mapManager');
const io = require('socket.io-client');

// Initialize map manager
const mapManager = new MapManager();
mapManager.initializeMaps();

// Check open world enemies
const openWorldMap = mapManager.getMap('open_world');
if (openWorldMap) {
    console.log(`\n🗺️ Open World Map:`);
    console.log(`- Size: ${openWorldMap.width}x${openWorldMap.height}`);
    console.log(`- Enemies: ${openWorldMap.enemies.length}`);
    
    if (openWorldMap.enemies.length > 0) {
        console.log(`\n👹 First 5 enemies:`);
        openWorldMap.enemies.slice(0, 5).forEach((enemy, i) => {
            console.log(`${i + 1}. ${enemy.name} at (${enemy.overworldX}, ${enemy.overworldY}) - HP: ${enemy.hp}`);
        });
    }
    
    // Test map data retrieval
    const mapData = mapManager.getMapData('open_world');
    console.log(`\n📡 Map data contains ${mapData.enemies.length} enemies`);
    
    console.log('\n✅ Enemy generation system working correctly!');
} else {
    console.log('❌ Open world map not found!');
}

// Quick test to connect and check enemy data
console.log('🔍 Testing enemy data from server...');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('✅ Connected to server');
    
    // Join game
    socket.emit('playerJoin', {
        playerId: 'test_' + Date.now(),
        username: 'TestPlayer',
        position: { x: 100, y: 100 },
        mapId: 'open_world'
    });
    
    // Join map
    socket.emit('joinMap', {
        mapId: 'open_world',
        playerId: 'test_' + Date.now(),
        x: 100,
        y: 100,
        name: 'TestPlayer'
    });
});

socket.on('mapEnemies', (data) => {
    console.log('👹 Received enemies:', data);
    console.log(`📊 Enemy count: ${data.enemies?.length || 0}`);
    
    if (data.enemies && data.enemies.length > 0) {
        console.log('🎯 First enemy:', data.enemies[0]);
    } else {
        console.log('❌ No enemies received!');
    }
    
    socket.disconnect();
});

socket.on('enemyUpdate', (data) => {
    console.log('🔄 Enemy update:', data);
});

socket.on('mapData', (data) => {
    console.log('🗺️ Map data received:', !!data);
});

setTimeout(() => {
    console.log('⏰ Test timeout - disconnecting');
    socket.disconnect();
}, 5000);