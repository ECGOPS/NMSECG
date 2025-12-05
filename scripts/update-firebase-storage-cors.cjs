require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const admin = require('firebase-admin');
const path = require('path');

// Firebase project configuration
const FIREBASE_PROJECT_ID = 'omss-30595';
const DEFAULT_STORAGE_BUCKET = `${FIREBASE_PROJECT_ID}.firebasestorage.app`;

// Initialize Firebase Admin SDK (same as check script)
function initializeFirebase() {
  try {
    if (admin.apps.length > 0) {
      return admin.app();
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID
      });
      return admin.app();
    }

    try {
      const serviceAccount = require('../service-account.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID
      });
      return admin.app();
    } catch (fileError) {
      // Continue to next method
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT_FILE) {
      const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_FILE);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID
      });
      return admin.app();
    }

    admin.initializeApp({
      projectId: FIREBASE_PROJECT_ID
    });
    return admin.app();
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error.message);
    throw error;
  }
}

// Get current CORS configuration
async function getCurrentCORS(bucketName) {
  try {
    const bucket = admin.storage().bucket(bucketName);
    const [metadata] = await bucket.getMetadata();
    return metadata.cors || [];
  } catch (error) {
    console.error('❌ Error getting current CORS:', error.message);
    throw error;
  }
}

// Update Firebase Storage bucket CORS configuration
async function updateFirebaseStorageCORS(newOrigin, bucketName = null) {
  try {
    console.log('🔄 Updating Firebase Storage bucket CORS configuration...\n');
    
    // Initialize Firebase
    initializeFirebase();
    
    // Get bucket name
    const storageBucketName = bucketName || 
                              process.env.FIREBASE_STORAGE_BUCKET || 
                              process.env.VITE_FIREBASE_STORAGE_BUCKET ||
                              DEFAULT_STORAGE_BUCKET;
    
    console.log(`📦 Target Bucket: ${storageBucketName}`);
    console.log(`➕ Adding Origin: ${newOrigin}\n`);
    
    // Get current CORS configuration
    const currentCORS = await getCurrentCORS(storageBucketName);
    console.log(`📋 Current CORS Rules: ${currentCORS.length}\n`);
    
    // Normalize the origin (remove trailing slash)
    const normalizedOrigin = newOrigin.replace(/\/$/, '');
    
    // Check if origin already exists
    let originExists = false;
    let updatedRules = currentCORS.map(rule => {
      if (rule.origin && Array.isArray(rule.origin)) {
        if (rule.origin.includes(normalizedOrigin)) {
          originExists = true;
          console.log(`✅ Origin already exists in rule with origins: ${rule.origin.join(', ')}`);
        }
        return rule;
      } else if (rule.origin && typeof rule.origin === 'string') {
        if (rule.origin === normalizedOrigin) {
          originExists = true;
          console.log(`✅ Origin already exists in rule`);
        }
        return rule;
      }
      return rule;
    });
    
    if (originExists) {
      console.log(`\n⚠️  Origin ${normalizedOrigin} is already configured.`);
      console.log('   No changes needed.\n');
      return { updated: false, cors: updatedRules };
    }
    
    // Determine which rule to update (production or development)
    const isProductionOrigin = normalizedOrigin.startsWith('https://') && 
                                !normalizedOrigin.includes('localhost');
    
    let ruleUpdated = false;
    
    // Try to add to existing production rule
    if (isProductionOrigin) {
      updatedRules = updatedRules.map(rule => {
        // Check if this is a production rule (has https origins, no localhost)
        const hasProductionOrigins = rule.origin && 
          Array.isArray(rule.origin) && 
          rule.origin.some(origin => origin.startsWith('https://') && !origin.includes('localhost'));
        
        if (hasProductionOrigins && !ruleUpdated) {
          rule.origin.push(normalizedOrigin);
          rule.origin = [...new Set(rule.origin)]; // Remove duplicates
          ruleUpdated = true;
          console.log(`✅ Added to existing production rule`);
          return rule;
        }
        return rule;
      });
    } else {
      // Try to add to existing development rule
      updatedRules = updatedRules.map(rule => {
        const hasDevOrigins = rule.origin && 
          Array.isArray(rule.origin) && 
          rule.origin.some(origin => origin.includes('localhost'));
        
        if (hasDevOrigins && !ruleUpdated) {
          rule.origin.push(normalizedOrigin);
          rule.origin = [...new Set(rule.origin)]; // Remove duplicates
          ruleUpdated = true;
          console.log(`✅ Added to existing development rule`);
          return rule;
        }
        return rule;
      });
    }
    
    // If no existing rule matched, create a new rule
    if (!ruleUpdated) {
      const newRule = {
        origin: [normalizedOrigin],
        method: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        responseHeader: ['Content-Type', 'Access-Control-Allow-Origin', 'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers'],
        maxAgeSeconds: 3600
      };
      updatedRules.push(newRule);
      console.log(`✅ Created new CORS rule for origin: ${normalizedOrigin}`);
    }
    
    // Update the bucket CORS configuration
    const bucket = admin.storage().bucket(storageBucketName);
    await bucket.setCorsConfiguration(updatedRules);
    
    console.log('\n✅ CORS configuration updated successfully!\n');
    
    // Display updated configuration
    console.log('📋 Updated CORS Configuration:\n');
    updatedRules.forEach((rule, index) => {
      console.log(`📋 CORS Rule ${index + 1}:`);
      console.log(`   Origins: ${rule.origin ? rule.origin.join(', ') : 'N/A'}`);
      console.log(`   Methods: ${rule.method ? rule.method.join(', ') : 'N/A'}`);
      console.log(`   Response Headers: ${rule.responseHeader ? rule.responseHeader.join(', ') : 'N/A'}`);
      console.log(`   Max Age: ${rule.maxAgeSeconds ? rule.maxAgeSeconds + ' seconds' : 'N/A'}`);
      console.log('');
    });
    
    return { updated: true, cors: updatedRules };
    
  } catch (error) {
    console.error('❌ Error updating Firebase Storage CORS:', error.message);
    console.error('   Stack:', error.stack);
    
    if (error.code === 403) {
      console.log('\n💡 Permission denied. Make sure your service account has "Storage Admin" role.');
    } else if (error.code === 404) {
      console.log('\n💡 Bucket not found. Check if the bucket name is correct.');
    }
    
    throw error;
  }
}

// Main execution
async function main() {
  try {
    const origin = process.argv[2];
    const bucketName = process.argv[3] || null;
    
    if (!origin) {
      console.log('❌ Missing origin parameter');
      console.log('\nUsage:');
      console.log('  node scripts/update-firebase-storage-cors.cjs <origin> [bucket-name]');
      console.log('\nExamples:');
      console.log('  node scripts/update-firebase-storage-cors.cjs https://nms.ecggh.org');
      console.log('  node scripts/update-firebase-storage-cors.cjs https://nms.ecggh.org omss-30595.firebasestorage.app');
      process.exit(1);
    }
    
    const result = await updateFirebaseStorageCORS(origin, bucketName);
    
    if (result.updated) {
      console.log('✅ Update complete!');
    } else {
      console.log('ℹ️  No update needed - origin already exists.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { updateFirebaseStorageCORS, initializeFirebase };

