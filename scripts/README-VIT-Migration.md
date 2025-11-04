# VIT Photo Migration Scripts

This directory contains scripts to migrate VIT asset base64 photos to Azure Blob Storage to improve performance.

## Problem

The VIT assets currently store photos as base64 strings in Cosmos DB, which:
- Significantly slows down page loading
- Increases database storage costs
- Limits scalability
- Causes poor user experience

## Solution

Migrate base64 photos to Azure Blob Storage:
- Convert base64 to binary files
- Upload to Azure Blob Storage container: `uploads`
- Generate public URLs
- Update Cosmos DB records to use `photoUrl` instead of `photo`
- Remove base64 data from database

## Scripts

### 1. Dry Run Script
```bash
npm run migrate:vit-photos:dry-run
```

**What it does:**
- Analyzes all VIT assets
- Shows which assets have base64 photos
- Calculates total size and cost savings
- Shows sample data
- **No actual changes are made**

**Use this first to understand the scope of migration.**

### 2. Migration Script
```bash
npm run migrate:vit-photos
```

**What it does:**
- Migrates all base64 photos to Azure Blob Storage
- Updates Cosmos DB records
- Removes base64 data from database
- Provides detailed progress and error reporting

## Prerequisites

### Environment Variables
Set these environment variables before running the scripts:

```bash
# Cosmos DB
COSMOS_DB_ENDPOINT=your_cosmos_endpoint
COSMOS_DB_KEY=your_cosmos_key
COSMOS_DB_DATABASE=your_database_name

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=your_blob_connection_string
```

### Azure Blob Storage Setup
1. Create a storage account in Azure
2. Create a container named `uploads`
3. Set container access level to "Blob" (public read access)
4. Get the connection string from Azure Portal

## Migration Process

### Step 1: Dry Run
```bash
npm run migrate:vit-photos:dry-run
```

Review the output to understand:
- How many assets will be migrated
- Total size of base64 data
- Estimated cost savings
- Sample data structure

### Step 2: Backup (Optional)
Before running the actual migration, consider backing up your Cosmos DB data.

### Step 3: Run Migration
```bash
npm run migrate:vit-photos
```

The script will:
1. Connect to Cosmos DB and Azure Blob Storage
2. Query all VIT assets
3. Filter assets with base64 photos
4. For each asset:
   - Convert base64 to buffer
   - Upload to blob storage
   - Generate public URL
   - Update Cosmos DB record
   - Remove base64 data
5. Provide detailed progress and summary

## Expected Results

### Before Migration
```json
{
  "id": "asset-123",
  "serialNumber": "VIT001",
  "photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
  "photoUrl": null
}
```

### After Migration
```json
{
  "id": "asset-123",
  "serialNumber": "VIT001",
  "photoUrl": "https://storage.blob.core.windows.net/uploads/vit-assets/asset-123/photo-2024-01-15T10-30-00-000Z.jpg"
}
```

## Benefits

### Performance Improvements
- **Faster page loading**: No more large base64 strings in API responses
- **Reduced bandwidth**: Images loaded on-demand from blob storage
- **Better caching**: Browser can cache images separately
- **Improved scalability**: Database queries are much faster

### Cost Savings
- **Reduced Cosmos DB storage**: Base64 data removed
- **Lower RU consumption**: Smaller document sizes
- **Optimized blob storage**: Efficient image storage

### User Experience
- **Faster VIT page**: Immediate performance improvement
- **Better image loading**: Progressive image loading
- **Reduced memory usage**: No large strings in browser memory

## Error Handling

The migration script includes comprehensive error handling:
- **Individual asset failures**: Continues with other assets
- **Detailed error logging**: Shows which assets failed and why
- **Progress tracking**: Real-time progress updates
- **Summary report**: Final success/failure counts

## Rollback Plan

If issues occur, you can rollback by:
1. Restoring from Cosmos DB backup
2. Deleting blob files (if needed)
3. Running the migration again

## Monitoring

After migration, monitor:
- VIT page performance
- Blob storage costs
- Cosmos DB RU consumption
- User feedback

## Troubleshooting

### Common Issues

1. **Missing environment variables**
   - Ensure all required env vars are set
   - Check Azure credentials

2. **Blob container access issues**
   - Verify container exists
   - Check connection string
   - Ensure proper permissions

3. **Cosmos DB connection issues**
   - Verify endpoint and key
   - Check network connectivity
   - Ensure proper permissions

### Getting Help

If you encounter issues:
1. Check the console output for error details
2. Verify environment variables
3. Test Azure connections separately
4. Review the migration summary

## Security Notes

- Blob container is set to public read access
- Images are cached for 1 year
- Consider implementing CDN for better performance
- Monitor blob storage access logs

## Performance Impact

### During Migration
- **Database**: Increased RU consumption during updates
- **Network**: Large uploads to blob storage
- **Time**: ~0.5 seconds per asset

### After Migration
- **Database**: Significantly reduced RU consumption
- **Network**: Optimized image loading
- **Performance**: Immediate improvement in VIT page speed 