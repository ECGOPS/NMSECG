import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the service account key
const serviceAccount = JSON.parse(
  await readFile(join(__dirname, '../serviceAccountKey.json'), 'utf8')
);

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Sample VIT assets data
const vitAssets = [
  {
    regionId: 'region1', // SUBTRANSMISSION ACCRA
    districtId: 'district1', // SUBSTATION MAINTENANCE
    voltageLevel: '33KV',
    typeOfUnit: 'Ring Main Unit',
    serialNumber: 'RMU2024-001',
    location: 'Achimota Substation',
    gpsCoordinates: '5.6037, -0.2270',
    status: 'Operational',
    protection: 'Overcurrent, Earth Fault',
    createdBy: 'admin@faultmaster.com',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    regionId: 'region1',
    districtId: 'district1',
    voltageLevel: '11KV',
    typeOfUnit: 'Circuit Breaker',
    serialNumber: 'CB2024-001',
    location: 'Achimota Substation',
    gpsCoordinates: '5.6037, -0.2270',
    status: 'Operational',
    protection: 'Overcurrent, Earth Fault, Under Voltage',
    createdBy: 'admin@faultmaster.com',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

// Sample VIT inspections data
const vitInspections = [
  {
    assetId: '', // Will be set after asset creation
    regionId: 'region1',
    districtId: 'district1',
    inspectionDate: new Date().toISOString(),
    inspectedBy: 'admin@faultmaster.com',
    visualInspection: 'Good',
    insulationResistance: 'Pass',
    primaryInjection: 'Pass',
    secondaryInjection: 'Pass',
    remarks: 'Regular maintenance inspection completed',
    nextInspectionDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days from now
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

// Sample OP5 faults data
const op5Faults = [
  {
    regionId: 'region1',
    districtId: 'district1',
    faultType: 'Overcurrent',
    description: 'Phase overcurrent protection operated',
    location: 'Achimota Substation',
    reportedBy: 'admin@faultmaster.com',
    status: 'Resolved',
    resolutionDetails: 'Fault cleared after investigation',
    reportedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    resolvedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

// Sample control outages data
const controlOutages = [
  {
    regionId: 'region1',
    districtId: 'district1',
    outageType: 'Planned',
    description: 'Scheduled maintenance outage',
    location: 'Achimota Substation',
    reportedBy: 'admin@faultmaster.com',
    status: 'Completed',
    startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

// Sample Overhead Line Inspections data
const overheadLineInspections = [
  {
    regionId: 'region1',
    districtId: 'district1',
    lineId: 'ACH-KOF-33KV', // Achimota to Koftown 33KV line
    inspectionDate: new Date().toISOString(),
    inspectedBy: 'admin@faultmaster.com',
    startPoint: 'Achimota Substation',
    endPoint: 'Koftown Substation',
    distance: '15.5',
    distanceUnit: 'km',
    weather: 'Clear',
    items: [
      {
        category: 'Poles',
        condition: 'Good',
        remarks: 'All poles in good condition'
      },
      {
        category: 'Conductors',
        condition: 'Good',
        remarks: 'No visible damage or sagging'
      },
      {
        category: 'Insulators',
        condition: 'Fair',
        remarks: 'Two insulators showing signs of wear, marked for replacement'
      },
      {
        category: 'Cross Arms',
        condition: 'Good',
        remarks: 'Properly aligned and secured'
      },
      {
        category: 'Stay Wires',
        condition: 'Good',
        remarks: 'All stay wires properly tensioned'
      }
    ],
    recommendations: 'Schedule replacement of marked insulators within next 3 months',
    nextInspectionDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 180 days from now
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

// Sample Substation Inspections data
const substationInspections = [
  {
    id: 'substation-inspection-1',
    region: 'Greater Accra',
    district: 'Accra East',
    date: new Date().toISOString(),
    substationNo: 'SUB-001',
    substationName: 'Achimota Substation',
    type: 'indoor',
    items: [],
    generalBuilding: [
      { id: 'gb-1', name: 'Building Structure', status: 'good', remarks: 'In good condition', category: 'general building' },
      { id: 'gb-2', name: 'Cleanliness', status: 'good', remarks: 'Well maintained', category: 'general building' },
      { id: 'gb-3', name: 'Lighting', status: 'good', remarks: 'All lights functional', category: 'general building' }
    ],
    controlEquipment: [
      { id: 'ce-1', name: 'Control Panels', status: 'good', remarks: 'Operating normally', category: 'control equipment' },
      { id: 'ce-2', name: 'Wiring', status: 'good', remarks: 'No exposed wires', category: 'control equipment' },
      { id: 'ce-3', name: 'Batteries', status: 'good', remarks: 'Voltage normal', category: 'control equipment' }
    ],
    powerTransformer: [
      { id: 'pt-1', name: 'Oil Level', status: 'good', remarks: 'Within range', category: 'power transformer' },
      { id: 'pt-2', name: 'Bushings', status: 'good', remarks: 'No damage', category: 'power transformer' },
      { id: 'pt-3', name: 'Cooling System', status: 'good', remarks: 'Working properly', category: 'power transformer' }
    ],
    outdoorEquipment: [
      { id: 'oe-1', name: 'Circuit Breakers', status: 'good', remarks: 'Operating correctly', category: 'outdoor equipment' },
      { id: 'oe-2', name: 'Disconnect Switches', status: 'good', remarks: 'No issues', category: 'outdoor equipment' },
      { id: 'oe-3', name: 'Surge Arresters', status: 'good', remarks: 'All intact', category: 'outdoor equipment' }
    ],
    remarks: 'Overall inspection shows equipment in good condition',
    createdBy: 'admin@faultmaster.com',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    inspectionDate: new Date().toISOString(),
    inspectedBy: 'admin@faultmaster.com'
  }
];

async function populateCollection(collectionName, data) {
  console.log(`\nPopulating ${collectionName}...`);
  try {
    for (const item of data) {
      const docRef = await db.collection(collectionName).add(item);
      console.log(`Added document with ID: ${docRef.id}`);
      
      // If this is a VIT asset, update the inspection with the asset ID
      if (collectionName === 'vitAssets' && vitInspections.length > 0) {
        vitInspections[0].assetId = docRef.id;
      }
    }
    console.log(`Successfully populated ${collectionName}`);
  } catch (error) {
    console.error(`Error populating ${collectionName}:`, error);
  }
}

async function populateDatabase() {
  try {
    // Populate collections in order
    await populateCollection('vitAssets', vitAssets);
    await populateCollection('vitInspections', vitInspections);
    await populateCollection('op5Faults', op5Faults);
    await populateCollection('controlOutages', controlOutages);
    await populateCollection('overheadLineInspections', overheadLineInspections);
    await populateCollection('substationInspections', substationInspections);
    
    console.log('\nDatabase population completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error populating database:', error);
    process.exit(1);
  }
}

populateDatabase(); 