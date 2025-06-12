// public/js/Game.js
/**
 * Main Game Class - Simplified Architecture
 * Handles core game logic, rendering, and entity management on the client-side.
 */
class Game {
    constructor() {
        // Constants
        this.TILE_SIZE = 40;
        this.OPEN_WORLD_ID = 'open_world';
        this.OPEN_WORLD_SIZE = 200;

        // Core state
        this.isGameInitialized = false;
        this.gameState = 'overworld'; // overworld, preparation, combat
        this.currentMapId = this.OPEN_WORLD_ID;
        this.gameLoopId = null;

        // Rendering
        this.canvas = null;
        this.ctx = null;
        this.camera = { x: 0, y: 0, width: 20, height: 15 };

        // World data - SIMPLIFIED: Single source of truth
        this.world = {
            currentMap: {
                id: this.OPEN_WORLD_ID,
                layout: [],
                width: this.OPEN_WORLD_SIZE,
                height: this.OPEN_WORLD_SIZE
            },
            entities: {
                players: new Map(),  // id -> playerData
                enemies: new Map(),  // id -> enemyData
                npcs: new Map()      // Future use
            }
        };

        // Player data
        this.player = this.createDefaultPlayer();
        
        // Combat state
        this.combatState = null;
        this.preparationEnemy = null;
        
        console.log('🎮 Game instance created with simplified architecture');
    }

    initialize() {
        if (this.isGameInitialized) return;
        this.initializeDOM();
        this.setupEventListeners();
        this.isGameInitialized = true;
        console.log('✅ Game engine initialized.');
    }

