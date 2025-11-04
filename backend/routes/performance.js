const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole, requireAuth } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);

/**
 * Performance Tracking Routes
 * 
 * Calculates actual vs target performance for:
 * - Load Monitoring: Count of records
 * - Substation Inspection: Count of inspections
 * - Overhead Line: Feeder Length in km (calculated from GPS coordinates)
 */

// Helper function to calculate distance between two GPS coordinates (Haversine formula)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper function to extract latitude and longitude from various formats
function extractCoordinates(inspection) {
  let lat = null;
  let lon = null;

  // Try direct latitude/longitude fields (numbers)
  if (typeof inspection.latitude === 'number' && !isNaN(inspection.latitude)) {
    lat = inspection.latitude;
  } else if (inspection.latitude !== null && inspection.latitude !== undefined) {
    // Try parsing as string
    const parsedLat = parseFloat(inspection.latitude);
    if (!isNaN(parsedLat)) lat = parsedLat;
  }

  if (typeof inspection.longitude === 'number' && !isNaN(inspection.longitude)) {
    lon = inspection.longitude;
  } else if (inspection.longitude !== null && inspection.longitude !== undefined) {
    // Try parsing as string
    const parsedLon = parseFloat(inspection.longitude);
    if (!isNaN(parsedLon)) lon = parsedLon;
  }

  // Try GPS coordinates object/array format
  if (!lat || !lon) {
    if (inspection.gpsCoordinates) {
      if (typeof inspection.gpsCoordinates === 'object') {
        if (inspection.gpsCoordinates.latitude && inspection.gpsCoordinates.longitude) {
          lat = parseFloat(inspection.gpsCoordinates.latitude) || lat;
          lon = parseFloat(inspection.gpsCoordinates.longitude) || lon;
        } else if (Array.isArray(inspection.gpsCoordinates) && inspection.gpsCoordinates.length >= 2) {
          lat = parseFloat(inspection.gpsCoordinates[0]) || lat;
          lon = parseFloat(inspection.gpsCoordinates[1]) || lon;
        }
      } else if (typeof inspection.gpsCoordinates === 'string') {
        // Try parsing "lat,lon" or "[lat,lon]" format
        const match = inspection.gpsCoordinates.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
        if (match) {
          lat = parseFloat(match[1]) || lat;
          lon = parseFloat(match[2]) || lon;
        }
      }
    }
  }

  // Try gpsLocation field
  if ((!lat || !lon) && inspection.gpsLocation) {
    if (typeof inspection.gpsLocation === 'string') {
      const match = inspection.gpsLocation.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
      if (match) {
        lat = parseFloat(match[1]) || lat;
        lon = parseFloat(match[2]) || lon;
      }
    }
  }

  // Validate coordinates are within valid ranges
  if (lat !== null && lon !== null && 
      typeof lat === 'number' && typeof lon === 'number' &&
      !isNaN(lat) && !isNaN(lon) &&
      lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
      lat !== 0 && lon !== 0) { // Exclude 0,0 which is likely invalid/default
    return { latitude: lat, longitude: lon };
  }

  return null;
}

