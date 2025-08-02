const { MongoClient } = require('mongodb');
require('dotenv').config();

const atlasUri = 'mongodb+srv://Amit_test:Aa123456789@cluster0.fur2sj9.mongodb.net/?authSource=admin';

async function testAtlasConnection() {
  console.log('Testing MongoDB Atlas connection...');
  console.log('URI:', atlasUri);
  
  const client = new MongoClient(atlasUri);
  
  try {
    console.log('Attempting to connect...');
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas successfully');
    
    // Test database access
    const db = client.db('soulcircle');
    console.log('✅ Database access successful');
    
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(col => col.name));
    
    // Test a simple operation
    const testCollection = db.collection('test');
    const writeResult = await testCollection.insertOne({ 
      test: true, 
      timestamp: new Date(),
      message: 'Connection test from Node.js'
    });
    console.log('✅ Test write operation successful. Inserted ID:', writeResult.insertedId);
    
    const testDoc = await testCollection.findOne({ test: true });
    console.log('✅ Test read operation successful:', testDoc);
    
    // Clean up test document
    await testCollection.deleteOne({ _id: writeResult.insertedId });
    console.log('✅ Test cleanup successful');
    
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB Atlas:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    if (error.codeName) {
      console.error('Error code name:', error.codeName);
    }
  } finally {
    try {
      await client.close();
      console.log('Connection closed');
    } catch (closeError) {
      console.error('Error closing connection:', closeError.message);
    }
  }
}

// Also test environment variable approach
async function testWithEnvVar() {
  console.log('\n--- Testing with environment variable ---');
  const envUri = process.env.MONGODB_URI_PROD;
  
  if (!envUri) {
    console.log('❌ MONGODB_URI_PROD not found in environment variables');
    return;
  }
  
  console.log('Environment URI found:', envUri);
  
  const client = new MongoClient(envUri);
  
  try {
    await client.connect();
    console.log('✅ Connected using environment variable successfully');
    
    const db = client.db('soulcircle');
    const serverStatus = await db.admin().ping();
    console.log('✅ Server ping successful:', serverStatus);
    
  } catch (error) {
    console.error('❌ Failed with environment variable:', error.message);
  } finally {
    await client.close();
  }
}

// Run both tests
async function runAllTests() {
  await testAtlasConnection();
  await testWithEnvVar();
}

runAllTests();
