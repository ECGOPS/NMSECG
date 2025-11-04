const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'substationInspections';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// Log endpoint status only in development
if (process.env.NODE_ENV === 'development') {
  console.log('[SubstationInspections] Endpoint:', endpoint);
}

// GET all with filtering, sorting, pagination, and count
router.get('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    console.log('[SubstationInspections] GET request received with query:', req.query);
    console.log('[SubstationInspections] Database:', databaseId);
    console.log('[SubstationInspections] Container:', containerId);
    
    let queryStr = 'SELECT * FROM c';
    const filters = [];
    
    // Apply role-based filtering
    if (req.userRole && req.userRole !== "system_admin" && req.userRole !== "global_engineer") {
      if (req.userRole === "district_engineer" || req.userRole === "technician" || req.userRole === "district_manager") {
        if (req.user && req.user.district) {
          filters.push(`c.district = "${req.user.district}"`);
          console.log('[SubstationInspections] Added district filter:', req.user.district);
        }
      } else if (req.userRole === "regional_engineer" || req.userRole === "regional_general_manager" || req.userRole === "project_engineer") {
        if (req.user && req.user.region) {
          filters.push(`c.region = "${req.user.region}"`);
          console.log('[SubstationInspections] Added region filter:', req.user.region);
        }
      } else if (req.userRole === "ashsubt") {
        // Ashsubt users can see multiple regions: SUBTRANSMISSION ASHANTI, ASHANTI EAST, ASHANTI WEST, ASHANTI SOUTH
        const ashsubtRegions = ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION'];
        const regionConditions = ashsubtRegions.map(r => `c.region = "${r}"`);
        filters.push(`(${regionConditions.join(' OR ')})`);
        console.log('[SubstationInspections] Added ashsubt multi-region filter:', ashsubtRegions.join(', '));
      } else if (req.userRole === "accsubt") {
        // Accsubt users can see multiple regions: SUBTRANSMISSION ACCRA, ACCRA EAST, ACCRA WEST
        const accsubtRegions = ['SUBTRANSMISSION ACCRA', 'ACCRA EAST REGION', 'ACCRA WEST REGION'];
        const regionConditions = accsubtRegions.map(r => `c.region = "${r}"`);
        filters.push(`(${regionConditions.join(' OR ')})`);
        console.log('[SubstationInspections] Added accsubt multi-region filter:', accsubtRegions.join(', '));
      }
    }
    
    // Handle date range filtering (before other filters)
    if (req.query.dateFrom || req.query.dateTo) {
      let dateRangeCondition = '';
      
      if (req.query.dateFrom && req.query.dateTo) {
        // Both dates provided - create a range filter
        const fromDate = req.query.dateFrom;
        const toDate = req.query.dateTo;
        dateRangeCondition = `(c.date >= "${fromDate}" AND c.date <= "${toDate}")`;
        console.log('[SubstationInspections] Processing date range filter:', {
          receivedValues: { dateFrom: req.query.dateFrom, dateTo: req.query.dateTo },
          filterType: 'dateRange',
          filterCondition: dateRangeCondition
        });
      } else if (req.query.dateFrom) {
        // Only start date provided
        const fromDate = req.query.dateFrom;
        dateRangeCondition = `c.date >= "${fromDate}"`;
        console.log('[SubstationInspections] Processing date from filter:', {
          receivedValue: req.query.dateFrom,
          filterType: 'dateFrom',
          filterCondition: dateRangeCondition
        });
      } else if (req.query.dateTo) {
        // Only end date provided
        const toDate = req.query.dateTo;
        dateRangeCondition = `c.date <= "${toDate}"`;
        console.log('[SubstationInspections] Processing date to filter:', {
          receivedValue: req.query.dateTo,
          filterType: 'dateTo',
          filterCondition: dateRangeCondition
        });
      }
      
      if (dateRangeCondition) {
        filters.push(dateRangeCondition);
        console.log('[SubstationInspections] Added date range filter condition:', dateRangeCondition);
      }
    }
    
    // Add additional filters from query parameters
    for (const key in req.query) {
      if (["sort", "order", "limit", "offset", "countOnly", "dateFrom", "dateTo"].includes(key)) continue;
      
      if (key === 'date') {
        // Handle date filtering (only if dateFrom/dateTo not provided)
        if (!req.query.dateFrom && !req.query.dateTo) {
          filters.push(`c.date = "${req.query[key]}"`);
        }
      } else if (key === 'month') {
        // Handle month filtering
        filters.push(`c.date LIKE "${req.query[key]}%"`);
      } else if (key === 'search') {
        // Handle search filtering across multiple fields
        filters.push(`(c.substationNo LIKE "%${req.query[key]}%" OR c.region LIKE "%${req.query[key]}%" OR c.district LIKE "%${req.query[key]}%")`);
      } else {
        // Handle other filters
        filters.push(`c.${key} = "${req.query[key]}"`);
      }
    }
    
    if (filters.length) {
      queryStr += ' WHERE ' + filters.join(' AND ');
      console.log('[SubstationInspections] Applied filters:', filters);
    }
    
    // Add sorting
    if (req.query.sort) {
      queryStr += ` ORDER BY c.${req.query.sort} ${req.query.order === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      queryStr += ' ORDER BY c.createdAt DESC';
    }
    
    // Extract pagination parameters
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const countOnly = req.query.countOnly === 'true';
    
    // Count-only shortcut for better performance
    if (countOnly) {
      const countQuery = queryStr.replace(/SELECT \* FROM c/, 'SELECT VALUE COUNT(1) FROM c');
      console.log('[SubstationInspections] Count query:', countQuery);
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      const totalCount = countResources[0] ?? 0;
      
      console.log('[SubstationInspections] Count query result:', totalCount);
      return res.json({ total: totalCount });
    }
    
    // Add pagination to main query
    queryStr += ` OFFSET ${offset} LIMIT ${limit}`;
    
    // Execute paginated query
    console.log('[SubstationInspections] Final query:', queryStr);
    const startTime = Date.now();
    let resources = [];
    let executionTime = 0;
    
    try {
      const result = await container.items.query(queryStr).fetchAll();
      resources = result.resources;
      executionTime = Date.now() - startTime;
      console.log('[SubstationInspections] Query executed successfully in', executionTime, 'ms');
    } catch (queryError) {
      console.error('[SubstationInspections] Query execution error:', queryError);
      return res.status(500).json({
        error: 'Database query failed',
        details: queryError.message,
        code: queryError.code,
        query: queryStr
      });
    }
    
    // Get total count without pagination for accurate pagination info
    let totalCount = 0;
    try {
      // Build count query with same filters but without pagination
      let countQuery = 'SELECT VALUE COUNT(1) FROM c';
      
      // Add the same filters that were applied to the main query
      if (filters.length > 0) {
        countQuery += ' WHERE ' + filters.join(' AND ');
      }
      
      console.log('[SubstationInspections] Count query:', countQuery);
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      totalCount = countResources[0] ?? 0;
      console.log('[SubstationInspections] Count query result:', totalCount);
    } catch (countError) {
      console.error('[SubstationInspections] Count query error:', countError);
      // Don't fail the request, just use the current page count
      totalCount = resources.length;
    }
    
    // Enhanced logging with performance metrics
    console.log('[SubstationInspections] Query result:', {
      count: resources.length,
      total: totalCount,
      executionTime: `${executionTime}ms`,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        totalPages: Math.ceil(totalCount / limit),
        offset,
        limit
      },
      sample: resources.slice(0, 2).map(item => ({
        id: item.id,
        region: item.region,
        district: item.district,
        substationNo: item.substationNo,
        status: item.status
      }))
    });
    
    // Structured response with pagination metadata
    res.json({
      data: resources,
      total: totalCount,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: (Math.floor(offset / limit) + 1) < Math.ceil(totalCount / limit),
      hasPreviousPage: offset > 0
    });
    
  } catch (err) {
    console.error('Error in substation inspections route:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      statusCode: err.statusCode
    });
    res.status(500).json({
      error: err.message,
      details: err.stack,
      code: err.code
    });
  }
});

// GET by ID
router.get('/:id', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { id } = req.params;
    const { resource } = await container.item(id, id).read();
    if (!resource) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    res.json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST (create)
router.post('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { resource } = await container.items.create(req.body);
    res.status(201).json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT (update)
router.put('/:id', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('[SubstationInspections] PUT request for id:', id);
    console.log('[SubstationInspections] Request body keys:', Object.keys(req.body || {}));
    
    // Get existing item to preserve createdBy if not being updated
    let existingItem;
    try {
      const result = await container.item(id, id).read();
      existingItem = result.resource;
      console.log('[SubstationInspections] Existing item found:', !!existingItem);
    } catch (readError) {
      console.error('[SubstationInspections] Error reading existing item:', readError);
      existingItem = null;
    }
    
    // Extract user name from request (could be from various sources)
    const userName = req.user?.name || 
                     req.user?.displayName || 
                     req.user?.username || 
                     req.user?.email?.split('@')[0] || 
                     req.user?.id || 
                     'Unknown';
    
    // Clean up the request body - remove invalid hyphenated keys
    const cleanedBody = { ...req.body };
    // Remove hyphenated keys that shouldn't be there
    delete cleanedBody['site-condition'];
    delete cleanedBody['area-fuse'];
    delete cleanedBody['paint-work'];
    
    // CRITICAL: Preserve the original id to avoid partition key mismatch
    cleanedBody.id = id;
    
    // Preserve createdBy and createdAt if they exist
    const updatedData = {
      ...cleanedBody,
      updatedAt: new Date().toISOString(),
      updatedBy: userName
    };
    
    // Preserve createdBy from existing item if not in request body
    if (existingItem && existingItem.createdBy && !req.body.createdBy) {
      updatedData.createdBy = existingItem.createdBy;
    }
    if (existingItem && existingItem.createdAt && !req.body.createdAt) {
      updatedData.createdAt = existingItem.createdAt;
    }
    
    // CRITICAL: Preserve the type field from existing item to avoid changing primary to secondary or vice versa
    if (existingItem && existingItem.type && !req.body.type) {
      updatedData.type = existingItem.type;
      console.log('[SubstationInspections] Preserving type from existing item:', existingItem.type);
    }
    
    /**
     * IMAGE URL PRESERVATION LOGIC
     * 
     * When updating a record, preserve existing image URLs if:
     * 1. No new images are provided in the request (field is missing)
     * 2. Empty array is provided (user cleared all images intentionally handled separately)
     * 3. Field is null/undefined (should preserve existing)
     * 
     * Priority: Azure Blob URLs > Firebase URLs
     * Only replace image URLs when:
     * - New valid URLs (Azure or Firebase) are explicitly provided
     * - Array contains at least one valid URL
     */
    
    // Preserve images array - only update if new images are explicitly provided
    if (existingItem) {
      // Handle 'images' field (before photos)
      if (req.body.images === undefined || req.body.images === null) {
        // Field not provided in request - preserve existing images
        if (existingItem.images && Array.isArray(existingItem.images) && existingItem.images.length > 0) {
          updatedData.images = existingItem.images;
          console.log('[SubstationInspections] Preserved existing images array:', existingItem.images.length, 'photos');
        }
      } else if (Array.isArray(req.body.images)) {
        // Images array provided in request
        if (req.body.images.length === 0) {
          // CRITICAL FIX: Empty array provided - ALWAYS preserve existing images if they exist
          // This prevents accidental data loss when frontend sends empty array
          if (existingItem.images && Array.isArray(existingItem.images) && existingItem.images.length > 0) {
            // Always preserve existing images when empty array is sent
            updatedData.images = existingItem.images;
            console.log('[SubstationInspections] CRITICAL: Empty array received, preserving existing images:', existingItem.images.length, 'photos');
          } else {
            // No existing images, allow empty array
            updatedData.images = [];
            console.log('[SubstationInspections] Empty array received, no existing images to preserve');
          }
        } else {
          // Non-empty array provided - use it (new images uploaded)
          // Prioritize Azure URLs over Firebase URLs within the array
          const prioritizedImages = req.body.images.map(url => {
            if (!url) return null;
            // If both Azure and Firebase URLs exist, prefer Azure
            return url;
          }).filter(Boolean);
          
          updatedData.images = prioritizedImages;
          console.log('[SubstationInspections] Using new images array:', prioritizedImages.length, 'photos');
        }
      }
      
      // Handle 'afterImages' field (after photos) - same logic as images
      if (req.body.afterImages === undefined || req.body.afterImages === null) {
        // Field not provided - preserve existing afterImages
        if (existingItem.afterImages && Array.isArray(existingItem.afterImages) && existingItem.afterImages.length > 0) {
          updatedData.afterImages = existingItem.afterImages;
          console.log('[SubstationInspections] Preserved existing afterImages array:', existingItem.afterImages.length, 'photos');
        }
      } else if (Array.isArray(req.body.afterImages)) {
        // afterImages array provided
        if (req.body.afterImages.length === 0) {
          // CRITICAL FIX: Empty array provided - ALWAYS preserve existing afterImages if they exist
          if (existingItem.afterImages && Array.isArray(existingItem.afterImages) && existingItem.afterImages.length > 0) {
            // Always preserve existing afterImages when empty array is sent
            updatedData.afterImages = existingItem.afterImages;
            console.log('[SubstationInspections] CRITICAL: Empty array received, preserving existing afterImages:', existingItem.afterImages.length, 'photos');
          } else {
            // No existing afterImages, allow empty array
            updatedData.afterImages = [];
            console.log('[SubstationInspections] Empty array received, no existing afterImages to preserve');
          }
        } else {
          // Non-empty array - use it
          const prioritizedAfterImages = req.body.afterImages.map(url => {
            if (!url) return null;
            return url;
          }).filter(Boolean);
          
          updatedData.afterImages = prioritizedAfterImages;
          console.log('[SubstationInspections] Using new afterImages array:', prioritizedAfterImages.length, 'photos');
        }
      }
    }
    
    // Ensure id and partition key match
    updatedData.id = id;
    
    console.log('[SubstationInspections] Updated data keys:', Object.keys(updatedData));
    console.log('[SubstationInspections] Image preservation status:', {
      imagesCount: updatedData.images?.length || 0,
      afterImagesCount: updatedData.afterImages?.length || 0,
      imagesPreserved: existingItem?.images?.length > 0 && updatedData.images === existingItem.images,
      afterImagesPreserved: existingItem?.afterImages?.length > 0 && updatedData.afterImages === existingItem.afterImages
    });
    
    const { resource } = await container.item(id, id).replace(updatedData);
    console.log('[SubstationInspections] Update successful');
    res.json(resource);
  } catch (err) {
    console.error('[SubstationInspections] PUT error:', err);
    console.error('[SubstationInspections] Error details:', {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    res.status(500).json({ error: err.message, details: err.stack });
  }
});

// DELETE
router.delete('/:id', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { id } = req.params;
    await container.item(id, id).delete();
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 