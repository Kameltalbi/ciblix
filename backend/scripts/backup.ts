import { PrismaClient } from '@prisma/client';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execFileAsync = promisify(execFile);
const prisma = new PrismaClient();

const BACKUP_DIR = process.env.BACKUP_DIR || '/var/backups/crm';
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.sql`);

  console.log(`Starting backup at ${new Date().toISOString()}`);
  
  try {
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Get database URL from environment
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not set');
    }

    // Extract connection details
    const url = new URL(dbUrl);
    const host = url.hostname;
    const port = url.port || '5432';
    const database = url.pathname.slice(1);
    const user = url.username;
    const password = url.password;

    // Create PostgreSQL dump (using execFile to avoid shell injection)
    await execFileAsync('pg_dump', ['-h', host, '-p', port, '-U', user, '-d', database, '-F', 'c', '-f', backupPath], {
      env: { ...process.env, PGPASSWORD: password },
    });

    console.log(`Backup completed: ${backupPath}`);

    // Compress backup
    const compressedPath = `${backupPath}.gz`;
    await execFileAsync('gzip', [backupPath]);
    console.log(`Backup compressed: ${compressedPath}`);

    // Clean old backups
    await cleanOldBackups();

    // Log backup to database
    await prisma.backupLog.create({
      data: {
        path: compressedPath,
        size: fs.statSync(compressedPath).size,
        status: 'SUCCESS',
      },
    });

    console.log('Backup process completed successfully');
  } catch (error) {
    console.error('Backup failed:', error);
    
    // Log failure to database
    try {
      await prisma.backupLog.create({
        data: {
          path: backupPath,
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    } catch (logError) {
      console.error('Failed to log backup error:', logError);
    }
    
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (!file.startsWith('backup-') || !file.endsWith('.gz')) continue;

      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > retentionMs) {
        fs.unlinkSync(filePath);
        console.log(`Deleted old backup: ${file}`);
      }
    }
  } catch (error) {
    console.error('Failed to clean old backups:', error);
  }
}

// Run backup if executed directly
if (require.main === module) {
  createBackup()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { createBackup, cleanOldBackups };
