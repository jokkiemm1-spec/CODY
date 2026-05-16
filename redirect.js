// redirect.js - Run this before main bot
const fs = require('fs');
const path = require('path');

if (process.env.RENDER && fs.existsSync('/app/database')) {
    const LOCAL_DB = './database';
    const PERSISTENT_DB = '/app/database';
    
    try {
        if (fs.existsSync(LOCAL_DB)) {
            const stat = fs.lstatSync(LOCAL_DB);
            if (!stat.isSymbolicLink()) {
                // Copy existing data
                if (fs.readdirSync(LOCAL_DB).length > 0) {
                    const files = fs.readdirSync(LOCAL_DB);
                    for (const file of files) {
                        const src = path.join(LOCAL_DB, file);
                        const dest = path.join(PERSISTENT_DB, file);
                        if (fs.existsSync(src) && !fs.existsSync(dest)) {
                            fs.copyFileSync(src, dest);
                        }
                    }
                }
                fs.rmSync(LOCAL_DB, { recursive: true, force: true });
            }
        }
        
        if (!fs.existsSync(LOCAL_DB)) {
            fs.symlinkSync(PERSISTENT_DB, LOCAL_DB, 'dir');
            console.log('✅ Database linked to persistent storage');
        }
    } catch (err) {
        console.log('⚠️ Redirect error:', err.message);
    }
}

if (!fs.existsSync('./database')) {
    fs.mkdirSync('./database', { recursive: true });
}
