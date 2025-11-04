const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'loadMonitoring';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// Log endpoint status only in development
if (process.env.NODE_ENV === 'development') {
  console.log('[LoadMonitoring] Endpoint:', endpoint);
}

// GET all with filtering, sorting, pagination, and count
router.get('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    console.log('[LoadMonitoring] Request received:', {
      method: req.method,
      url: req.url,
      query: req.query,
      user: req.user
    });

    // Check if container exists
    try {
      await container.read();
      console.log('[LoadMonitoring] Container exists and is accessible');
    } catch (containerError) {
      console.error('[LoadMonitoring] Container error:', containerError);
      return res.status(500).json({
        error: 'Database container not accessible',
        details: containerError.message,
        code: containerError.code
      });
    }

    // Use optimized query for better performance - include all fields needed by frontend
    let queryStr = 'SELECT c.id, c.region, c.district, c.regionId, c.districtId, c.feederName, c.voltageLevel, c.date, c.time, c.substationName, c.substationNumber, c.location, c.rating, c.peakLoadStatus, c.percentageLoad, c.ratedLoad, c.redPhaseBulkLoad, c.yellowPhaseBulkLoad, c.bluePhaseBulkLoad, c.averageCurrent, c.tenPercentFullLoadNeutral, c.calculatedNeutral, c.feederLegs, c.status, c.notes, c.createdAt, c.updatedAt, c.createdBy, c.updatedBy FROM c';

    // Apply role-based filtering with enhanced logging
    const filters = [];
    console.log('[LoadMonitoring] User info:', {
      role: req.user?.role,
      district: req.user?.district,
      region: req.user?.region,
      userId: req.user?.id
    });

    if (req.user && req.user.role !== "system_admin" && req.user.role !== "global_engineer") {
      if (req.user.role === "district_engineer" || req.user.role === "technician" || req.user.role === "district_manager") {
        if (req.user.district) {
          filters.push(`c.district = "${req.user.district}"`);
          console.log('[LoadMonitoring] Added district filter:', req.user.district);
        } else {
          console.log('[LoadMonitoring] No district found for user:', req.user.role);
        }
      } else if (req.user.role === "regional_engineer" || req.user.role === "regional_general_manager" || req.user.role === "project_engineer") {
        if (req.user.region) {
          filters.push(`c.region = "${req.user.region}"`);
          console.log('[LoadMonitoring] Added region filter:', req.user.region);
        } else {
          console.log('[LoadMonitoring] No region found for user:', req.user.role);
        }
      } else if (req.user.role === "ashsubt") {
        // Ashsubt users can see multiple regions: SUBTRANSMISSION ASHANTI, ASHANTI EAST, ASHANTI WEST, ASHANTI SOUTH
        const ashsubtRegions = ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION'];
        const regionConditions = ashsubtRegions.map(r => `c.region = "${r}"`);
        filters.push(`(${regionConditions.join(' OR ')})`);
        console.log('[LoadMonitoring] Added ashsubt multi-region filter:', ashsubtRegions.join(', '));
      } else if (req.user.role === "accsubt") {
        // Accsubt users can see multiple regions: SUBTRANSMISSION ACCRA, ACCRA EAST, ACCRA WEST
        const accsubtRegions = ['SUBTRANSMISSION ACCRA', 'ACCRA EAST REGION', 'ACCRA WEST REGION'];
        const regionConditions = accsubtRegions.map(r => `c.region = "${r}"`);
        filters.push(`(${regionConditions.join(' OR ')})`);
        console.log('[LoadMonitoring] Added accsubt multi-region filter:', accsubtRegions.join(', '));
      } else {
        console.log('[LoadMonitoring] User role not handled for filtering:', req.user.role);
      }
    } else {
      console.log('[LoadMonitoring] Admin/Global engineer - no filtering applied');
    }

    // Add additional filters from query parameters
    if (req.query.region && req.query.region !== 'all') {
      console.log('[LoadMonitoring] Processing region filter:', {
        receivedValue: req.query.region,
        filterType: 'region',
        filterCondition: `c.region = "${req.query.region}"`
      });
      filters.push(`c.region = "${req.query.region}"`);
      console.log('[LoadMonitoring] Added region filter from query:', req.query.region);
      console.log('[LoadMonitoring] Region filter condition added:', filters[filters.length - 1]);
    }
    
    if (req.query.district && req.query.district !== 'all') {
      console.log('[LoadMonitoring] Processing district filter:', {
        receivedValue: req.query.district,
        filterType: 'district',
        filterCondition: `c.district = "${req.query.district}"`
      });
      filters.push(`c.district = "${req.query.district}"`);
      console.log('[LoadMonitoring] Added district filter from query:', req.query.district);
      console.log('[LoadMonitoring] District filter condition added:', filters[filters.length - 1]);
    }
    
    if (req.query.feederName && req.query.feederName !== 'all') {
      console.log('[LoadMonitoring] Processing feeder filter:', {
        receivedValue: req.query.feederName,
        filterType: 'feederName',
        filterCondition: `c.feederName = "${req.query.feederName}"`
      });
      filters.push(`c.feederName = "${req.query.feederName}"`);
      console.log('[LoadMonitoring] Added feeder filter from query:', req.query.feederName);
      console.log('[LoadMonitoring] Feeder filter condition added:', filters[filters.length - 1]);
    }
    
    if (req.query.date) {
      // Handle both date field and createdAt timestamp
      const dateObj = new Date(req.query.date);
      const timestamp = Math.floor(dateObj.getTime() / 1000);
      const nextDayTimestamp = timestamp + 86400; // Add 24 hours
      
      const dateFilterCondition = `(c.date = "${req.query.date}" OR (c.createdAt._seconds >= ${timestamp} AND c.createdAt._seconds < ${nextDayTimestamp}))`;
      console.log('[LoadMonitoring] Processing date filter:', {
        receivedValue: req.query.date,
        filterType: 'date',
        dateObj: dateObj.toISOString(),
        timestamp: timestamp,
        nextDayTimestamp: nextDayTimestamp,
        filterCondition: dateFilterCondition
      });
      
      filters.push(dateFilterCondition);
      console.log('[LoadMonitoring] Added date filter from query:', req.query.date, 'timestamp range:', timestamp, 'to', nextDayTimestamp);
      console.log('[LoadMonitoring] Date filter condition added:', filters[filters.length - 1]);
    }
    
    // Handle date range filtering
    if (req.query.dateFrom || req.query.dateTo) {
      let dateRangeCondition = '';
      
      if (req.query.dateFrom && req.query.dateTo) {
        // Both dates provided - create a range filter
        const fromDate = req.query.dateFrom;
        const toDate = req.query.dateTo;
        dateRangeCondition = `(c.date >= "${fromDate}" AND c.date <= "${toDate}")`;
        console.log('[LoadMonitoring] Processing date range filter:', {
          receivedValues: { dateFrom: req.query.dateFrom, dateTo: req.query.dateTo },
          filterType: 'dateRange',
          filterCondition: dateRangeCondition
        });
      } else if (req.query.dateFrom) {
        // Only start date provided
        const fromDate = req.query.dateFrom;
        dateRangeCondition = `c.date >= "${fromDate}"`;
        console.log('[LoadMonitoring] Processing date from filter:', {
          receivedValue: req.query.dateFrom,
          filterType: 'dateFrom',
          filterCondition: dateRangeCondition
        });
      } else if (req.query.dateTo) {
        // Only end date provided
        const toDate = req.query.dateTo;
        dateRangeCondition = `c.date <= "${toDate}"`;
        console.log('[LoadMonitoring] Processing date to filter:', {
          receivedValue: req.query.dateTo,
          filterType: 'dateTo',
          filterCondition: dateRangeCondition
        });
      }
      
      if (dateRangeCondition) {
        filters.push(dateRangeCondition);
        console.log('[LoadMonitoring] Added date range filter condition:', dateRangeCondition);
      }
    }
    
    if (req.query.month) {
      console.log('[LoadMonitoring] Processing month filter:', {
        receivedValue: req.query.month,
        filterType: 'month',
        filterCondition: `c.date LIKE "${req.query.month}%"`
      });
      filters.push(`c.date LIKE "${req.query.month}%"`);
      console.log('[LoadMonitoring] Added month filter from query:', req.query.month);
      console.log('[LoadMonitoring] Month filter condition added:', filters[filters.length - 1]);
    }

    if (req.query.status && req.query.status !== 'all') {
      console.log('[LoadMonitoring] Processing status filter:', {
        receivedValue: req.query.status,
        filterType: 'status',
        filterCondition: `c.status = "${req.query.status}"`
      });
      filters.push(`c.status = "${req.query.status}"`);
      console.log('[LoadMonitoring] Added status filter from query:', req.query.status);
      console.log('[LoadMonitoring] Status filter condition added:', filters[filters.length - 1]);
    }

    // Handle loadStatus parameter (for percentage load filtering)
    if (req.query.loadStatus && req.query.loadStatus !== 'all') {
      console.log('[LoadMonitoring] Processing loadStatus filter:', {
        receivedValue: req.query.loadStatus,
        isOverload: req.query.loadStatus === 'OVERLOAD',
        isActionRequired: req.query.loadStatus === 'Action Required',
        isOkay: req.query.loadStatus === 'OKAY'
      });
      
      if (req.query.loadStatus === 'OVERLOAD') {
        filters.push('c.percentageLoad >= 100');
        console.log('[LoadMonitoring] Added OVERLOAD filter: c.percentageLoad >= 100');
      } else if (req.query.loadStatus === 'Action Required') {
        filters.push('c.percentageLoad >= 70 AND c.percentageLoad < 100');
        console.log('[LoadMonitoring] Added Action Required filter: c.percentageLoad >= 70 AND c.percentageLoad < 100');
      } else if (req.query.loadStatus === 'OKAY') {
        filters.push('c.percentageLoad < 70');
        console.log('[LoadMonitoring] Added OKAY filter: c.percentageLoad < 70');
      }
      console.log('[LoadMonitoring] Added loadStatus filter from query:', req.query.loadStatus);
      console.log('[LoadMonitoring] Filter condition added:', filters[filters.length - 1]);
    }

    // Handle search parameter (search across multiple fields)
    if (req.query.search && req.query.search.trim() !== '') {
      const searchTerm = req.query.search.trim().toLowerCase();
      const searchFilterCondition = `(
        CONTAINS(LOWER(c.substationName), "${searchTerm}") OR 
        CONTAINS(LOWER(c.substationNumber), "${searchTerm}") OR 
        CONTAINS(LOWER(c.region), "${searchTerm}") OR 
        CONTAINS(LOWER(c.district), "${searchTerm}") OR 
        CONTAINS(LOWER(c.location), "${searchTerm}")
      )`;
      
      console.log('[LoadMonitoring] Processing search filter:', {
        receivedValue: req.query.search,
        filterType: 'search',
        searchTerm: searchTerm,
        filterCondition: searchFilterCondition
      });
      
      filters.push(searchFilterCondition);
      console.log('[LoadMonitoring] Added search filter from query:', searchTerm);
      console.log('[LoadMonitoring] Search filter condition added:', filters[filters.length - 1]);
    }

    // Add filters to query
    if (filters.length > 0) {
      queryStr += ' WHERE ' + filters.join(' AND ');
      console.log('[LoadMonitoring] Applied filters:', filters);
      console.log('[LoadMonitoring] Final WHERE clause:', filters.join(' AND '));
      
      // Summary of all applied filters
      console.log('[LoadMonitoring] Filter summary:', {
        totalFilters: filters.length,
        filterTypes: filters.map((filter, index) => {
          if (filter.includes('percentageLoad >= 100')) return 'OVERLOAD';
          if (filter.includes('percentageLoad >= 70')) return 'Action Required';
          if (filter.includes('percentageLoad < 70')) return 'OKAY';
          if (filter.includes('c.region =')) return 'region';
          if (filter.includes('c.district =')) return 'district';
          if (filter.includes('c.feederName =')) return 'feederName';
          if (filter.includes('c.date =') || filter.includes('createdAt._seconds')) return 'date';
          if (filter.includes('c.date LIKE')) return 'month';
          if (filter.includes('c.status =')) return 'status';
          if (filter.includes('CONTAINS(LOWER(')) return 'search';
          return `filter_${index}`;
        }),
        finalQuery: queryStr
      });
      
      // Test the filter logic with a simple query to verify it works
      if (req.query.loadStatus === 'OVERLOAD') {
        try {
          const testQuery = 'SELECT c.id, c.percentageLoad, c.substationName FROM c WHERE c.percentageLoad >= 100 LIMIT 3';
          console.log('[LoadMonitoring] Testing OVERLOAD filter with query:', testQuery);
          const { resources: testData } = await container.items.query(testQuery).fetchAll();
          console.log('[LoadMonitoring] OVERLOAD test query result:', testData.length, 'records found');
          console.log('[LoadMonitoring] OVERLOAD test records:', testData);
        } catch (error) {
          console.error('[LoadMonitoring] Error testing OVERLOAD filter:', error);
        }
      }
    } else {
      console.log('[LoadMonitoring] No filters applied');
    }

    // Add sorting
    if (req.query.sort) {
      queryStr += ` ORDER BY c.${req.query.sort} ${req.query.order === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      queryStr += ' ORDER BY c.createdAt DESC';
    }

    // Extract pagination parameters
    const limit = parseInt(req.query.limit) || 100; // Increased default from 20 to 100
    const offset = parseInt(req.query.offset) || 0;
    const countOnly = req.query.countOnly === 'true';
    
    // Validate and cap limit to prevent performance issues
    const maxLimit = 10000; // Maximum limit to prevent excessive memory usage
    const finalLimit = Math.min(limit, maxLimit);
    
    // Performance warning for large queries
    if (limit > 1000) {
      console.warn('[LoadMonitoring] Large query requested:', {
        requestedLimit: limit,
        finalLimit,
        warning: 'Large queries may impact performance'
      });
    }
    
    console.log('[LoadMonitoring] Pagination params:', {
      requestedLimit: limit,
      finalLimit,
      offset,
      countOnly
    });

    // Count-only shortcut for better performance
    if (countOnly) {
      const countQuery = queryStr.replace(/SELECT c\.id, c\.region, c\.district, c\.regionId, c\.districtId, c\.feederName, c\.voltageLevel, c\.date, c\.time, c\.substationName, c\.substationNumber, c\.location, c\.rating, c\.peakLoadStatus, c\.percentageLoad, c\.ratedLoad, c\.redPhaseBulkLoad, c\.yellowPhaseBulkLoad, c\.bluePhaseBulkLoad, c\.averageCurrent, c\.tenPercentFullLoadNeutral, c\.calculatedNeutral, c\.feederLegs, c\.status, c\.notes, c\.createdAt, c\.updatedAt, c\.createdBy, c\.updatedBy FROM c/, 'SELECT VALUE COUNT(1) FROM c');
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      const totalCount = countResources[0] ?? 0;

      console.log('[LoadMonitoring] Count query result:', totalCount);
      return res.json({ total: totalCount });
    }

    // Add pagination to main query
    queryStr += ` OFFSET ${offset} LIMIT ${finalLimit}`;

    // Execute paginated query
    console.log('[LoadMonitoring] Final query:', queryStr);
    console.log('[LoadMonitoring] Query breakdown:', {
      baseQuery: 'SELECT c.id, c.region, c.district, c.regionId, c.districtId, c.feederName, c.voltageLevel, c.date, c.time, c.substationName, c.substationNumber, c.location, c.rating, c.peakLoadStatus, c.percentageLoad, c.ratedLoad, c.redPhaseBulkLoad, c.yellowPhaseBulkLoad, c.bluePhaseBulkLoad, c.averageCurrent, c.tenPercentFullLoadNeutral, c.calculatedNeutral, c.feederLegs, c.status, c.notes, c.createdAt, c.updatedAt, c.createdBy, c.updatedBy FROM c',
      whereClause: filters.length > 0 ? filters.join(' AND ') : 'none',
      orderBy: req.query.sort ? `c.${req.query.sort} ${req.query.order === 'desc' ? 'DESC' : 'ASC'}` : 'c.createdAt DESC',
      pagination: `OFFSET ${offset} LIMIT ${finalLimit}`,
      totalFilters: filters.length
    });
    
    // Debug: Check what data exists in the database
    try {
        const sampleQuery = 'SELECT c.id, c.percentageLoad, c.substationName FROM c LIMIT 5';
        const { resources: sampleData } = await container.items.query(sampleQuery).fetchAll();
        console.log('[LoadMonitoring] Sample data from database:', sampleData.map(item => ({
          id: item.id,
          percentageLoad: item.percentageLoad,
          substationName: item.substationName,
          percentageLoadType: typeof item.percentageLoad,
          percentageLoadValue: item.percentageLoad,
          isOverload: typeof item.percentageLoad === 'number' ? item.percentageLoad >= 100 : 'N/A'
        })));
        
        // Also check for any records that might match our filter
        if (req.query.loadStatus === 'OVERLOAD') {
          const overloadQuery = 'SELECT c.id, c.percentageLoad, c.substationName FROM c WHERE c.percentageLoad >= 100 LIMIT 3';
          const { resources: overloadData } = await container.items.query(overloadQuery).fetchAll();
          console.log('[LoadMonitoring] OVERLOAD filter test query result:', overloadData.length, 'records found');
          console.log('[LoadMonitoring] OVERLOAD records:', overloadData);
        }
        
        // Check total records in database
        const totalQuery = 'SELECT VALUE COUNT(1) FROM c';
        const { resources: totalData } = await container.items.query(totalQuery).fetchAll();
        console.log('[LoadMonitoring] Total records in database:', totalData[0] || 0);
        
        // Check if percentageLoad field exists and has values
        const percentageQuery = 'SELECT c.id, c.percentageLoad FROM c WHERE c.percentageLoad != null AND c.percentageLoad != undefined LIMIT 3';
        const { resources: percentageData } = await container.items.query(percentageQuery).fetchAll();
        console.log('[LoadMonitoring] Records with percentageLoad field:', percentageData.length);
        console.log('[LoadMonitoring] percentageLoad values:', percentageData);
        
        // Check what fields are available in the first record
        if (sampleData.length > 0) {
          const firstRecord = sampleData[0];
          console.log('[LoadMonitoring] First record fields:', Object.keys(firstRecord));
          console.log('[LoadMonitoring] First record sample:', {
            id: firstRecord.id,
            percentageLoad: firstRecord.percentageLoad,
            percentage_load: firstRecord.percentage_load,
            loadPercentage: firstRecord.loadPercentage,
            load_percentage: firstRecord.load_percentage
          });
        }
        
      } catch (error) {
        console.error('[LoadMonitoring] Error getting sample data:', error);
      }
    
    const startTime = Date.now();
    let resources = [];
    let executionTime = 0;
    
    try {
      // For very large queries, use streaming approach
      if (finalLimit > 5000) {
        console.log('[LoadMonitoring] Large query detected, using streaming approach');
        const queryIterator = container.items.query(queryStr);
        const results = [];
        
        for await (const item of queryIterator) {
          results.push(item);
          if (results.length >= finalLimit) break;
        }
        resources = results;
      } else {
        // Standard approach for smaller queries
        const result = await container.items.query(queryStr).fetchAll();
        resources = result.resources;
      }
      
      executionTime = Date.now() - startTime;
      console.log('[LoadMonitoring] Query executed successfully in', executionTime, 'ms');
    } catch (queryError) {
      console.error('[LoadMonitoring] Query execution error:', queryError);
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
      
      console.log('[LoadMonitoring] Count query:', countQuery);
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      totalCount = countResources[0] ?? 0;
      console.log('[LoadMonitoring] Count query result:', totalCount);
    } catch (countError) {
      console.error('[LoadMonitoring] Count query error:', countError);
      // Don't fail the request, just use the current page count
      totalCount = resources.length;
    }

    // Enhanced logging with performance metrics
    console.log('[LoadMonitoring] Query result:', {
      count: resources.length,
      total: totalCount,
      executionTime: `${executionTime}ms`,
      pagination: {
        page: Math.floor(offset / finalLimit) + 1,
        pageSize: finalLimit,
        totalPages: Math.ceil(totalCount / finalLimit),
        offset,
        finalLimit
      },
      sample: resources.slice(0, 2).map(item => ({
        id: item.id,
        region: item.region,
        district: item.district,
        feederName: item.feederName,
        status: item.status,
        percentageLoad: item.percentageLoad
      }))
    });

    // Structured response with pagination metadata
    res.json({
      data: resources,
      total: totalCount,
      page: Math.floor(offset / finalLimit) + 1,
      pageSize: finalLimit,
      totalPages: Math.ceil(totalCount / finalLimit),
      hasNextPage: (Math.floor(offset / finalLimit) + 1) < Math.ceil(totalCount / finalLimit),
      hasPreviousPage: offset > 0
    });

  } catch (err) {
    console.error('Error in load monitoring route:', err);
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
    console.log('[LoadMonitoring] GET by ID request for:', id);

    const { resource } = await container.item(id, id).read();
    if (!resource) {
      return res.status(404).json({ error: 'Load monitoring record not found' });
    }
    res.json(resource);
  } catch (err) {
    console.error('Error getting load monitoring record:', err);
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
    const { resource } = await container.item(id, id).replace(req.body);
    res.json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
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