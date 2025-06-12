// scripts/migratePasswords.js
// Script to migrate existing plaintext passwords to bcrypt hashes

const bcrypt = require('bcrypt');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');

const SALT_ROUNDS = 12;

async function migratePasswords() {
    console.log('🔐 Starting password migration...');
    
    try {
        // Load users database
        const usersDbPath = path.join(__dirname, '../data/users.json');
        const adapter = new JSONFile(usersDbPath);
        const db = new Low(adapter, { users: [] });
        await db.read();
        
        console.log(`📊 Found ${db.data.users.length} users to process`);
        
        let migratedCount = 0;
        let skippedCount = 0;
        
        for (const user of db.data.users) {
            if (user.needsPasswordRehash && user.password) {
                console.log(`🔄 Migrating password for user: ${user.login}`);
                
                try {
                    // Hash the plaintext password
                    const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
                    
                    // Update user record
                    user.password = hashedPassword;
                    user.needsPasswordRehash = false;
                    user.passwordMigrated = true;
                    user.passwordMigratedAt = new Date().toISOString();
                    
                    migratedCount++;
                    console.log(`✅ Password migrated for: ${user.login}`);
                    
                } catch (error) {
                    console.error(`❌ Failed to migrate password for ${user.login}:`, error);
                }
            } else if (!user.needsPasswordRehash) {
                skippedCount++;
                console.log(`⏭️  Skipping ${user.login} (already migrated)`);
            } else {
                console.log(`⚠️  Skipping ${user.login} (no password found)`);
                skippedCount++;
            }
        }
        
        // Save the updated database
        await db.write();
        
        console.log('\n📈 Migration Summary:');
        console.log(`✅ Migrated: ${migratedCount} users`);
        console.log(`⏭️  Skipped: ${skippedCount} users`);
        console.log(`📊 Total: ${db.data.users.length} users`);
        console.log('\n🎉 Password migration completed successfully!');
        
    } catch (error) {
        console.error('💥 Password migration failed:', error);
        process.exit(1);
    }
}

// Run migration if this script is executed directly
if (require.main === module) {
    migratePasswords()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Migration error:', error);
            process.exit(1);
        });
}

module.exports = { migratePasswords };
