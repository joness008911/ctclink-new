import { Client } from 'pg';

async function testConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('Attempting to connect...');
    await client.connect();
    console.log('Connected! Running query...');
    const result = await client.query('SELECT NOW()');
    console.log('Query successful:', result.rows);
    await client.end();
    console.log('Connection closed successfully');
  } catch (error) {
    console.error('Connection failed:', error);
  }
  process.exit(0);
}

testConnection();
