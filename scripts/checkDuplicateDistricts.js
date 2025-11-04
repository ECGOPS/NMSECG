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

async function checkDuplicateDistricts() {
  try {
    console.log('🔍 Checking for duplicate districts...');
    
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
    console.log('=' .repeat(80));
    
    duplicates.forEach((group, index) => {
      console.log(`\n${index + 1}. ${group.key}:`);
      console.log('-'.repeat(40));
      group.districts.forEach((district, dIndex) => {
        const isFirst = dIndex === 0;
        const status = isFirst ? '✅ KEEP' : '🗑️  DELETE';
        console.log(`   ${dIndex + 1}. ${status} - ID: ${district.id}`);
        console.log(`      Name: ${district.name}`);
        console.log(`      Region ID: ${district.regionId}`);
        console.log(`      Created: ${district.createdAt || 'N/A'}`);
        console.log(`      Updated: ${district.updatedAt || 'N/A'}`);
        console.log('');
      });
    });
    
    // Summary
    const totalDuplicates = duplicates.reduce((sum, group) => sum + group.districts.length - 1, 0);
    console.log('=' .repeat(80));
    console.log(`📊 SUMMARY:`);
    console.log(`   Total duplicate groups: ${duplicates.length}`);
    console.log(`   Total duplicates to remove: ${totalDuplicates}`);
    console.log(`   Districts that would remain: ${districts.length - totalDuplicates}`);
    console.log('=' .repeat(80));
    
    console.log('\n💡 To remove these duplicates, run: node scripts/removeDuplicateDistricts.js');
    
  } catch (error) {
    console.error('❌ Error checking duplicate districts:', error);
    process.exit(1);
  }
}

// Run the script
checkDuplicateDistricts()
  .then(() => {
    console.log('\n🎉 Duplicate district check completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }); 