// Helper function to calculate feeder length from GPS coordinates
// This matches the frontend logic: groups by feederName, calculates per feeder, then sums
function calculateFeederLength(inspections) {
  if (!inspections || inspections.length === 0) {
    console.log('[Performance] No inspections provided for feeder length calculation');
    return 0;
  }

  console.log(`[Performance] Calculating feeder length from ${inspections.length} inspections`);

  // Extract valid coordinates from inspections
  const validInspections = [];
  for (const inspection of inspections) {
    const coords = extractCoordinates(inspection);
    if (coords && inspection.feederName) {
      validInspections.push({
        ...inspection,
        latitude: coords.latitude,
        longitude: coords.longitude,
        feederName: inspection.feederName || inspection.feeder || 'Unknown'
      });
    }
  }

  console.log(`[Performance] Found ${validInspections.length} inspections with valid GPS coordinates and feeder names`);

  if (validInspections.length === 0) {
    console.log('[Performance] No valid inspections with GPS coordinates and feeder names');
    return 0;
  }

  // Group inspections by feederName
  const feedersMap = {};
  validInspections.forEach(ins => {
    const feederName = ins.feederName || ins.feeder || 'Unknown';
    if (!feedersMap[feederName]) {
      feedersMap[feederName] = [];
    }
    feedersMap[feederName].push(ins);
  });

  console.log(`[Performance] Grouped inspections into ${Object.keys(feedersMap).length} feeders`);

  let totalLength = 0;

  // Calculate length for each feeder
  for (const [feederName, feederInspections] of Object.entries(feedersMap)) {
    if (feederInspections.length < 2) {
      console.log(`[Performance] Feeder "${feederName}": Only ${feederInspections.length} inspection(s), need at least 2 to calculate length`);
      continue;
    }

    // Sort by date and time (matching frontend logic)
    feederInspections.sort((a, b) => {
      // Try to combine date and time like frontend: date + 'T' + time
      const getDateValue = (ins) => {
        const dateStr = ins.date || ins.inspectionDate || ins.createdAt || '';
        const timeStr = ins.time || '00:00';
        
        // If date is in YYYY-MM-DD format, combine with time
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const combined = `${dateStr}T${timeStr}`;
          return new Date(combined).getTime();
        }
        
        // Otherwise try to parse as-is
        const dateValue = new Date(dateStr || 0).getTime();
        return dateValue;
      };
      
      const dateA = getDateValue(a);
      const dateB = getDateValue(b);
      return dateA - dateB;
    });

    // Calculate distance between consecutive points for this feeder
    let feederLength = 0;
    for (let i = 1; i < feederInspections.length; i++) {
      const prev = feederInspections[i - 1];
      const curr = feederInspections[i];
      const distance = haversineDistance(
        prev.latitude, 
        prev.longitude, 
        curr.latitude, 
        curr.longitude
      );
      feederLength += distance;
      console.log(`[Performance] Feeder "${feederName}" segment ${i}: ${distance.toFixed(3)} km`);
    }

    console.log(`[Performance] Feeder "${feederName}" total length: ${feederLength.toFixed(3)} km (${feederInspections.length} inspection points)`);
    totalLength += feederLength;
  }

  console.log(`[Performance] Total feeder length across all feeders: ${totalLength.toFixed(3)} km`);
  return totalLength;
}

// Helper function to get start and end of month
function getMonthBounds(month) {
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString()
  };
}

