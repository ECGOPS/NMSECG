const { CosmosClient } = require('@azure/cosmos');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Cosmos DB configuration
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;

if (!endpoint || !key || !databaseId) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);

// Create export directory
const exportDir = path.join(__dirname, 'database-export');
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

async function exportContainer(containerName) {
  try {
    console.log(`📦 Exporting container: ${containerName}`);
    
    const container = database.container(containerName);
    
    // Use pagination to handle large containers efficiently
    // This ensures we get ALL items even if there are many
    let allItems = [];
    let continuationToken = undefined;
    let pageCount = 0;
    
    do {
      pageCount++;
      const options = continuationToken ? { continuationToken } : {};
      const response = await container.items.readAll(options).fetchNext();
      
      if (response.resources && response.resources.length > 0) {
        allItems = allItems.concat(response.resources);
        console.log(`   📄 Page ${pageCount}: Found ${response.resources.length} items (Total: ${allItems.length})`);
      }
      
      continuationToken = response.continuationToken;
    } while (continuationToken);
    
    console.log(`   ✅ Found ${allItems.length} total items`);
    
    // Create container directory
    const containerDir = path.join(exportDir, containerName);
    if (!fs.existsSync(containerDir)) {
      fs.mkdirSync(containerDir, { recursive: true });
    }
    
    // Export all items as JSON
    const exportData = {
      containerName: containerName,
      exportDate: new Date().toISOString(),
      exportTimestamp: Date.now(),
      totalItems: allItems.length,
      items: allItems
    };
    
    const fileName = path.join(containerDir, `${containerName}.json`);
    fs.writeFileSync(fileName, JSON.stringify(exportData, null, 2));
    
    // Also create individual item files for easier browsing
    // Limit individual files for very large containers to avoid file system issues
    const maxIndividualFiles = 1000;
    if (allItems.length <= maxIndividualFiles) {
      allItems.forEach((item, index) => {
        const itemFileName = path.join(containerDir, `item_${index + 1}_${item.id || 'unknown'}.json`);
        fs.writeFileSync(itemFileName, JSON.stringify(item, null, 2));
      });
      console.log(`   📄 Individual items: ${allItems.length} files`);
    } else {
      console.log(`   📄 Skipping individual files (${allItems.length} items exceeds limit of ${maxIndividualFiles})`);
      console.log(`   💡 Use ${containerName}.json for full export`);
    }
    
    console.log(`   ✅ Exported to: ${fileName}`);
    
    return {
      containerName,
      itemCount: allItems.length,
      success: true
    };
    
  } catch (error) {
    console.error(`   ❌ Error exporting ${containerName}:`, error.message);
    console.error(`   Stack:`, error.stack);
    return {
      containerName,
      itemCount: 0,
      success: false,
      error: error.message
    };
  }
}

async function exportAllContainers() {
  try {
    console.log('🚀 Starting database export from Azure Cosmos DB...');
    console.log('='.repeat(60));
    console.log(`Database: ${databaseId}`);
    console.log(`Endpoint: ${endpoint}`);
    console.log(`Export Directory: ${exportDir}`);
    console.log(`Export Date: ${new Date().toISOString()}`);
    console.log('='.repeat(60));
    
    // Get all containers (using pagination to ensure we get all)
    let allContainers = [];
    let continuationToken = undefined;
    
    do {
      const options = continuationToken ? { continuationToken } : {};
      const response = await database.containers.readAll(options).fetchNext();
      
      if (response.resources && response.resources.length > 0) {
        allContainers = allContainers.concat(response.resources);
      }
      
      continuationToken = response.continuationToken;
    } while (continuationToken);
    
    console.log(`📊 Found ${allContainers.length} containers to export:`);
    allContainers.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.id}`);
    });
    console.log('');
    
    // Backup previous export if it exists
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/[TZ]/g, '_');
    const backupDir = path.join(__dirname, `database-export-backup-${timestamp}`);
    if (fs.existsSync(exportDir)) {
      console.log(`💾 Backing up previous export to: ${backupDir}`);
      fs.mkdirSync(backupDir, { recursive: true });
      // Copy only summary files to backup
      try {
        const summaryFiles = ['export-summary.json', 'export-summary.txt'];
        summaryFiles.forEach(file => {
          const src = path.join(exportDir, file);
          const dest = path.join(backupDir, file);
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
          }
        });
        console.log(`   ✅ Previous summary backed up`);
      } catch (backupError) {
        console.warn(`   ⚠️  Backup warning: ${backupError.message}`);
      }
    }
    
    const results = [];
    let totalItems = 0;
    let successCount = 0;
    const startTime = Date.now();
    
    // Export each container
    for (let i = 0; i < allContainers.length; i++) {
      const container = allContainers[i];
      console.log(`\n[${i + 1}/${allContainers.length}] Processing: ${container.id}`);
      const result = await exportContainer(container.id);
      results.push(result);
      
      if (result.success) {
        totalItems += result.itemCount;
        successCount++;
      }
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    // Create summary report
    const summary = {
      exportDate: new Date().toISOString(),
      exportTimestamp: Date.now(),
      database: databaseId,
      endpoint: endpoint,
      totalContainers: allContainers.length,
      successfulExports: successCount,
      failedExports: allContainers.length - successCount,
      totalItems: totalItems,
      exportDurationSeconds: parseFloat(duration),
      results: results.sort((a, b) => {
        // Sort by success first, then by item count
        if (a.success !== b.success) return a.success ? -1 : 1;
        return b.itemCount - a.itemCount;
      })
    };
    
    const summaryFile = path.join(exportDir, 'export-summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    
    // Create a simple text summary
    const textSummary = `
DATABASE EXPORT SUMMARY
=======================
Export Date: ${summary.exportDate}
Database: ${summary.database}
Endpoint: ${summary.endpoint}
Total Containers: ${summary.totalContainers}
Successful Exports: ${summary.successfulExports}
Failed Exports: ${summary.failedExports}
Total Items Exported: ${summary.totalItems}
Export Duration: ${summary.exportDurationSeconds} seconds

CONTAINER RESULTS:
${summary.results.map((r, i) => 
  `${i + 1}. ${r.success ? '✅' : '❌'} ${r.containerName}: ${r.itemCount.toLocaleString()} items${r.error ? ` (Error: ${r.error})` : ''}`
).join('\n')}

Export Location: ${exportDir}
Backup Location: ${backupDir}
    `.trim();
    
    const textSummaryFile = path.join(exportDir, 'export-summary.txt');
    fs.writeFileSync(textSummaryFile, textSummary);
    
    console.log('\n🎉 Export completed!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   Total Containers: ${summary.totalContainers}`);
    console.log(`   Successful: ${summary.successfulExports}`);
    console.log(`   Failed: ${summary.failedExports}`);
    console.log(`   Total Items: ${summary.totalItems.toLocaleString()}`);
    console.log(`   Export Duration: ${summary.exportDurationSeconds} seconds`);
    console.log(`   Export Location: ${exportDir}`);
    console.log(`   Backup Location: ${backupDir}`);
    console.log('');
    console.log(`📄 Summary files:`);
    console.log(`   - ${summaryFile}`);
    console.log(`   - ${textSummaryFile}`);
    console.log('');
    console.log(`✅ Latest data from Azure Cosmos DB has been exported successfully!`);
    
  } catch (error) {
    console.error('❌ Error during export:', error.message);
    process.exit(1);
  }
}

// Run the export
exportAllContainers();
