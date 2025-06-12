// SpacetimeDB Client for MMORPG
import { SpacetimeDBClient, Identity, Address } from "@clockworklabs/spacetimedb-sdk";

class SpacetimeGame {
    constructor() {
        this.client = null;
        this.identity = null;
        this.playerData = null;
        this.isConnected = false;
        
        // Game state
        this.players = new Map();
        this.enemies = new Map();
        this.mapTiles = new Map();
        this.combatSession = null;
        
        // UI references
        this.canvas = null;
        this.ctx = null;
        this.camera = { x: 0, y: 0, width: 20, height: 15 };
        
        console.log('🎮 SpacetimeDB Game client created');
    }
    
    /**
     * Connect to SpacetimeDB
     */
    async connect(dbAddress) {
        try {
            // Connect to your deployed SpacetimeDB instance
            this.client = new SpacetimeDBClient("ws://localhost:3000", dbAddress);
            
            // Set up table subscriptions
            this.setupSubscriptions();
            
            await this.client.connect();
            this.isConnected = true;
            
            console.log('✅ Connected to SpacetimeDB');
            return true;
        } catch (error) {
            console.error('❌ Failed to connect to SpacetimeDB:', error);
            return false;
        }
    }
    
    /**
     * Setup table subscriptions
     */
    setupSubscriptions() {
        // Subscribe to Player table changes
        this.client.subscribe("SELECT * FROM Player WHERE is_online = true", (players) => {
            console.log(`👥 Players updated: ${players.length}`);
            this.players.clear();
            players.forEach(player => {
                this.players.set(player.identity.toString(), player);
            });
            this.render();
        });
        
        // Subscribe to Enemy table changes  
        this.client.subscribe("SELECT * FROM Enemy WHERE is_alive = true", (enemies) => {
            console.log(`👹 Enemies updated: ${enemies.length}`);
            this.enemies.clear();
            enemies.forEach(enemy => {
                this.enemies.set(enemy.id, enemy);
            });
            this.render();
        });
        
        // Subscribe to map tiles
        this.client.subscribe("SELECT * FROM MapTile WHERE map_id = 'open_world'", (tiles) => {
            console.log(`🗺️ Map tiles loaded: ${tiles.length}`);
            this.mapTiles.clear();
            tiles.forEach(tile => {
                const key = `${tile.x}_${tile.y}`;
                this.mapTiles.set(key, tile);
            });
            this.render();
        });
        
        // Subscribe to combat sessions
        this.client.subscribe("SELECT * FROM CombatSession WHERE is_active = true", (sessions) => {
            const playerSession = sessions.find(s => s.player_identity.equals(this.identity));
            this.combatSession = playerSession || null;
            
            if (this.combatSession) {
                this.showCombatUI();
            } else {
                this.hideCombatUI();
            }
        });
    }
    
