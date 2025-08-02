const { MongoClient } = require('mongodb');
require('dotenv').config();

const atlasUri = 'mongodb+srv://Amit_test:Aa123456789@cluster0.fur2sj9.mongodb.net/soulcircle';

async function testAtlasConnectionWithOptions() {
  console.log('Testing MongoDB Atlas connection with various options...');
  
  // Test with different connection options
  const connectionOptions = [
    {
      name: 'Default options',
      options: {}
    },
    {
      name: 'With timeout and retry settings',
      options: {
        connectTimeoutMS: 30000,
        socketTimeoutMS: 30000,
        serverSelectionTimeoutMS: 30000,
        retryWrites: true,
        retryReads: true
      }
    },
    {
      name: 'With SSL options',
      options: {
        ssl: true,
        sslValidate: true,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 30000
      }
    }
  ];

  for (const config of connectionOptions) {
    console.log(`\n--- Testing: ${config.name} ---`);
    
    const client = new MongoClient(atlasUri, config.options);
    
    try {
      console.log('Attempting to connect...');
      await client.connect();
      console.log('✅ Connected successfully with', config.name);
      
      const db = client.db('soulcircle');
      const ping = await db.admin().ping();
      console.log('✅ Ping successful:', ping);
      
      await client.close();
      console.log('✅ Connection closed successfully');
      return; // If we succeed, no need to try other options
      
    } catch (error) {
      console.error('❌ Failed with', config.name);
      console.error('Error:', error.message);
      console.error('Code:', error.code || 'unknown');
      
      try {
        await client.close();
      } catch (closeError) {
        // Ignore close errors
      }
    }
  }
}

// Test with direct IP if hostname resolution fails
async function testWithDirectConnection() {
  console.log('\n--- Testing direct connection troubleshooting ---');
  
  // Alternative connection strings to try
  const alternativeUris = [
    // Try with different options
    'mongodb+srv://Amit_Dev:Winnerlooser0192@cluster0.fur2sj9.mongodb.net/soulcircle?retryWrites=true&w=majority',
    // Try with authSource
    'mongodb+srv://Amit_Dev:Winnerlooser0192@cluster0.fur2sj9.mongodb.net/soulcircle?authSource=admin',
    // Try with all options
    'mongodb+srv://Amit_Dev:Winnerlooser0192@cluster0.fur2sj9.mongodb.net/soulcircle?retryWrites=true&w=majority&authSource=admin'
  ];
  
  for (const uri of alternativeUris) {
    console.log(`\nTrying URI: ${uri.replace(/Winnerlooser0192/, '****')}`);
    
    const client = new MongoClient(uri, {
      connectTimeoutMS: 10000,
      socketTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000
    });
    
    try {
      await client.connect();
      console.log('✅ Connection successful!');
      
      const db = client.db('soulcircle');
      const collections = await db.listCollections().toArray();
      console.log('Collections:', collections.map(c => c.name));
      
      await client.close();
      return uri; // Return successful URI
      
    } catch (error) {
      console.error('❌ Failed:', error.message);
      try {
        await client.close();
      } catch (closeError) {
        // Ignore
      }
    }
  }
  
  return null;
}

// Check network and firewall issues
function checkNetworkIssues() {
  console.log('\n--- Network Troubleshooting Tips ---');
  console.log('1. Check if you\'re behind a corporate firewall');
  console.log('2. Try connecting from a different network (mobile hotspot)');
  console.log('3. Check MongoDB Atlas IP whitelist settings');
  console.log('4. Verify your internet connection');
  console.log('5. Try using MongoDB Compass to test the connection');
  console.log('\nCommon solutions:');
  console.log('- Add 0.0.0.0/0 to MongoDB Atlas IP whitelist for testing');
  console.log('- Check if port 27017 is blocked by firewall');
  console.log('- Ensure your ISP doesn\'t block MongoDB ports');
}

async function runAllTests() {
  await testAtlasConnectionWithOptions();
  const successfulUri = await testWithDirectConnection();
  
  if (!successfulUri) {
    checkNetworkIssues();
  } else {
    console.log('\n✅ Found working connection string:', successfulUri.replace(/Winnerlooser0192/, '****'));
  }
}

runAllTests();
