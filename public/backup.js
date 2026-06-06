const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const timestamp = new Date().toISOString().slice(0,19).replace(/:/g, '-');
const filename = `manual_backup_${timestamp}.sql`;
const backupPath = path.join(__dirname, 'backups', filename);

// Create backups directory if not exists
if (!fs.existsSync(path.join(__dirname, 'backups'))) {
    fs.mkdirSync(path.join(__dirname, 'backups'));
}

const mysqldump = `mysqldump -u ${process.env.DB_USER || 'root'} -p${process.env.DB_PASSWORD || ''} ${process.env.DB_NAME || 'barbershop_db'} > "${backupPath}"`;

console.log('🔄 Creating database backup...');

exec(mysqldump, (error) => {
    if (error) {
        console.error('❌ Backup failed:', error.message);
    } else {
        const stats = fs.statSync(backupPath);
        console.log(`✅ Backup saved: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);
    }
});