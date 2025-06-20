import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';

let prisma: PrismaClient;
let databaseUrl: string;

export const setupTestDatabase = async () => {
  // Generate a unique database name for this test run
  const dbName = `evolution_test_${randomBytes(8).toString('hex')}`;
  
  // Use environment variable or default test database URL
  const baseUrl = process.env.DATABASE_CONNECTION_URI || 'postgresql://postgres:password@localhost:5432';
  databaseUrl = `${baseUrl.split('/').slice(0, -1).join('/')}/${dbName}`;
  
  // Set the database URL for Prisma
  process.env.DATABASE_URL = databaseUrl;
  
  try {
    // Create the test database
    const createDbUrl = baseUrl.split('/').slice(0, -1).join('/') + '/postgres';
    execSync(`npx prisma db execute --url="${createDbUrl}" --stdin <<< "CREATE DATABASE ${dbName};"`, {
      stdio: 'pipe',
    });
    
    // Initialize Prisma client
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
    
    // Run migrations
    execSync(`npx prisma migrate deploy`, {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });
    
    await prisma.$connect();
    
    return prisma;
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
};

export const teardownTestDatabase = async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
  
  if (databaseUrl) {
    try {
      const dbName = databaseUrl.split('/').pop();
      const baseUrl = databaseUrl.split('/').slice(0, -1).join('/') + '/postgres';
      
      // Drop the test database
      execSync(`npx prisma db execute --url="${baseUrl}" --stdin <<< "DROP DATABASE IF EXISTS ${dbName};"`, {
        stdio: 'pipe',
      });
    } catch (error) {
      console.error('Failed to cleanup test database:', error);
    }
  }
};

export const getTestPrismaClient = () => {
  if (!prisma) {
    throw new Error('Test database not initialized. Call setupTestDatabase first.');
  }
  return prisma;
};

export const clearTestDatabase = async () => {
  if (!prisma) return;
  
  // Clear all tables in reverse order of dependencies
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `;
  
  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations') {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
    }
  }
};

// Helper function to seed test data
export const seedTestData = async () => {
  if (!prisma) return;
  
  // Create a test instance
  const testInstance = await prisma.instance.create({
    data: {
      id: 'test-instance-id',
      name: 'test-instance',
      token: 'test-token',
      integration: 'WHATSAPP-BAILEYS',
      status: 'open',
      ownerJid: '5511999999999@s.whatsapp.net',
      profileName: 'Test Profile',
      number: '5511999999999',
    },
  });
  
  // Create test settings
  await prisma.setting.create({
    data: {
      instanceId: testInstance.id,
      rejectCall: false,
      msgCall: 'Call rejected',
      groupsIgnore: false,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
    },
  });
  
  return { testInstance };
};
