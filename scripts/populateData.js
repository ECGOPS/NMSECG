import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

// Helper function to get random item from array
const getRandomItem = (array) => array[Math.floor(Math.random() * array.length)];

// Helper function to get random date within last 30 days
const getRandomDate = (daysAgo = 30) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date.toISOString();
};

// Helper function to get random number between min and max
const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function populateData() {
  try {
    // Read the service account key
    const serviceAccount = JSON.parse(
      await readFile(new URL('../serviceAccountKey.json', import.meta.url))
    );

    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    const db = admin.firestore();
    
    // Get all regions and districts
    const regionsSnapshot = await db.collection('regions').get();
    const districtsSnapshot = await db.collection('districts').get();
    
    const regions = regionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const districts = districtsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Batch for writing data
    let batch = db.batch();
    let operationCount = 0;
    const MAX_BATCH_SIZE = 500;

    // Helper function to commit batch and create new one
    const commitBatchIfNeeded = async () => {
      if (operationCount >= MAX_BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        operationCount = 0;
        console.log('Committed batch, creating new one...');
      }
    };

    // Sample data arrays
    const voltages = ['11kV', '33kV', '161kV'];
    const statuses = ['operational', 'faulty', 'maintenance'];
    const manufacturers = ['ABB', 'Siemens', 'Schneider', 'GE'];
    const faultTypes = ['Overcurrent', 'Earth Fault', 'Distance Protection', 'Differential'];
    const yesNo = ['yes', 'no'];
    const conditions = ['good', 'bad'];

    console.log('Starting data population...');

    // 1. Populate VIT Assets (50 assets)
    console.log('Populating VIT Assets...');
    for (let i = 0; i < 50; i++) {
      const district = getRandomItem(districts);
      const region = regions.find(r => r.id === district.regionId);
      
      const assetRef = db.collection('vitAssets').doc();
      batch.set(assetRef, {
        substationName: `Substation-${i + 1}`,
        substationNo: `SUB${String(i + 1).padStart(3, '0')}`,
        voltageLevel: getRandomItem(voltages),
        manufacturer: getRandomItem(manufacturers),
        serialNumber: `SN${Math.random().toString(36).substr(2, 9)}`,
        manufacturingYear: getRandomNumber(2000, 2023),
        commissioningDate: getRandomDate(365),
        status: getRandomItem(statuses),
        lastMaintenanceDate: getRandomDate(90),
        nextMaintenanceDate: getRandomDate(-90), // Future date
        regionId: region.id,
        region: region.name,
        districtId: district.id,
        district: district.name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      operationCount++;
      await commitBatchIfNeeded();
    }

    // 2. Populate VIT Inspections (100 inspections)
    console.log('Populating VIT Inspections...');
    for (let i = 0; i < 100; i++) {
      const district = getRandomItem(districts);
      const region = regions.find(r => r.id === district.regionId);
      
      const inspectionRef = db.collection('vitInspections').doc();
      batch.set(inspectionRef, {
        inspectionDate: getRandomDate(30),
        substationName: `Substation-${getRandomNumber(1, 50)}`,
        substationNo: `SUB${String(getRandomNumber(1, 50)).padStart(3, '0')}`,
        inspectorName: `Inspector ${i + 1}`,
        visualInspection: getRandomItem(conditions),
        oilLeakage: getRandomItem(yesNo),
        silicaGelCondition: getRandomItem(conditions),
        oilLevel: getRandomItem(conditions),
        tankCondition: getRandomItem(conditions),
        bushingCondition: getRandomItem(conditions),
        paintworkCondition: getRandomItem(conditions),
        comments: `Inspection comments for record ${i + 1}`,
        regionId: region.id,
        region: region.name,
        districtId: district.id,
        district: district.name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      operationCount++;
      await commitBatchIfNeeded();
    }

    // 3. Populate OP5 Faults (30 faults)
    console.log('Populating OP5 Faults...');
    for (let i = 0; i < 30; i++) {
      const district = getRandomItem(districts);
      const region = regions.find(r => r.id === district.regionId);
      const isResolved = Math.random() > 0.5;
      
      const faultRef = db.collection('op5Faults').doc();
      batch.set(faultRef, {
        faultType: getRandomItem(faultTypes),
        substationName: `Substation-${getRandomNumber(1, 50)}`,
        substationNo: `SUB${String(getRandomNumber(1, 50)).padStart(3, '0')}`,
        occurrenceDate: getRandomDate(60),
        restorationDate: isResolved ? getRandomDate(30) : null,
        repairDate: isResolved ? getRandomDate(30) : null,
        description: `Fault description for record ${i + 1}`,
        status: isResolved ? 'resolved' : 'active',
        mttr: isResolved ? getRandomNumber(1, 24) : null,
        regionId: region.id,
        region: region.name,
        districtId: district.id,
        district: district.name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      operationCount++;
      await commitBatchIfNeeded();
    }

    // 4. Populate Control System Outages (25 outages)
    console.log('Populating Control System Outages...');
    for (let i = 0; i < 25; i++) {
      const district = getRandomItem(districts);
      const region = regions.find(r => r.id === district.regionId);
      const isResolved = Math.random() > 0.5;
      const loadMW = getRandomNumber(10, 100);
      
      const outageRef = db.collection('controlOutages').doc();
      batch.set(outageRef, {
        substationName: `Substation-${getRandomNumber(1, 50)}`,
        substationNo: `SUB${String(getRandomNumber(1, 50)).padStart(3, '0')}`,
        occurrenceDate: getRandomDate(60),
        restorationDate: isResolved ? getRandomDate(30) : null,
        description: `Outage description for record ${i + 1}`,
        status: isResolved ? 'resolved' : 'active',
        loadMW: loadMW,
        unservedEnergyMWh: isResolved ? loadMW * getRandomNumber(1, 24) : null,
        regionId: region.id,
        region: region.name,
        districtId: district.id,
        district: district.name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      operationCount++;
      await commitBatchIfNeeded();
    }

    // 5. Populate Substation Inspections (75 inspections)
    console.log('Populating Substation Inspections...');
    for (let i = 0; i < 75; i++) {
      const district = getRandomItem(districts);
      const region = regions.find(r => r.id === district.regionId);
      
      const inspectionRef = db.collection('substationInspections').doc();
      batch.set(inspectionRef, {
        id: inspectionRef.id,
        inspectionDate: getRandomDate(30),
        substationName: `Substation-${getRandomNumber(1, 50)}`,
        substationNo: `SUB${String(getRandomNumber(1, 50)).padStart(3, '0')}`,
        type: getRandomItem(['indoor', 'outdoor']),
        date: getRandomDate(30),
        inspectedBy: `Inspector ${i + 1}`,
        regionId: region.id,
        region: region.name,
        districtId: district.id,
        district: district.name,
        items: [],
        generalBuilding: [
          { id: `gb-structure-${i}`, name: 'Building Structure', status: getRandomItem(['good', 'bad']), remarks: '', category: 'general building' },
          { id: `gb-clean-${i}`, name: 'Cleanliness', status: getRandomItem(['good', 'bad']), remarks: '', category: 'general building' },
          { id: `gb-light-${i}`, name: 'Lighting', status: getRandomItem(['good', 'bad']), remarks: '', category: 'general building' }
        ],
        controlEquipment: [
          { id: `ce-panels-${i}`, name: 'Control Panels', status: getRandomItem(['good', 'bad']), remarks: '', category: 'control equipment' },
          { id: `ce-wiring-${i}`, name: 'Wiring', status: getRandomItem(['good', 'bad']), remarks: '', category: 'control equipment' },
          { id: `ce-batteries-${i}`, name: 'Batteries', status: getRandomItem(['good', 'bad']), remarks: '', category: 'control equipment' }
        ],
        powerTransformer: [
          { id: `pt-oil-${i}`, name: 'Oil Level', status: getRandomItem(['good', 'bad']), remarks: '', category: 'power transformer' },
          { id: `pt-bushings-${i}`, name: 'Bushings', status: getRandomItem(['good', 'bad']), remarks: '', category: 'power transformer' },
          { id: `pt-cooling-${i}`, name: 'Cooling System', status: getRandomItem(['good', 'bad']), remarks: '', category: 'power transformer' }
        ],
        outdoorEquipment: [
          { id: `oe-breakers-${i}`, name: 'Circuit Breakers', status: getRandomItem(['good', 'bad']), remarks: '', category: 'outdoor equipment' },
          { id: `oe-switches-${i}`, name: 'Disconnect Switches', status: getRandomItem(['good', 'bad']), remarks: '', category: 'outdoor equipment' },
          { id: `oe-surge-${i}`, name: 'Surge Arresters', status: getRandomItem(['good', 'bad']), remarks: '', category: 'outdoor equipment' }
        ],
        remarks: `Inspection comments for record ${i + 1}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'admin@faultmaster.com'
      });
      operationCount++;
      await commitBatchIfNeeded();
    }

    // 6. Populate Load Monitoring Records (100 records)
    console.log('Populating Load Monitoring Records...');
    for (let i = 0; i < 100; i++) {
      const district = getRandomItem(districts);
      const region = regions.find(r => r.id === district.regionId);
      
      const recordRef = db.collection('loadMonitoring').doc();
      batch.set(recordRef, {
        recordDate: getRandomDate(30),
        substationName: `Substation-${getRandomNumber(1, 50)}`,
        substationNo: `SUB${String(getRandomNumber(1, 50)).padStart(3, '0')}`,
        voltageLevel: getRandomItem(voltages),
        currentLoadMW: getRandomNumber(10, 100),
        peakLoadMW: getRandomNumber(50, 150),
        powerFactor: (Math.random() * (1 - 0.8) + 0.8).toFixed(2),
        temperature: getRandomNumber(20, 40),
        comments: `Load monitoring comments for record ${i + 1}`,
        regionId: region.id,
        region: region.name,
        districtId: district.id,
        district: district.name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      operationCount++;
      await commitBatchIfNeeded();
    }

    // 7. Populate Overhead Line Inspections (60 inspections)
    console.log('Populating Overhead Line Inspections...');
    for (let i = 0; i < 60; i++) {
      const district = getRandomItem(districts);
      const region = regions.find(r => r.id === district.regionId);
      
      const inspectionRef = db.collection('overheadLineInspections').doc();
      batch.set(inspectionRef, {
        inspectionDate: getRandomDate(30),
        lineSection: `Line-${i + 1}`,
        voltageLevel: getRandomItem(voltages),
        inspectorName: `Inspector ${i + 1}`,
        poleCondition: getRandomItem(conditions),
        conductorCondition: getRandomItem(conditions),
        insulatorCondition: getRandomItem(conditions),
        crossArmCondition: getRandomItem(conditions),
        stayWireCondition: getRandomItem(conditions),
        vegetationClearance: getRandomItem(yesNo),
        comments: `Overhead line inspection comments for record ${i + 1}`,
        regionId: region.id,
        region: region.name,
        districtId: district.id,
        district: district.name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      operationCount++;
      await commitBatchIfNeeded();
    }

    // Commit any remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }

    console.log('Successfully populated all data!');
    console.log('Summary:');
    console.log('- 50 VIT Assets');
    console.log('- 100 VIT Inspections');
    console.log('- 30 OP5 Faults');
    console.log('- 25 Control System Outages');
    console.log('- 75 Substation Inspections');
    console.log('- 100 Load Monitoring Records');
    console.log('- 60 Overhead Line Inspections');

  } catch (error) {
    console.error('Error populating data:', error);
  } finally {
    // Clean up
    admin.app().delete();
  }
}

populateData(); 