    /**
     * Join the game
     */
    async joinGame(playerName, x = 100, y = 100) {
        try {
            await this.client.call("player_join", playerName, x, y);
            this.identity = this.client.identity;
            console.log(`🎮 Joined game as ${playerName}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to join game:', error);
            return false;
        }
    }
    
    /**
     * Move player
     */
    async movePlayer(newX, newY) {
        try {
            await this.client.call("move_player", newX, newY);
            console.log(`🚶 Moved to (${newX}, ${newY})`);
        } catch (error) {
            console.warn('⚠️ Move failed:', error.message);
        }
    }
    
    /**
     * Start combat with enemy
     */
    async startCombat(enemyId) {
        try {
            await this.client.call("start_combat", enemyId);
            console.log(`⚔️ Started combat with enemy ${enemyId}`);
        } catch (error) {
            console.warn('⚠️ Combat start failed:', error.message);
        }
    }
    
    /**
     * Initialize map (admin only)
     */
    async initializeMap() {
        try {
            await this.client.call("init_map");
            console.log('🗺️ Map initialized');
        } catch (error) {
            console.error('❌ Map initialization failed:', error);
        }
    }
    
    /**
     * Setup canvas and rendering
     */
    initializeCanvas() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        // Start render loop
        this.gameLoop();
        
        // Setup controls
        this.setupControls();
    }
    
    /**
     * Setup keyboard controls
     */
    setupControls() {
        document.addEventListener('keydown', (e) => {
            if (!this.playerData) return;
            
            let deltaX = 0, deltaY = 0;
            
            switch (e.key.toLowerCase()) {
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
                case 'i':
                    // Initialize map (admin command)
                    this.initializeMap();
                    return;
                default:
                    return;
            }
            
            e.preventDefault();
            
            const newX = this.playerData.x + deltaX;
            const newY = this.playerData.y + deltaY;
            
            this.movePlayer(newX, newY);
        });
        
        // Canvas click for combat
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clickX = Math.floor((e.clientX - rect.left) / 40) + this.camera.x;
            const clickY = Math.floor((e.clientY - rect.top) / 40) + this.camera.y;
            
            // Check for enemy at clicked position
            for (const [id, enemy] of this.enemies) {
                if (enemy.x === clickX && enemy.y === clickY) {
                    this.startCombat(enemy.id);
                    break;
                }
            }
        });
    }
    
    /**
     * Game render loop
     */
    gameLoop = () => {
        this.render();
        requestAnimationFrame(this.gameLoop);
    };
    
    /**
     * Render the game
     */
    render() {
        if (!this.ctx) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update camera to follow player
        this.updateCamera();
        
        // Render map tiles
        this.renderMap();
        
        // Render entities
        this.renderEnemies();
        this.renderPlayers();
    }
    
    /**
     * Update camera position
     */
    updateCamera() {
        if (!this.playerData) return;
        
        const halfW = Math.floor(this.camera.width / 2);
        const halfH = Math.floor(this.camera.height / 2);
        
        this.camera.x = Math.max(0, Math.min(this.playerData.x - halfW, 200 - this.camera.width));
        this.camera.y = Math.max(0, Math.min(this.playerData.y - halfH, 200 - this.camera.height));
    }
    
    /**
     * Render map tiles
     */
    renderMap() {
        const tileSize = 40;
        
        for (let y = this.camera.y; y < this.camera.y + this.camera.height; y++) {
            for (let x = this.camera.x; x < this.camera.x + this.camera.width; x++) {
                const key = `${x}_${y}`;
                const tile = this.mapTiles.get(key);
                
                const screenX = (x - this.camera.x) * tileSize;
                const screenY = (y - this.camera.y) * tileSize;
                
                // Render tile based on type
                if (tile) {
                    switch (tile.tile_type) {
                        case 0: // Grass
                            this.ctx.fillStyle = '#2d5016';
                            break;
                        case 1: // Rock
                            this.ctx.fillStyle = '#4a4a4a';
                            break;
                        default:
                            this.ctx.fillStyle = '#2d5016';
                    }
                } else {
                    this.ctx.fillStyle = '#2d5016'; // Default grass
                }
                
                this.ctx.fillRect(screenX, screenY, tileSize, tileSize);
            }
        }
    }
    
    /**
     * Render enemies
     */
    renderEnemies() {
        const tileSize = 40;
        
        for (const [id, enemy] of this.enemies) {
            if (!enemy.is_alive) continue;
            
            const screenX = (enemy.x - this.camera.x) * tileSize;
            const screenY = (enemy.y - this.camera.y) * tileSize;
            
            // Only render if visible
            if (screenX >= -tileSize && screenX < this.canvas.width && 
                screenY >= -tileSize && screenY < this.canvas.height) {
                
                // Render enemy
                this.ctx.fillStyle = '#e53e3e';
                this.ctx.fillRect(screenX + 5, screenY + 5, tileSize - 10, tileSize - 10);
                
                // Render name
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(enemy.name, screenX + tileSize/2, screenY - 5);
            }
        }
    }
    
    /**
     * Render players
     */
    renderPlayers() {
        const tileSize = 40;
        
        for (const [identityStr, player] of this.players) {
            const isLocalPlayer = this.identity && identityStr === this.identity.toString();
            
            if (isLocalPlayer) {
                this.playerData = player; // Store reference to local player
            }
            
            const screenX = (player.x - this.camera.x) * tileSize;
            const screenY = (player.y - this.camera.y) * tileSize;
            
            // Only render if visible
            if (screenX >= -tileSize && screenX < this.canvas.width && 
                screenY >= -tileSize && screenY < this.canvas.height) {
                
                // Render player
                this.ctx.fillStyle = isLocalPlayer ? '#00bfff' : '#4299e1';
                this.ctx.fillRect(screenX + 5, screenY + 5, tileSize - 10, tileSize - 10);
                
                // Render name
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(player.name, screenX + tileSize/2, screenY - 5);
            }
        }
    }
    
    /**
     * Show combat UI
     */
    showCombatUI() {
        // TODO: Implement combat UI
        console.log('⚔️ Entering combat mode');
    }
    
    /**
     * Hide combat UI
     */
    hideCombatUI() {
        // TODO: Hide combat UI
        console.log('🏃 Exiting combat mode');
    }
    
    /**
     * Resize canvas
     */
    resizeCanvas() {
        if (!this.canvas) return;
        
        const container = this.canvas.parentElement;
        if (container) {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
        }
        
        // Update camera dimensions
        this.camera.width = Math.floor(this.canvas.width / 40);
        this.camera.height = Math.floor(this.canvas.height / 40);
    }
    
    /**
     * Disconnect from SpacetimeDB
     */
    disconnect() {
        if (this.client) {
            this.client.call("player_disconnect");
            this.client.disconnect();
            this.isConnected = false;
            console.log('👋 Disconnected from SpacetimeDB');
        }
    }
}

// Make globally available
window.SpacetimeGame = SpacetimeGame;

export default SpacetimeGame;