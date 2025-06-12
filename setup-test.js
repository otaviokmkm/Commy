// Copy index.html to public folder for test server
const fs = require('fs');
const path = require('path');

// Create public folder if it doesn't exist
if (!fs.existsSync('public')) {
    fs.mkdirSync('public');
}

// Copy the HTML file
const htmlPath = path.join('nodejs-mmorpg', 'public', 'index.html');
const destPath = path.join('public', 'index.html');

if (fs.existsSync(htmlPath)) {
    fs.copyFileSync(htmlPath, destPath);
    console.log('✅ Copied client to public/index.html');
} else {
    console.log('❌ Source file not found:', htmlPath);
}

console.log('🧪 Test setup complete. Run test-enemies.bat to start testing.');