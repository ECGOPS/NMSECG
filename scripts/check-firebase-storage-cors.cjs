require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const admin = require('firebase-admin');
const path = require('path');

// Firebase project configuration
const FIREBASE_PROJECT_ID = 'omss-30595';
// Default Firebase Storage bucket name (usually [project-id].appspot.com)
const DEFAULT_STORAGE_BUCKET = `${FIREBASE_PROJECT_ID}.appspot.com`;

// Initialize Firebase Admin SDK
function initializeFirebase() {
  try {
    // Check if Firebase is already initialized
    if (admin.apps.length > 0) {
      console.log('Firebase already initialized');
      return admin.app();
    }

    // Try to initialize with service account key from environment
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID
      });
      console.log(`✅ Firebase initialized with service account for project: ${FIREBASE_PROJECT_ID}`);
      return admin.app();
    }

    // Try to initialize with service account file from root folder
    try {
      const serviceAccount = require('../service-account.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID
      });
      console.log(`✅ Firebase initialized with service account file for project: ${FIREBASE_PROJECT_ID}`);
      return admin.app();
    } catch (fileError) {
      console.log('⚠️  Service account file not found in root folder, trying other methods...');
    }

    // Try to initialize with service account file from environment
    if (process.env.FIREBASE_SERVICE_ACCOUNT_FILE) {
      const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_FILE);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID
      });
      console.log(`✅ Firebase initialized with service account file for project: ${FIREBASE_PROJECT_ID}`);
      return admin.app();
    }

    // Try to initialize with default credentials
    admin.initializeApp({
      projectId: FIREBASE_PROJECT_ID
    });
    console.log(`✅ Firebase initialized with default credentials for project: ${FIREBASE_PROJECT_ID}`);
    return admin.app();
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error.message);
    console.log('\nTo initialize Firebase, you need to:');
    console.log('1. Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable, or');
    console.log('2. Place service-account.json in the root folder, or');
    console.log('3. Set FIREBASE_SERVICE_ACCOUNT_FILE environment variable, or');
    console.log('4. Use Firebase CLI: firebase login');
    throw error;
  }
}

// List all available Firebase Storage buckets
async function listFirebaseStorageBuckets() {
  try {
    // Use Google Cloud Storage client to list buckets
    const { Storage } = require('@google-cloud/storage');
    
    // Get credentials from Firebase Admin
    const app = admin.app();
    const credential = app.options.credential;
    
    let storage;
    if (credential) {
      // Use Firebase Admin credentials
      storage = new Storage({
        projectId: FIREBASE_PROJECT_ID,
        keyFilename: credential.keyFilename || undefined,
        credentials: credential.keyFilename ? undefined : {
          client_email: credential.clientEmail,
          private_key: credential.privateKey
        }
      });
    } else {
      // Use default credentials
      storage = new Storage({
        projectId: FIREBASE_PROJECT_ID
      });
    }
    
    const [buckets] = await storage.getBuckets();
    
    console.log(`📦 Found ${buckets.length} bucket(s) in project ${FIREBASE_PROJECT_ID}:\n`);
    
    buckets.forEach((bucket, index) => {
      console.log(`   ${index + 1}. ${bucket.name}`);
    });
    
    return buckets.map(b => b.name);
  } catch (error) {
    console.error('❌ Error listing buckets:', error.message);
    console.log('\n💡 Trying alternative method...\n');
    
    // Fallback: try to get default bucket
    try {
      const defaultBucket = admin.storage().bucket();
      return [defaultBucket.name];
    } catch (fallbackError) {
      return [];
    }
  }
}

