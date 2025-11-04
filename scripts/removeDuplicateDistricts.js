import { CosmosClient } from '@azure/cosmos';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'districts';

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

async function removeDuplicateDistricts() {
  try {
    console.log('🔍 Starting duplicate district removal process...');
    
    // Get all districts
    console.log('📥 Fetching all districts from Cosmos DB...');
    const { resources: districts } = await container.items.query('SELECT * FROM c').fetchAll();
    console.log(`📊 Found ${districts.length} total districts`);
    
    // Group districts by name and regionId to identify duplicates
    const groupedDistricts = {};
    const duplicates = [];
    
    districts.forEach(district => {
      const key = `${district.name}-${district.regionId}`;
      if (!groupedDistricts[key]) {
        groupedDistricts[key] = [];
      }
      groupedDistricts[key].push(district);
    });
    
    // Find duplicates
    Object.entries(groupedDistricts).forEach(([key, districtList]) => {
      if (districtList.length > 1) {
        console.log(`🔍 Found ${districtList.length} duplicates for: ${key}`);
        duplicates.push({
          key,
          districts: districtList
        });
      }
    });
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate districts found!');
      return;
    }
    
    console.log(`\n📋 Found ${duplicates.length} groups of duplicate districts:`);
    duplicates.forEach((group, index) => {
      console.log(`\n${index + 1}. ${group.key}:`);
      group.districts.forEach((district, dIndex) => {
        console.log(`   ${dIndex + 1}. ID: ${district.id}, Created: ${district.createdAt || 'N/A'}`);
      });
    });
    
    // Remove duplicates (keep the first one, delete the rest)
    console.log('\n🗑️  Removing duplicate districts...');
    let removedCount = 0;
    
    for (const group of duplicates) {
      const districtsToKeep = group.districts[0]; // Keep the first one
      const districtsToRemove = group.districts.slice(1); // Remove the rest
      
      console.log(`\n📝 Keeping district: ${districtsToKeep.id} (${districtsToKeep.name})`);
      
      for (const districtToRemove of districtsToRemove) {
        try {
          console.log(`🗑️  Deleting duplicate: ${districtToRemove.id} (${districtToRemove.name})`);
          await container.item(districtToRemove.id, districtToRemove.id).delete();
          removedCount++;
        } catch (error) {
          console.error(`❌ Failed to delete district ${districtToRemove.id}:`, error.message);
        }
      }
    }
    
    console.log(`\n✅ Successfully removed ${removedCount} duplicate districts`);
    
    // Verify the cleanup
    console.log('\n🔍 Verifying cleanup...');
    const { resources: remainingDistricts } = await container.items.query('SELECT * FROM c').fetchAll();
    console.log(`📊 Remaining districts: ${remainingDistricts.length}`);
    
    // Check for any remaining duplicates
    const remainingGrouped = {};
    remainingDistricts.forEach(district => {
      const key = `${district.name}-${district.regionId}`;
      if (!remainingGrouped[key]) {
        remainingGrouped[key] = [];
      }
      remainingGrouped[key].push(district);
    });
    
    const remainingDuplicates = Object.entries(remainingGrouped).filter(([key, list]) => list.length > 1);
    
    if (remainingDuplicates.length === 0) {
      console.log('✅ No remaining duplicates found!');
    } else {
      console.log(`⚠️  Found ${remainingDuplicates.length} remaining duplicate groups:`);
      remainingDuplicates.forEach(([key, list]) => {
        console.log(`   ${key}: ${list.length} duplicates`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error removing duplicate districts:', error);
    process.exit(1);
  }
}

// Run the script
removeDuplicateDistricts()
  .then(() => {
    console.log('\n🎉 Duplicate district removal process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }); 