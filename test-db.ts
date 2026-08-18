import { db } from './server/db.js';
import { users } from '@shared/schema';

async function testDb() {
  try {
    console.log('Testing database connection...');
    const allUsers = await db.select().from(users);
    console.log('Database query successful!');
    console.log('Users found:', allUsers.length);
    console.log('Users:', JSON.stringify(allUsers, null, 2));
  } catch (error) {
    console.error('Database query failed:', error);
  }
  process.exit(0);
}

testDb();