    initializeDOM() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) throw new Error('Canvas element #gameCanvas not found.');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    start(username) {
        this.player.name = username;
        if (!this.gameLoopId) {
            this.gameLoop();
        }
        console.log(`▶️ Game started for player: ${username}`);
    }

    gameLoop = () => {
        this.render();
        this.gameLoopId = requestAnimationFrame(this.gameLoop);
    };

    render() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.updateCamera();

        if (this.gameState === 'overworld') {
            this.renderOverworld();
        } else if (this.gameState === 'combat') {
            // this.renderCombat();
        }
    }    renderOverworld() {
        this.renderMap();
        this.renderEntities();
        this.renderPlayer(this.player, true);
    }
    
    renderMap() {
        if (!this.world.currentMap.layout || this.world.currentMap.layout.length === 0) return;
        
        const layout = this.world.currentMap.layout;
        const startX = Math.max(0, this.camera.x);
        const endX = Math.min(layout[0]?.length || 0, this.camera.x + this.camera.width);
        const startY = Math.max(0, this.camera.y);
        const endY = Math.min(layout.length, this.camera.y + this.camera.height);
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const tileType = layout[y]?.[x] || 0;
                const screenX = (x - this.camera.x) * this.TILE_SIZE;
                const screenY = (y - this.camera.y) * this.TILE_SIZE;
                
                this.ctx.fillStyle = this.getTileColor(tileType);
                this.ctx.fillRect(screenX, screenY, this.TILE_SIZE, this.TILE_SIZE);
            }
        }
    }

    getTileColor(tileType) {
        switch (tileType) {
            case 0: return '#2d5016'; // Grass
            case 1: return '#4a4a4a'; // Rock
            case 2: return '#1a3d0f'; // Tree
            case 3: return '#2d3e1f'; // Bush
            default: return '#2d5016';
        }
    }    renderEntities() {
        // Render other players
        const playerCount = this.world.entities.players.size;
        this.world.entities.players.forEach(player => this.renderPlayer(player, false));
        
        // Render enemies with debugging
        const enemyCount = this.world.entities.enemies.size;
        if (enemyCount === 0) {
            console.log('⚠️ No enemies to render - entities map is empty');
        } else {
            console.log(`👹 Rendering ${enemyCount} enemies`);
        }
        
        this.world.entities.enemies.forEach((enemy, id) => {
            if (!enemy.isAliveOverworld) {
                console.log(`🪦 Skipping dead enemy: ${enemy.name}`);
                return;
            }
            
            // Check if enemy is visible in camera
            const inView = enemy.overworldX >= this.camera.x - 1 && 
                          enemy.overworldX <= this.camera.x + this.camera.width + 1 &&
                          enemy.overworldY >= this.camera.y - 1 && 
                          enemy.overworldY <= this.camera.y + this.camera.height + 1;
            
            if (inView) {
                console.log(`👹 Rendering enemy: ${enemy.name} at (${enemy.overworldX}, ${enemy.overworldY})`);
            }
            
            this.renderEnemy(enemy);
        });
        
        console.log(`🎬 Rendered: ${playerCount} players, ${enemyCount} enemies`);
    }

    renderPlayer(playerEntity, isLocal) {
        const entityX = isLocal ? playerEntity.overworldX : playerEntity.x;
        const entityY = isLocal ? playerEntity.overworldY : playerEntity.y;
        
        const x = (entityX - this.camera.x) * this.TILE_SIZE;
        const y = (entityY - this.camera.y) * this.TILE_SIZE;

        if (x < -this.TILE_SIZE || x > this.canvas.width || y < -this.TILE_SIZE || y > this.canvas.height) return;

        this.ctx.fillStyle = isLocal ? 'deepskyblue' : '#4299e1';
        this.ctx.fillRect(x + 5, y + 5, this.TILE_SIZE - 10, this.TILE_SIZE - 10);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(playerEntity.name, x + this.TILE_SIZE / 2, y - 5);
    }

    renderEnemy(enemy) {
        if (!enemy.isAliveOverworld) return;
        
        const x = (enemy.overworldX - this.camera.x) * this.TILE_SIZE;
        const y = (enemy.overworldY - this.camera.y) * this.TILE_SIZE;

        if (x < -this.TILE_SIZE || x > this.canvas.width || y < -this.TILE_SIZE || y > this.canvas.height) return;

        this.ctx.fillStyle = '#e53e3e';
        this.ctx.fillRect(x + 5, y + 5, this.TILE_SIZE - 10, this.TILE_SIZE - 10);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(enemy.name || 'Enemy', x + this.TILE_SIZE / 2, y - 5);
    }

    updateCamera() {
        const halfW = Math.floor(this.camera.width / 2);
        const halfH = Math.floor(this.camera.height / 2);
        this.camera.x = Math.max(0, Math.min(this.player.overworldX - halfW, this.OPEN_WORLD_SIZE - this.camera.width));
        this.camera.y = Math.max(0, Math.min(this.player.overworldY - halfH, this.OPEN_WORLD_SIZE - this.camera.height));
    }

    resizeCanvas() {
        // ... (no changes needed here)
    }
    
    createDefaultPlayer() {
        return {
            overworldX: 1, overworldY: 1,
            gridX: 0, gridY: 0,
            size: this.TILE_SIZE * 0.8,
            color: 'deepskyblue',
            hp: 100, maxHp: 100,
            ap: 6, maxAp: 6,
            mp: 3, maxMp: 3,
            attackPower: 15,
            attackRange: 2,
            isAlive: true,
            name: "Adventurer",
            gold: 0,
        };
    }    // --- ENTITY MANAGEMENT METHODS ---
    
    /**
     * Unified method to update world state from server
     */
    updateWorldState(data) {
        console.log('🌍 Updating world state:', data);
        
        if (data.mapId) {
            this.currentMapId = data.mapId;
        }
        
        // Update map layout if provided
        if (data.mapData) {
            this.world.currentMap = {
                id: data.mapId,
                layout: data.mapData.mapLayoutData || [],
                width: data.mapData.width || this.OPEN_WORLD_SIZE,
                height: data.mapData.height || this.OPEN_WORLD_SIZE
            };
        }
        
        // Update entities if provided
        if (data.entities) {
            this.updateEntities(data.entities);
        }
        
        // Legacy support for direct enemy arrays
        if (data.enemies) {
            this.updateEnemies(data.enemies);
        }
        
        console.log(`✅ World state updated: ${this.world.entities.enemies.size} enemies, ${this.world.entities.players.size} players`);
    }
    
    /**
     * Update all entities from server data
     */
    updateEntities(entities) {
        if (entities.enemies) {
            this.updateEnemies(entities.enemies);
        }
        if (entities.players) {
            this.updatePlayers(entities.players);
        }
    }
    
    /**
     * Update enemy collection
     */
    updateEnemies(enemyArray) {
        console.log(`👹 Updating ${enemyArray.length} enemies`);
        this.world.entities.enemies.clear();
        
        enemyArray.forEach(enemy => {
            this.world.entities.enemies.set(enemy.id, enemy);
        });
        
        console.log(`✅ Enemies updated: ${this.world.entities.enemies.size} total`);
    }
    
    /**
     * Update player collection
     */
    updatePlayers(playerArray) {
        console.log(`👥 Updating ${playerArray.length} players`);
        
        // Don't clear players, just update existing ones
        playerArray.forEach(player => {
            if (player.id !== this.player.name) { // Don't add self
                this.world.entities.players.set(player.id, player);
            }
        });
    }
    
    /**
     * Add or update a single player
     */
    addOrUpdatePlayer(playerData) {
        if (playerData.id === this.player.name) return; // Don't add self
        
        this.world.entities.players.set(playerData.id, {
            id: playerData.id,
            name: playerData.name,
            x: playerData.x,
            y: playerData.y,
            mapId: playerData.mapId
        });
        
        console.log(`👤 Player updated: ${playerData.name} at (${playerData.x}, ${playerData.y})`);
    }

    /**
     * Remove a player
     */
    removePlayer(data) {
        const removed = this.world.entities.players.delete(data.id);
        if (removed) {
            console.log(`👋 Player removed: ${data.id}`);
        }
    }
    
    /**
     * Update player position
     */
    updatePlayerPosition(data) {
        const player = this.world.entities.players.get(data.id);
        if (player) {
            player.x = data.x;
            player.y = data.y;
            player.mapId = data.mapId;
        }
    }

    // --- MISSING METHODS FOR COMPATIBILITY ---
    
    /**
     * Handle canvas click events
     */
    handleCanvasClick(e) {
        // Handle canvas clicks for combat or interaction
        if (this.gameState === 'combat') {
            // Combat click handling would go here
        }
    }

    /**
     * Handle keyboard input
     */
    handleKeyDown(e) {
        if (this.gameState !== 'overworld') return;

        // Safety check for e.key
        if (!e || !e.key) return;
        
        const key = e.key.toLowerCase();
        let deltaX = 0;
        let deltaY = 0;

        switch (key) {
            case 'w':
            case 'arrowup':
                deltaY = -1;
                break;
            case 's':
            case 'arrowdown':
                deltaY = 1;
                break;
            case 'a':
            case 'arrowleft':
                deltaX = -1;
                break;
            case 'd':
            case 'arrowright':
                deltaX = 1;
                break;
            default:
                return;
        }

        e.preventDefault();
        
        // Calculate new position
        const newX = this.player.overworldX + deltaX;
        const newY = this.player.overworldY + deltaY;
        
        this.movePlayerTo(newX, newY);
    }    /**
     * Move player to coordinates
     */
    movePlayerTo(x, y) {
        if (this.gameState !== 'overworld' || !this.player.isAlive) return;
        if (!this.isValidMove(x, y)) return;

        // Check for enemy collisions using the new entity system
        for (const [enemyId, enemy] of this.world.entities.enemies) {
            if (enemy.isAliveOverworld && enemy.overworldX === x && enemy.overworldY === y) {
                console.log(`💥 Collision with enemy: ${enemy.name}`);
                this.initiateOpenWorldCombat(enemy);
                return;
            }
        }

        // Update position
        this.player.overworldX = x;
        this.player.overworldY = y;

        // Notify server
        if (window.socketClient && window.socketClient.isConnected()) {
            window.socketClient.updatePlayerPosition(x, y, this.currentMapId);
        }

        console.log(`🚶 Player moved to: (${x}, ${y})`);
    }

    /**
     * Check if move is valid (improved with better error handling)
     */
    isValidMove(x, y) {
        const map = this.world.currentMap;
        const layout = map.layout;

        // 1. Check map boundaries
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
            return false;
        }

        // 2. Safely check for obstacles in the layout
        if (!layout || !layout[y] || typeof layout[y][x] === 'undefined') {
            // If layout data is missing for this tile, assume it's movable.
            // This prevents the game from crashing if the map isn't fully loaded.
            return true;
        }

        const tileType = layout[y][x];
        // Check for obstacles (assuming 1 is an obstacle rock)
        if (tileType === 1) {
            console.log(`🚫 Move blocked by obstacle at (${x}, ${y})`);
            return false;
        }
        
        return true;
    }

    /**
     * Initiate combat with enemy
     */
    initiateOpenWorldCombat(enemyData) {
        if (this.gameState !== 'overworld') return;
        
        console.log(`💥 Collision with enemy: ${enemyData.name || enemyData.id}. Entering preparation...`);
        this.gameState = 'preparation';
        
        // Store enemy data for UI
        this.preparationEnemy = enemyData; 
        
        if (window.ui) {
            window.ui.showGameState('preparation'); 
            window.ui.showNotification(`Preparing for combat with ${enemyData.combatStats?.name || enemyData.name}!`, 'warning');
        }
    }

    /**
     * Resize canvas to fit container
     */
    resizeCanvas() {
        if (!this.canvas) return;
        
        const container = this.canvas.parentElement;
        if (container) {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
        } else {
            this.canvas.width = 800;
            this.canvas.height = 600;
        }

        // Update camera dimensions based on canvas size
        this.camera.width = Math.floor(this.canvas.width / this.TILE_SIZE);
        this.camera.height = Math.floor(this.canvas.height / this.TILE_SIZE);

        console.log(`📐 Canvas resized: ${this.canvas.width}x${this.canvas.height}`);
    }

    /**
     * Get player data for saving
     */
    getPlayerData() {
        return {
            name: this.player.name,
            overworldX: this.player.overworldX,
            overworldY: this.player.overworldY,
            hp: this.player.hp,
            maxHp: this.player.maxHp,
            ap: this.player.ap,
            maxAp: this.player.maxAp,
            mp: this.player.mp,
            maxMp: this.player.maxMp,
            gold: this.player.gold,
            mapId: this.currentMapId
        };
    }    /**
     * Update player data from loaded save
     */
    updatePlayerData(data) {
        if (!data) return;
        
        Object.assign(this.player, data);
        this.currentMapId = data.mapId || this.OPEN_WORLD_ID;
        
        console.log('📊 Player data updated from save');
    }

    /**
     * Load map data from server
     */
    loadMapData(data) {
        console.log(`🗺️ Loading map data for: ${data.mapId}`);
        
        this.currentMapId = data.mapId;
        this.world.currentMap = {
            id: data.mapId,
            layout: data.data?.mapLayoutData || [],
            width: data.data?.width || this.OPEN_WORLD_SIZE,
            height: data.data?.height || this.OPEN_WORLD_SIZE
        };
        
        // Also load enemies if they come with map data
        if (data.data?.enemies) {
            this.updateEnemies(data.data.enemies);
        }
        
        console.log(`✅ Map ${data.mapId} loaded with ${this.world.entities.enemies.size} enemies`);
    }    /**
     * Load entities from server (unified method)
     */
    loadEntities(data) {
        console.log('🔄 Loading entities from server:', data);
        
        if (data.mapId && data.mapId !== this.currentMapId) {
            console.log(`🗺️ Map changed: ${this.currentMapId} -> ${data.mapId}`);
            this.currentMapId = data.mapId;
        }
        
        if (data.enemies) {
            console.log(`👹 Processing ${data.enemies.length} enemies from server`);
            this.updateEnemies(data.enemies);
            
            // Verify enemies were actually added
            console.log(`✅ Enemies after update: ${this.world.entities.enemies.size} in memory`);
            
            // Log first few enemies for debugging
            if (this.world.entities.enemies.size > 0) {
                const firstEnemy = Array.from(this.world.entities.enemies.values())[0];
                console.log(`👹 First enemy in memory:`, {
                    id: firstEnemy.id,
                    name: firstEnemy.name,
                    position: `(${firstEnemy.overworldX}, ${firstEnemy.overworldY})`,
                    alive: firstEnemy.isAliveOverworld
                });
            }
        }
        
        if (data.players) {
            this.updatePlayers(data.players);
        }
    }/**
     * Stop the game
     */
    stop() {
        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = null;
        }
        console.log('⏹️ Game stopped');
    }
    
    /**
     * Debug method to check enemy state on client
     */
    debugEnemies() {
        console.log('🔍 CLIENT DEBUG: Enemy State');
        console.log(`- Current Map: ${this.currentMapId}`);
        console.log(`- Enemies in memory: ${this.world.entities.enemies.size}`);
        
        if (this.world.entities.enemies.size > 0) {
            console.log('👹 Enemy List:');
            this.world.entities.enemies.forEach((enemy, id) => {
                console.log(`  ${id}: ${enemy.name} at (${enemy.overworldX}, ${enemy.overworldY}) - Alive: ${enemy.isAliveOverworld}`);
            });
        } else {
            console.log('❌ No enemies in client memory');
        }
        
        console.log('🔍 Debug complete');
    }
}
