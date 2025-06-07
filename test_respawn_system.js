/**
 * Test script to verify that the player respawn system works correctly
 * This test verifies that players spawn where they left off, not at default locations
 */

const puppeteer = require('puppeteer');

async function testPlayerRespawnSystem() {
    console.log('🎮 Starting Player Respawn System Test...\n');
    
    const browser = await puppeteer.launch({ 
        headless: false, // Show browser for visual verification
        slowMo: 1000 // Slow down actions for observation
    });
    
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });        // Navigate to the game
        console.log('📍 Navigating to game...');
        await page.goto('http://localhost:3000');
        await page.waitForSelector('#auth-modal', { timeout: 10000 });
        
        // Login with test user
        console.log('🔐 Logging in with test user...');
        await page.type('#login-username', 'testuser');
        await page.type('#login-password', 'testpass');
        await page.click('button[type="submit"]');
        
        // Wait for game to load
        console.log('⏳ Waiting for game to initialize...');
        await page.waitForFunction(() => {
            return window.gameInitialized === true;
        }, { timeout: 15000 });
        
        // Wait a bit more for the game to fully load
        await page.waitForTimeout(3000);
        
        // Get initial player position
        const initialPosition = await page.evaluate(() => {
            return {
                x: player.overworldX,
                y: player.overworldY,
                mapId: currentMapId
            };
        });
        console.log(`📍 Initial player position: x=${initialPosition.x}, y=${initialPosition.y}, map=${initialPosition.mapId}`);
        
        // Move player to a specific test position (100, 100)
        console.log('🚶 Moving player to test position (100, 100)...');
        await page.evaluate(() => {
            // Move player to position 100, 100
            player.overworldX = 100;
            player.overworldY = 100;
            cameraX = player.overworldX;
            cameraY = player.overworldY;
            
            // Save progress immediately
            saveProgress();
            console.log('💾 Progress saved at position:', player.overworldX, player.overworldY);
        });
        
        // Verify position was set
        const movedPosition = await page.evaluate(() => {
            return {
                x: player.overworldX,
                y: player.overworldY,
                mapId: currentMapId
            };
        });
        console.log(`✅ Player moved to: x=${movedPosition.x}, y=${movedPosition.y}, map=${movedPosition.mapId}`);
        
        // Refresh the page to simulate respawn
        console.log('🔄 Refreshing page to test respawn...');
        await page.reload();
        
        // Login again
        console.log('🔐 Logging in again after refresh...');
        await page.waitForSelector('#authModal', { timeout: 10000 });
        await page.type('#loginUsername', 'testuser');
        await page.type('#loginPassword', 'testpass');
        await page.click('#loginButton');
        
        // Wait for game to load again
        console.log('⏳ Waiting for game to reload...');
        await page.waitForFunction(() => {
            return window.gameInitialized === true;
        }, { timeout: 15000 });
        
        // Wait for position to be loaded from server
        await page.waitForTimeout(5000);
        
        // Get final player position after respawn
        const finalPosition = await page.evaluate(() => {
            return {
                x: player.overworldX,
                y: player.overworldY,
                mapId: currentMapId
            };
        });
        
        console.log(`📍 Final player position after respawn: x=${finalPosition.x}, y=${finalPosition.y}, map=${finalPosition.mapId}`);
        
        // Verify that player spawned at the saved position
        const positionMatches = (finalPosition.x === 100 && finalPosition.y === 100);
        
        if (positionMatches) {
            console.log('✅ SUCCESS: Player respawned at saved position!');
            console.log('🎉 The respawn system is working correctly.');
        } else {
            console.log('❌ FAILURE: Player did not respawn at saved position.');
            console.log(`Expected: x=100, y=100`);
            console.log(`Got: x=${finalPosition.x}, y=${finalPosition.y}`);
        }
        
        // Show results summary
        console.log('\n📊 Test Results:');
        console.log(`Initial Position: x=${initialPosition.x}, y=${initialPosition.y}`);
        console.log(`Moved To: x=${movedPosition.x}, y=${movedPosition.y}`);
        console.log(`Respawned At: x=${finalPosition.x}, y=${finalPosition.y}`);
        console.log(`Test Passed: ${positionMatches ? 'YES' : 'NO'}`);
        
        return positionMatches;
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
        return false;
    } finally {
        // Keep browser open for manual verification
        console.log('\n👀 Browser will remain open for manual verification.');
        console.log('Press Ctrl+C to close when done observing.');
        
        // Don't close browser automatically - let user observe
        // await browser.close();
    }
}

// Run the test
if (require.main === module) {
    testPlayerRespawnSystem()
        .then(success => {
            if (success) {
                console.log('\n🎯 Player respawn system test completed successfully!');
            } else {
                console.log('\n💥 Player respawn system test failed!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = testPlayerRespawnSystem;
