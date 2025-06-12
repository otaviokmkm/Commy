# 🏰 Commy Revamped MMORPG
## Powered by SpacetimeDB

A professional multiplayer online role-playing game built with SpacetimeDB for real-time synchronization and free cloud hosting.

## ✨ Features

- 🌍 **200x200 Open World** - Massive explorable world
- 👥 **Real-time Multiplayer** - See other players moving live
- 👹 **Enemy System** - 50+ AI enemies with combat
- ⚔️ **Combat System** - Click-to-attack gameplay
- 🗺️ **Map System** - Procedurally generated terrain
- 🎮 **Professional UI** - Clean, responsive interface
- ☁️ **Free Hosting** - Powered by SpacetimeDB cloud
- 📱 **Web-based** - Play in any modern browser

## 🚀 Quick Start

### 1. Automated Setup (Recommended)
```bash
# Run the setup script (Windows)
setup.bat
```

### 2. Manual Setup

#### Install SpacetimeDB CLI
```powershell
# PowerShell (as Administrator)
Invoke-WebRequest -Uri "https://github.com/clockworklabs/SpacetimeDB/releases/latest/download/spacetimedb-cli-windows-amd64.zip" -OutFile "$env:TEMP\spacetimedb.zip"
Expand-Archive "$env:TEMP\spacetimedb.zip" -DestinationPath "C:\spacetimedb" -Force
[Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";C:\spacetimedb", "Machine")
```

#### Create Account & Deploy
```bash
# Register for free SpacetimeDB account
spacetime register

# Login
spacetime login

# Deploy your game
deploy.bat
```

### 3. Play Your Game
1. Open `spacetimedb-client.html` in your browser
2. Enter your player name
3. Enter the database address from deployment
4. Click "Join Game"
5. Press 'I' to initialize the world (first time only)

## 🎮 How to Play

### Controls
- **WASD / Arrow Keys** - Move your character
- **Mouse Click** - Attack enemies
- **I Key** - Initialize map (admin command)

### Game Mechanics
- Move around the 200x200 world
- Find and battle enemies (red squares)
- Gain experience and gold from combat
- Explore different terrains and obstacles

## 🛠️ Development

### Project Structure
```
Commy Revamped/
├── spacetimedb/           # Server-side SpacetimeDB module
│   ├── src/
│   │   └── lib.rs        # Main game logic (Rust)
│   ├── Cargo.toml        # Rust dependencies
│   └── spacetime.toml    # SpacetimeDB configuration
├── public/js/            # Client-side JavaScript
│   └── SpacetimeGame.js  # Main game client
├── spacetimedb-client.html # Game client interface
├── setup.bat             # Automated setup script
└── deploy.bat            # Deployment script
```

### Technology Stack
- **Backend**: SpacetimeDB (Rust)
- **Frontend**: HTML5 Canvas + JavaScript
- **Database**: SpacetimeDB (built-in)
- **Hosting**: SpacetimeDB Cloud (free)
- **Real-time**: SpacetimeDB WebSocket (automatic)

### Adding Features

#### Add New Enemy Types
Edit `spacetimedb/src/lib.rs`:
```rust
// In the init_map reducer, add different enemy types
Enemy::insert(Enemy {
    id: i + 100,
    name: format!("Dragon {}", i + 1),
    hp: 200,  // Stronger enemy
    max_hp: 200,
    // ... other properties
})?;
```

#### Add New Map Types
```rust
// Create new map layouts
for y in 0..200 {
    for x in 0..200 {
        let tile_type = match (x, y) {
            _ if x < 50 => 2,  // Forest area
            _ if x > 150 => 3, // Desert area
            _ => 0,            // Grass area
        };
        // ... insert tile
    }
}
```

## 🔧 Administration

### Database Management
```bash
# View your databases
spacetime list

# Monitor real-time logs
spacetime logs <your-database-address>

# Reset database (careful!)
spacetime delete <your-database-address>
```

### Monitoring
- **Player Count**: Check the sidebar in-game
- **Server Logs**: Use `spacetime logs` command
- **Performance**: SpacetimeDB handles scaling automatically

## 🌟 Advantages Over Traditional Servers

| Feature | Traditional Setup | SpacetimeDB |
|---------|------------------|-------------|
| **Cost** | $10-50/month | Free |
| **Setup Time** | Hours/Days | Minutes |
| **Scalability** | Manual scaling | Automatic |
| **Database** | Separate setup | Built-in |
| **Real-time Sync** | Complex Socket.IO | Automatic |
| **Deployment** | Manual server management | One command |
| **Monitoring** | Custom logging | Built-in tools |

## 🐛 Troubleshooting

### Common Issues

#### "spacetime command not found"
- Restart your terminal after installation
- Check PATH environment variable
- Try reinstalling SpacetimeDB CLI

#### "Build failed"
- Ensure Rust is installed (SpacetimeDB handles this)
- Check `spacetimedb/src/lib.rs` for syntax errors
- Run `spacetime build` manually for detailed errors

#### "Connection failed in browser"
- Verify database address is correct
- Check if the database is published: `spacetime list`
- Try refreshing the browser

#### "No enemies visible"
- Press 'I' key to initialize the map
- Check browser console for errors
- Verify you're connected to the right database

## 📚 Learning Resources

- [SpacetimeDB Documentation](https://spacetimedb.com/docs)
- [Rust Programming Language](https://doc.rust-lang.org/)
- [HTML5 Canvas Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)

## 🤝 Contributing

1. Fork the project
2. Create your feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🎯 Roadmap

- [ ] **Inventory System** - Items and equipment
- [ ] **Skill Trees** - Character progression
- [ ] **Guilds** - Player organizations
- [ ] **PvP Combat** - Player vs player battles
- [ ] **Quests** - NPC-given missions
- [ ] **Trading** - Player marketplace
- [ ] **Dungeons** - Instanced content
- [ ] **Mobile Support** - Touch controls

---

**Built with ❤️ using SpacetimeDB**

For support, questions, or feature requests, please open an issue or contact the development team.