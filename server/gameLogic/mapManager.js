// server/gameLogic/mapManager.js

/**
 * Map Manager - Handles map initialization and management
 */
class MapManager {
    constructor() {
        this.maps = {};
        this.TILE_TYPES = {
            EMPTY: 0,
            OBSTACLE_ROCK: 1,
            DECORATION_TREE: 2,
            DECORATION_BUSH: 3
        };
        this.OPEN_WORLD_SIZE = 200;
        this.DEFAULT_GRID_COLS = 20;
        this.DEFAULT_GRID_ROWS = 15;
    }

    /**
     * Initialize all maps
     */
    initializeMaps() {
        try {
            // Initialize open world map
            this.initializeOpenWorldMap();
            
            // Initialize other maps as needed
            this.initializeInstanceMaps();
            
            console.log('✅ Maps initialized successfully');
            console.log(`📍 Available maps: ${Object.keys(this.maps).join(', ')}`);
            
        } catch (error) {
            console.error('❌ Map initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize the open world map
     */
    initializeOpenWorldMap() {
        const mapId = 'open_world';
        
        this.maps[mapId] = {
            id: mapId,
            name: 'Open World',
            type: 'overworld',
            width: this.OPEN_WORLD_SIZE,
            height: this.OPEN_WORLD_SIZE,
            players: new Set(),
            enemies: this.generateOpenWorldEnemies(),
            mapLayoutData: this.generateOpenWorldLayout(),
            spawns: {
                default: { x: 100, y: 100 }
            },
            settings: {
                pvpEnabled: true,
                partyEnabled: true,
                respawnTime: 30000
            }
        };
        
        console.log(`📍 Initialized map: ${mapId} (${this.OPEN_WORLD_SIZE}x${this.OPEN_WORLD_SIZE})`);
    }

    /**
     * Initialize instance maps (dungeons, arenas, etc.)
     */
    initializeInstanceMaps() {
        // Example: Combat Arena
        const arenaId = 'combat_arena';
        this.maps[arenaId] = {
            id: arenaId,
            name: 'Combat Arena',
            type: 'instance',
            width: 8,
            height: 6,
            players: new Set(),
            enemies: [],
            mapLayoutData: this.generateArenaLayout(),
            spawns: {
                player1: { x: 1, y: 2 },
                player2: { x: 6, y: 3 }
            },
            settings: {
                pvpEnabled: true,
                partyEnabled: false,
                maxPlayers: 2
            }
        };
        
        console.log(`📍 Initialized map: ${arenaId} (8x6 arena)`);
    }

    /**
     * Generate open world layout
     */
    generateOpenWorldLayout() {
        const layout = [];
        
        for (let y = 0; y < this.OPEN_WORLD_SIZE; y++) {
            const row = [];
            for (let x = 0; x < this.OPEN_WORLD_SIZE; x++) {
                // Simple terrain generation
                const rand = Math.random();
                
                if (rand < 0.01) { // Change from 0.1 to 0.05 for 5% rocks instead of 10%
                    row.push(this.TILE_TYPES.OBSTACLE_ROCK);
                } else if (rand < 0.15) {
                    row.push(this.TILE_TYPES.DECORATION_TREE);
                } else if (rand < 0.2) {
                    row.push(this.TILE_TYPES.DECORATION_BUSH);
                } else {
                    row.push(this.TILE_TYPES.EMPTY);
                }
            }
            layout.push(row);
        }
        
        return layout;
    }

    /**
     * Generate arena layout
     */
    generateArenaLayout() {
        const layout = [];
        
        for (let y = 0; y < 6; y++) {
            const row = [];
            for (let x = 0; x < 8; x++) {
                // Border walls
                if (x === 0 || x === 7 || y === 0 || y === 5) {
                    row.push(this.TILE_TYPES.OBSTACLE_ROCK);
                } else {
                    row.push(this.TILE_TYPES.EMPTY);
                }
            }
            layout.push(row);
        }
        
        return layout;
    }    /**
     * Generate enemies for open world
     */
    generateOpenWorldEnemies() {
        const enemies = [];
        const enemyTypes = [
            { name: 'Goblin Scout', hp: 80, ap: 3, mp: 2, attackPower: 12, attackRange: 1 },
            { name: 'Forest Wolf', hp: 120, ap: 4, mp: 1, attackPower: 15, attackRange: 1 },
            { name: 'Orc Warrior', hp: 150, ap: 5, mp: 3, attackPower: 18, attackRange: 2 },
            { name: 'Dark Mage', hp: 100, ap: 6, mp: 8, attackPower: 20, attackRange: 3 },
            { name: 'Skeleton Archer', hp: 90, ap: 4, mp: 2, attackPower: 14, attackRange: 3 },
            { name: 'Ice Elemental', hp: 200, ap: 3, mp: 10, attackPower: 22, attackRange: 2 }
        ];
        
        // Generate more enemies with better distribution
        const totalEnemies = 75;
        
        for (let i = 0; i < totalEnemies; i++) {
            const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
            
            // Better position distribution across the map
            let x, y;
            do {
                x = Math.floor(Math.random() * (this.OPEN_WORLD_SIZE - 40)) + 20;
                y = Math.floor(Math.random() * (this.OPEN_WORLD_SIZE - 40)) + 20;
            } while (this.isPositionOccupied(x, y, enemies));
            
            const enemy = {
                id: `enemy_${Date.now()}_${i}`, // More unique IDs
                name: enemyType.name,
                overworldX: x,
                overworldY: y,
                originalOverworldX: x,
                originalOverworldY: y,
                isAliveOverworld: true,
                inCombat: false,
                combatPlayerId: null,
                hp: enemyType.hp,
                mapId: 'open_world',
                lastMovement: Date.now(),
                movementPattern: Math.random() < 0.3 ? 'aggressive' : 'patrol', // 30% aggressive
                detectionRange: enemyType.name === 'Dark Mage' ? 8 : 5,
                combatStats: {
                    name: enemyType.name,
                    hp: enemyType.hp,
                    maxHp: enemyType.hp,
                    ap: enemyType.ap,
                    maxAp: enemyType.ap,
                    mp: enemyType.mp,
                    maxMp: enemyType.mp,
                    attackPower: enemyType.attackPower,
                    attackRange: enemyType.attackRange
                },
                aiType: 'basic',
                respawnTimer: null
            };
            
            enemies.push(enemy);
        }
        
        console.log(`👹 Generated ${enemies.length} enemies for open world`);
        return enemies;
    }    /**
     * Check if position is occupied by another enemy
     */
    isPositionOccupied(x, y, existingEnemies) {
        return existingEnemies.some(enemy => 
            Math.abs(enemy.overworldX - x) < 3 && Math.abs(enemy.overworldY - y) < 3
        );
    }

    /**
     * Get map by ID
     */
    getMap(mapId) {
        return this.maps[mapId] || null;
    }

    /**
     * Get all maps
     */
    getAllMaps() {
        return this.maps;
    }

    /**
     * Check if map exists
     */
    mapExists(mapId) {
        return !!this.maps[mapId];
    }

    /**
     * Get players in map
     */
    getPlayersInMap(mapId) {
        const map = this.getMap(mapId);
        return map ? Array.from(map.players) : [];
    }

    /**
     * Add player to map
     */
    addPlayerToMap(mapId, socketId) {
        const map = this.getMap(mapId);
        if (map) {
            map.players.add(socketId);
            return true;
        }
        return false;
    }

    /**
     * Remove player from map
     */
    removePlayerFromMap(mapId, socketId) {
        const map = this.getMap(mapId);
        if (map) {
            map.players.delete(socketId);
            return true;
        }
        return false;
    }

    /**
     * Get map spawn point
     */
    getSpawnPoint(mapId, spawnType = 'default') {
        const map = this.getMap(mapId);
        if (map && map.spawns && map.spawns[spawnType]) {
            return map.spawns[spawnType];
        }
        
        // Default spawn for open world
        if (mapId === 'open_world') {
            return { x: 100, y: 100 };
        }
        
        return { x: 1, y: 1 };
    }

    /**
     * Update enemy state
     */
    updateEnemyState(mapId, enemyId, updates) {
        const map = this.getMap(mapId);
        if (map && map.enemies) {
            const enemy = map.enemies.find(e => e.id === enemyId);
            if (enemy) {
                Object.assign(enemy, updates);
                return true;
            }
        }
        return false;
    }

    /**
     * Get enemy by ID
     */
    getEnemy(mapId, enemyId) {
        const map = this.getMap(mapId);
        if (map && map.enemies) {
            return map.enemies.find(e => e.id === enemyId) || null;
        }
        return null;
    }

    /**
     * Get map data including layout and enemies
     */
    getMapData(mapId) {
        const map = this.getMap(mapId);
        if (!map) return null;
        
        return {
            id: map.id,
            name: map.name,
            type: map.type,
            width: map.width,
            height: map.height,
            mapLayoutData: map.mapLayoutData,
            enemies: map.enemies,
            settings: map.settings
        };
    }
}

module.exports = MapManager;