// GET performance for a specific district and month
router.get('/district/:districtId/month/:month', requireAuth(), requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'regional_general_manager', 'district_engineer', 'district_manager']), async (req, res) => {
  try {
    const { districtId, month } = req.params;
    const targetType = req.query.targetType || 'all'; // Optional filter by target type

    console.log('[Performance] GET request:', {
      districtId,
      month,
      targetType,
      user: req.user?.id,
      role: req.user?.role
    });

    // Validate month format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      return res.status(400).json({ error: 'Invalid month format. Expected YYYY-MM' });
    }

    // Get district info to find regionId
    const districtsContainer = database.container('districts');
    let districts;
    try {
      const { resources } = await districtsContainer.items.query(
        `SELECT * FROM c WHERE c.id = "${districtId}"`
      ).fetchAll();
      districts = resources;
    } catch (err) {
      console.error('[Performance] Error fetching district:', err);
      return res.status(500).json({ error: `Error fetching district: ${err.message}` });
    }

    if (districts.length === 0) {
      return res.status(404).json({ error: 'District not found' });
    }

    const district = districts[0];
    let regionId = district.regionId || district.region;
    
    // If regionId looks like a name, try to resolve it to an ID
    if (regionId && !regionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      // Looks like a name, try to find the region ID
      try {
        const regionsContainer = database.container('regions');
        const { resources: regions } = await regionsContainer.items.query(
          `SELECT * FROM c WHERE c.name = "${regionId}"`
        ).fetchAll();
        if (regions.length > 0) {
          regionId = regions[0].id;
          console.log('[Performance] Resolved region name to ID:', { name: district.regionId || district.region, id: regionId });
        }
      } catch (err) {
        console.warn('[Performance] Could not resolve region name:', err);
      }
    }

    // Get month bounds
    const { start, end } = getMonthBounds(month);

    // Get targets for this region/month
    // Priority: district-specific target > region-wide target
    let targets = [];
    try {
      const targetsContainer = database.container('targets');
      
      // First, try to find district-specific targets
      let districtTargetQuery = `SELECT * FROM c WHERE c.regionId = "${regionId}" AND c.month = "${month}" AND c.districtId = "${districtId}"`;
      if (targetType !== 'all') {
        districtTargetQuery += ` AND c.targetType = "${targetType}"`;
      }
      
      const { resources: districtTargets } = await targetsContainer.items.query(districtTargetQuery).fetchAll();
      
      // If no district-specific targets, get region-wide targets (districtId is null/empty)
      if (districtTargets.length === 0) {
        let regionTargetQuery = `SELECT * FROM c WHERE c.regionId = "${regionId}" AND c.month = "${month}" AND (NOT IS_DEFINED(c.districtId) OR c.districtId = null OR c.districtId = "")`;
        if (targetType !== 'all') {
          regionTargetQuery += ` AND c.targetType = "${targetType}"`;
        }
        const { resources: regionTargets } = await targetsContainer.items.query(regionTargetQuery).fetchAll();
        targets = regionTargets;
        console.log('[Performance] Using region-wide targets for district:', targets.length);
      } else {
        targets = districtTargets;
        console.log('[Performance] Using district-specific targets:', targets.length);
      }
    } catch (err) {
      // If targets container doesn't exist, that's okay - just return empty results
      console.warn('[Performance] Targets container not found or error querying targets:', err.message);
      // Continue with empty targets array - will return zeros if targetType specified
    }

    // Calculate actual values for each target type
    const results = [];

    for (const target of targets) {
      let actual = 0;
      const { targetType: targetTypeValue } = target;

      if (targetTypeValue === 'loadMonitoring') {
        // Count load monitoring records for this district in the month
        try {
          const loadContainer = database.container('loadMonitoring');
          const loadQuery = `SELECT VALUE COUNT(1) FROM c WHERE c.districtId = "${districtId}" AND c.date >= "${start}" AND c.date <= "${end}"`;
          const { resources: loadCount } = await loadContainer.items.query(loadQuery).fetchAll();
          actual = loadCount[0] || 0;
        } catch (err) {
          console.error('[Performance] Error counting load monitoring:', err);
          actual = 0;
        }
      } else if (targetTypeValue === 'substationInspection') {
        // Count substation inspections for this district in the month
        try {
          const substationContainer = database.container('substationInspections');
          const substationQuery = `SELECT VALUE COUNT(1) FROM c WHERE c.districtId = "${districtId}" AND c.date >= "${start}" AND c.date <= "${end}"`;
          const { resources: substationCount } = await substationContainer.items.query(substationQuery).fetchAll();
          actual = substationCount[0] || 0;
        } catch (err) {
          console.error('[Performance] Error counting substation inspections:', err);
          actual = 0;
        }
      } else if (targetTypeValue === 'overheadLine') {
        // Calculate feeder length from overhead line inspections
        try {
          const overheadContainer = database.container('overheadLineInspections');
          
          // Get date range for the month (YYYY-MM format)
          const [year, monthNum] = month.split('-').map(Number);
          const startDateStr = `${year}-${String(monthNum).padStart(2, '0')}-01`;
          const endDateStr = `${year}-${String(monthNum).padStart(2, '0')}-31`;
          
          // Try multiple query strategies to find inspections
          let overheadInspections = [];
          
          // Strategy 1: Query by date field (YYYY-MM-DD format)
          try {
            const dateQuery = `SELECT * FROM c WHERE c.districtId = "${districtId}" AND c.date >= "${startDateStr}" AND c.date <= "${endDateStr}"`;
            console.log(`[Performance] Trying date query (YYYY-MM-DD):`, dateQuery);
            const { resources: dateResults } = await overheadContainer.items.query(dateQuery).fetchAll();
            overheadInspections = dateResults;
            console.log(`[Performance] Found ${overheadInspections.length} inspections using date field`);
          } catch (err) {
            console.warn('[Performance] Date field query failed:', err.message);
          }
          
          // Strategy 2: Query by inspectionDate or createdAt (ISO format) if no results
          if (overheadInspections.length === 0) {
            try {
              const isoQuery = `SELECT * FROM c WHERE c.districtId = "${districtId}" AND ((c.inspectionDate >= "${start}" AND c.inspectionDate <= "${end}") OR (c.createdAt >= "${start}" AND c.createdAt <= "${end}"))`;
              console.log(`[Performance] Trying ISO date query:`, isoQuery);
              const { resources: isoResults } = await overheadContainer.items.query(isoQuery).fetchAll();
              overheadInspections = isoResults;
              console.log(`[Performance] Found ${overheadInspections.length} inspections using ISO date fields`);
            } catch (err) {
              console.warn('[Performance] ISO date query failed:', err.message);
            }
          }
          
          // Strategy 3: Query all for district (no date filter) as fallback for debugging
          if (overheadInspections.length === 0) {
            try {
              const allQuery = `SELECT * FROM c WHERE c.districtId = "${districtId}"`;
              console.log(`[Performance] Trying all inspections query for debugging:`, allQuery);
              const { resources: allResults } = await overheadContainer.items.query(allQuery).fetchAll();
              console.log(`[Performance] Found ${allResults.length} total inspections for district ${districtId} (no date filter)`);
              // Filter by month in JavaScript
              overheadInspections = allResults.filter(ins => {
                const insDate = ins.date || ins.inspectionDate || ins.createdAt;
                if (!insDate) return false;
                const dateStr = typeof insDate === 'string' ? insDate : insDate.toISOString();
                return dateStr.startsWith(month);
              });
              console.log(`[Performance] Filtered to ${overheadInspections.length} inspections in month ${month}`);
            } catch (err) {
              console.warn('[Performance] All inspections query failed:', err.message);
            }
          }
          
          console.log(`[Performance] Total overhead line inspections found for district ${districtId}, month ${month}: ${overheadInspections.length}`);
          
          if (overheadInspections.length > 0) {
            console.log('[Performance] Sample inspection data:', JSON.stringify({
              id: overheadInspections[0].id,
              latitude: overheadInspections[0].latitude,
              longitude: overheadInspections[0].longitude,
              gpsCoordinates: overheadInspections[0].gpsCoordinates,
              inspectionDate: overheadInspections[0].inspectionDate,
              date: overheadInspections[0].date,
              createdAt: overheadInspections[0].createdAt,
              districtId: overheadInspections[0].districtId
            }, null, 2));
            
            // Log all coordinate information
            overheadInspections.forEach((ins, idx) => {
              console.log(`[Performance] Inspection ${idx + 1}:`, {
                id: ins.id,
                hasLatitude: ins.latitude !== undefined && ins.latitude !== null,
                latitude: ins.latitude,
                hasLongitude: ins.longitude !== undefined && ins.longitude !== null,
                longitude: ins.longitude,
                hasGpsCoordinates: ins.gpsCoordinates !== undefined && ins.gpsCoordinates !== null,
                gpsCoordinates: ins.gpsCoordinates
              });
            });
          }
          
          actual = calculateFeederLength(overheadInspections);
          console.log(`[Performance] Calculated actual overhead line length: ${actual.toFixed(3)} km`);
        } catch (err) {
          console.error('[Performance] Error calculating overhead line length:', err);
          console.error('[Performance] Error stack:', err.stack);
          actual = 0;
        }
      }

      const targetValue = target.targetValue || 0;
      const variance = actual - targetValue;
      const percentage = targetValue > 0 ? (actual / targetValue) * 100 : 0;

      results.push({
        districtId,
        district: district.name || district.district || districtId,
        regionId,
        region: district.region || district.regionName || '',
        month,
        targetType: targetTypeValue,
        target: targetValue,
        actual,
        variance,
        percentage: Number(percentage.toFixed(2)),
        targetId: target.id
      });
    }

    // If no targets found but targetType is specified, return empty result with district info
    if (results.length === 0 && targetType !== 'all') {
      return res.json([{
        districtId,
        district: district.name || district.district || districtId,
        regionId,
        region: district.region || district.regionName || '',
        month,
        targetType,
        target: 0,
        actual: 0,
        variance: 0,
        percentage: 0,
        targetId: null
      }]);
    }

    res.json(results);
  } catch (err) {
    console.error('[Performance] GET district error:', err);
    console.error('[Performance] Error stack:', err.stack);
    res.status(500).json({ 
      error: err.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// GET performance for all districts in a region
router.get('/region/:regionId/month/:month', requireAuth(), requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'regional_general_manager']), async (req, res) => {
  try {
    const { regionId, month } = req.params;
    const targetType = req.query.targetType || 'all';

    console.log('[Performance] GET region performance:', {
      regionId,
      month,
      targetType
    });

    // Validate month format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      return res.status(400).json({ error: 'Invalid month format. Expected YYYY-MM' });
    }

    // Try to resolve regionId - might be ID or name
    let actualRegionId = regionId;
    const regionsContainer = database.container('regions');
    
    // First, try to find region by ID
    let { resources: regionsById } = await regionsContainer.items.query(
      `SELECT * FROM c WHERE c.id = "${regionId}"`
    ).fetchAll();
    
    // If not found, try by name
    if (regionsById.length === 0) {
      const { resources: regionsByName } = await regionsContainer.items.query(
        `SELECT * FROM c WHERE c.name = "${regionId}"`
      ).fetchAll();
      if (regionsByName.length > 0) {
        actualRegionId = regionsByName[0].id;
        console.log('[Performance] Resolved region name to ID:', { name: regionId, id: actualRegionId });
      }
    } else {
      actualRegionId = regionsById[0].id;
    }

    // Get all districts in this region
    const districtsContainer = database.container('districts');
    let districts;
    try {
      const { resources } = await districtsContainer.items.query(
        `SELECT * FROM c WHERE c.regionId = "${actualRegionId}"`
      ).fetchAll();
      districts = resources;
    } catch (err) {
      console.error('[Performance] Error fetching districts:', err);
      // Try alternative query if regionId field doesn't exist
      try {
        const { resources } = await districtsContainer.items.query(
          `SELECT * FROM c WHERE c.region = "${regionId}" OR c.regionId = "${actualRegionId}"`
        ).fetchAll();
        districts = resources;
      } catch (err2) {
        console.error('[Performance] Error with alternative district query:', err2);
        throw err2;
      }
    }

    if (districts.length === 0) {
      return res.json([]);
    }

    // Get month bounds
    const { start, end } = getMonthBounds(month);

    // Get targets for this region/month
    let targets = [];
    try {
      const targetsContainer = database.container('targets');
      let targetsQuery = `SELECT * FROM c WHERE c.regionId = "${actualRegionId}" AND c.month = "${month}"`;
      
      if (targetType !== 'all') {
        targetsQuery += ` AND c.targetType = "${targetType}"`;
      }

      const { resources } = await targetsContainer.items.query(targetsQuery).fetchAll();
      targets = resources;
      console.log('[Performance] Found targets for region:', targets.length);
    } catch (err) {
      // If targets container doesn't exist, that's okay - just return empty results
      console.warn('[Performance] Targets container not found or error querying targets:', err.message);
      // Continue with empty targets array - will return zeros if targetType specified
    }

    // Calculate performance for each district
    const results = [];

    for (const district of districts) {
      const districtId = district.id;

      // For each target type, find the appropriate target
      // Priority: district-specific target > region-wide target
      const targetTypesToProcess = targetType !== 'all' ? [targetType] : ['loadMonitoring', 'substationInspection', 'overheadLine'];
      
      for (const type of targetTypesToProcess) {
        // First, try to find a district-specific target
        // Compare as strings to handle any type differences
        let target = targets.find(t => 
          t.targetType === type && 
          String(t.districtId || '').trim() === String(districtId || '').trim() &&
          String(t.districtId || '').trim() !== ''
        );
        
        // If no district-specific target, use region-wide target (districtId is null, undefined, empty string, or not defined)
        if (!target) {
          target = targets.find(t => 
            t.targetType === type && 
            (!t.districtId || t.districtId === null || t.districtId === undefined || String(t.districtId).trim() === '')
          );
        }
        
        // Log which type of target is being used for debugging
        if (target) {
          console.log(`[Performance] District ${district.name || districtId}, Type ${type}: Using ${target.districtId ? 'district-specific' : 'region-wide'} target (ID: ${target.id}, Value: ${target.targetValue})`);
        }
        
        // If still no target and we're filtering by type, create default entry
        if (!target && targetType !== 'all') {
          results.push({
            districtId,
            district: district.name || district.district || districtId,
            regionId: actualRegionId,
            region: district.region || district.regionName || regionId,
            month,
            targetType: type,
            target: 0,
            actual: 0,
            variance: 0,
            percentage: 0,
            targetId: null
          });
          continue;
        }
        
        // Skip if no target found (when showing all types)
        if (!target) {
          continue;
        }
        
        let actual = 0;

        if (type === 'loadMonitoring') {
          try {
            const loadContainer = database.container('loadMonitoring');
            const loadQuery = `SELECT VALUE COUNT(1) FROM c WHERE c.districtId = "${districtId}" AND c.date >= "${start}" AND c.date <= "${end}"`;
            const { resources: loadCount } = await loadContainer.items.query(loadQuery).fetchAll();
            actual = loadCount[0] || 0;
          } catch (err) {
            console.error('[Performance] Error counting load monitoring:', err);
            actual = 0;
          }
        } else if (type === 'substationInspection') {
          try {
            const substationContainer = database.container('substationInspections');
            const substationQuery = `SELECT VALUE COUNT(1) FROM c WHERE c.districtId = "${districtId}" AND c.date >= "${start}" AND c.date <= "${end}"`;
            const { resources: substationCount } = await substationContainer.items.query(substationQuery).fetchAll();
            actual = substationCount[0] || 0;
          } catch (err) {
            console.error('[Performance] Error counting substation inspections:', err);
            actual = 0;
          }
        } else if (type === 'overheadLine') {
          try {
            const overheadContainer = database.container('overheadLineInspections');
            
            // Get date range for the month (YYYY-MM format)
            const [year, monthNum] = month.split('-').map(Number);
            const startDateStr = `${year}-${String(monthNum).padStart(2, '0')}-01`;
            const endDateStr = `${year}-${String(monthNum).padStart(2, '0')}-31`;
            
            // Try multiple query strategies to find inspections
            let overheadInspections = [];
            
            // Strategy 1: Query by date field (YYYY-MM-DD format)
            try {
              const dateQuery = `SELECT * FROM c WHERE c.districtId = "${districtId}" AND c.date >= "${startDateStr}" AND c.date <= "${endDateStr}"`;
              console.log(`[Performance] Trying date query (YYYY-MM-DD):`, dateQuery);
              const { resources: dateResults } = await overheadContainer.items.query(dateQuery).fetchAll();
              overheadInspections = dateResults;
              console.log(`[Performance] Found ${overheadInspections.length} inspections using date field`);
            } catch (err) {
              console.warn('[Performance] Date field query failed:', err.message);
            }
            
            // Strategy 2: Query by inspectionDate or createdAt (ISO format) if no results
            if (overheadInspections.length === 0) {
              try {
                const isoQuery = `SELECT * FROM c WHERE c.districtId = "${districtId}" AND ((c.inspectionDate >= "${start}" AND c.inspectionDate <= "${end}") OR (c.createdAt >= "${start}" AND c.createdAt <= "${end}"))`;
                console.log(`[Performance] Trying ISO date query:`, isoQuery);
                const { resources: isoResults } = await overheadContainer.items.query(isoQuery).fetchAll();
                overheadInspections = isoResults;
                console.log(`[Performance] Found ${overheadInspections.length} inspections using ISO date fields`);
              } catch (err) {
                console.warn('[Performance] ISO date query failed:', err.message);
              }
            }
            
            // Strategy 3: Query all for district (no date filter) as fallback for debugging
            if (overheadInspections.length === 0) {
              try {
                const allQuery = `SELECT * FROM c WHERE c.districtId = "${districtId}"`;
                console.log(`[Performance] Trying all inspections query for debugging:`, allQuery);
                const { resources: allResults } = await overheadContainer.items.query(allQuery).fetchAll();
                console.log(`[Performance] Found ${allResults.length} total inspections for district ${districtId} (no date filter)`);
                // Filter by month in JavaScript
                overheadInspections = allResults.filter(ins => {
                  const insDate = ins.date || ins.inspectionDate || ins.createdAt;
                  if (!insDate) return false;
                  const dateStr = typeof insDate === 'string' ? insDate : insDate.toISOString();
                  return dateStr.startsWith(month);
                });
                console.log(`[Performance] Filtered to ${overheadInspections.length} inspections in month ${month}`);
              } catch (err) {
                console.warn('[Performance] All inspections query failed:', err.message);
              }
            }
            
            console.log(`[Performance] Total overhead line inspections found for district ${districtId}, month ${month}: ${overheadInspections.length}`);
            
            if (overheadInspections.length > 0) {
              console.log('[Performance] Sample inspection data:', JSON.stringify({
                id: overheadInspections[0].id,
                latitude: overheadInspections[0].latitude,
                longitude: overheadInspections[0].longitude,
                gpsCoordinates: overheadInspections[0].gpsCoordinates,
                inspectionDate: overheadInspections[0].inspectionDate,
                date: overheadInspections[0].date,
                createdAt: overheadInspections[0].createdAt,
                districtId: overheadInspections[0].districtId
              }, null, 2));
              
              // Log all coordinate information
              overheadInspections.forEach((ins, idx) => {
                console.log(`[Performance] Inspection ${idx + 1}:`, {
                  id: ins.id,
                  hasLatitude: ins.latitude !== undefined && ins.latitude !== null,
                  latitude: ins.latitude,
                  hasLongitude: ins.longitude !== undefined && ins.longitude !== null,
                  longitude: ins.longitude,
                  hasGpsCoordinates: ins.gpsCoordinates !== undefined && ins.gpsCoordinates !== null,
                  gpsCoordinates: ins.gpsCoordinates
                });
              });
            }
            
            actual = calculateFeederLength(overheadInspections);
            console.log(`[Performance] Calculated actual overhead line length: ${actual.toFixed(3)} km`);
          } catch (err) {
            console.error('[Performance] Error calculating overhead line length:', err);
            console.error('[Performance] Error stack:', err.stack);
            actual = 0;
          }
        }

        const targetValue = target?.targetValue || 0;
        const variance = actual - targetValue;
        const percentage = targetValue > 0 ? (actual / targetValue) * 100 : 0;

        results.push({
          districtId,
          district: district.name || district.district || districtId,
          regionId: actualRegionId,
          region: district.region || district.regionName || regionId,
          month,
          targetType: type,
          target: targetValue,
          actual,
          variance,
          percentage: Number(percentage.toFixed(2)),
          targetId: target?.id || null
        });
      }
    }

    res.json(results);
  } catch (err) {
    console.error('[Performance] GET region error:', err);
    console.error('[Performance] Error stack:', err.stack);
    res.status(500).json({ 
      error: err.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

module.exports = router;