// Check Firebase Storage bucket CORS configuration
async function checkFirebaseStorageCORS(bucketName = null) {
  try {
    console.log('🔍 Checking Firebase Storage bucket CORS configuration...\n');
    
    // Initialize Firebase
    const app = initializeFirebase();
    
    // If no bucket name provided, try to list and use first one, or use default
    let storageBucketName = bucketName;
    
    if (!storageBucketName) {
      // Try environment variables first
      storageBucketName = process.env.FIREBASE_STORAGE_BUCKET || 
                          process.env.VITE_FIREBASE_STORAGE_BUCKET;
      
      // If still not found, list available buckets
      if (!storageBucketName) {
        console.log('📋 Listing available buckets...\n');
        const availableBuckets = await listFirebaseStorageBuckets();
        
        if (availableBuckets.length > 0) {
          storageBucketName = availableBuckets[0];
          console.log(`\n✅ Using first available bucket: ${storageBucketName}\n`);
        } else {
          // Fallback to default naming convention
          storageBucketName = DEFAULT_STORAGE_BUCKET;
          console.log(`\n⚠️  No buckets found, trying default: ${storageBucketName}\n`);
        }
      }
    }
    
    console.log(`🔍 Attempting to access bucket: ${storageBucketName}\n`);
    
    // Get the storage bucket
    const bucket = admin.storage().bucket(storageBucketName);
    const actualBucketName = bucket.name;
    
    console.log(`📦 Storage Bucket: ${actualBucketName}`);
    console.log(`📦 Project: ${FIREBASE_PROJECT_ID}\n`);
    
    // Get bucket metadata which includes CORS configuration
    const [metadata] = await bucket.getMetadata();
    
    console.log('📋 Bucket Metadata:');
    console.log(`   Location: ${metadata.location || 'N/A'}`);
    console.log(`   Storage Class: ${metadata.storageClass || 'N/A'}`);
    console.log(`   Created: ${metadata.timeCreated || 'N/A'}`);
    console.log(`   Updated: ${metadata.updated || 'N/A'}\n`);
    
    // Check CORS configuration
    if (metadata.cors && metadata.cors.length > 0) {
      console.log(`✅ CORS Configuration Found (${metadata.cors.length} rule(s)):\n`);
      
      metadata.cors.forEach((corsRule, index) => {
        console.log(`📋 CORS Rule ${index + 1}:`);
        console.log(`   Origins: ${corsRule.origin ? corsRule.origin.join(', ') : 'N/A'}`);
        console.log(`   Methods: ${corsRule.method ? corsRule.method.join(', ') : 'N/A'}`);
        console.log(`   Response Headers: ${corsRule.responseHeader ? corsRule.responseHeader.join(', ') : 'N/A'}`);
        console.log(`   Max Age: ${corsRule.maxAgeSeconds ? corsRule.maxAgeSeconds + ' seconds' : 'N/A'}`);
        console.log('');
      });
      
      // Summary
      console.log('📊 CORS Summary:');
      const allOrigins = new Set();
      const allMethods = new Set();
      
      metadata.cors.forEach(rule => {
        if (rule.origin) {
          rule.origin.forEach(origin => allOrigins.add(origin));
        }
        if (rule.method) {
          rule.method.forEach(method => allMethods.add(method));
        }
      });
      
      console.log(`   Total Allowed Origins: ${allOrigins.size}`);
      Array.from(allOrigins).forEach(origin => {
        console.log(`     - ${origin}`);
      });
      
      console.log(`\n   Total Allowed Methods: ${allMethods.size}`);
      Array.from(allMethods).forEach(method => {
        console.log(`     - ${method}`);
      });
      
    } else {
      console.log('⚠️  No CORS configuration found for this bucket.');
      console.log('   This means CORS is not explicitly configured.');
      console.log('   Firebase Storage may use default CORS settings.\n');
    }
    
    // Check IAM permissions
    try {
      const [iamPolicy] = await bucket.iam.getPolicy();
      console.log('🔐 IAM Policy:');
      console.log(`   Bindings: ${iamPolicy.bindings ? iamPolicy.bindings.length : 0}`);
      if (iamPolicy.bindings && iamPolicy.bindings.length > 0) {
        iamPolicy.bindings.forEach((binding, index) => {
          console.log(`   ${index + 1}. Role: ${binding.role}`);
          console.log(`      Members: ${binding.members ? binding.members.join(', ') : 'N/A'}`);
        });
      }
      console.log('');
    } catch (iamError) {
      console.log('⚠️  Could not retrieve IAM policy:', iamError.message);
    }
    
    // Recommendations
    console.log('💡 Recommendations:');
    console.log('   To configure CORS, you can:');
    console.log('   1. Use Firebase Console: Storage → Settings → CORS');
    console.log('   2. Use Google Cloud Console: Cloud Storage → Buckets → [bucket] → Permissions → CORS');
    console.log('   3. Use gsutil: gsutil cors set cors.json gs://' + bucketName);
    console.log('   4. Use Firebase Admin SDK programmatically\n');
    
    return {
      bucketName: actualBucketName,
      cors: metadata.cors || [],
      hasCors: metadata.cors && metadata.cors.length > 0
    };
    
  } catch (error) {
    console.error('❌ Error checking Firebase Storage CORS:', error.message);
    console.error('   Stack:', error.stack);
    
    if (error.code === 403) {
      console.log('\n💡 This might be a permissions issue.');
      console.log('   Make sure your service account has "Storage Admin" or "Storage Object Viewer" role.');
    } else if (error.code === 404) {
      console.log('\n💡 Bucket not found. Check if the bucket name is correct.');
    }
    
    throw error;
  }
}

// Main execution
async function main() {
  try {
    const command = process.argv[2];
    
    // Handle 'list' command
    if (command === 'list') {
      initializeFirebase();
      await listFirebaseStorageBuckets();
      process.exit(0);
      return;
    }
    
    // Get bucket name from command line argument if provided
    const bucketName = command || null;
    
    if (bucketName && bucketName !== 'list') {
      console.log(`📦 Checking specified bucket: ${bucketName}\n`);
    }
    
    const result = await checkFirebaseStorageCORS(bucketName);
    
    console.log('✅ Check complete!');
    console.log(`\n📊 Result: ${result.hasCors ? 'CORS configured' : 'No CORS configuration found'}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    
    if (error.code === 404) {
      console.log('\n💡 The bucket does not exist. Try:');
      console.log('   1. List available buckets: node scripts/check-firebase-storage-cors.cjs list');
      console.log('   2. Specify bucket name: node scripts/check-firebase-storage-cors.cjs <bucket-name>');
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { checkFirebaseStorageCORS, initializeFirebase, listFirebaseStorageBuckets };

