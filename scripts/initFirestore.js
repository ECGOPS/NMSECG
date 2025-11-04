import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
const serviceAccount = {
  "type": "service_account",
  "project_id": "omss-30595",
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
  "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_CERT_URL
};

let app;
try {
  app = initializeApp({
    credential: cert(serviceAccount)
  });
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  process.exit(1);
}

const db = getFirestore(app);
const auth = getAuth(app);

// Sample data for each collection
const sampleData = {
  'regions': [
    { id: 'region1', name: 'SUBTRANSMISSION ACCRA', code: 'STA', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region2', name: 'SUBTRANSMISSION ASHANTI', code: 'STAS', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region3', name: 'ACCRA EAST REGION', code: 'AER', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region4', name: 'ACCRA WEST REGION', code: 'AWR', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region5', name: 'ASHANTI EAST REGION', code: 'ASER', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region6', name: 'ASHANTI WEST REGION', code: 'ASWR', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region7', name: 'ASHANTI SOUTH REGION', code: 'ASSR', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region8', name: 'CENTRAL REGION', code: 'CR', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region9', name: 'EASTERN REGION', code: 'ER', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region10', name: 'TEMA REGION', code: 'TR', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region11', name: 'VOLTA REGION', code: 'VR', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region12', name: 'WESTERN REGION', code: 'WR', createdAt: new Date(), updatedAt: new Date() }
  ],
  'districts': [
    // SUBTRANSMISSION ACCRA
    { id: 'district1', name: 'SUBSTATION MAINTENANCE', code: 'SMA', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district2', name: 'LINE MAINTENANCE', code: 'LMA', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district3', name: 'PROTECTION', code: 'PRO', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district4', name: 'COMMUNICATION', code: 'COM', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district5', name: 'PLANNING', code: 'PLA', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district6', name: 'DESIGN', code: 'DES', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district7', name: 'CONSTRUCTION', code: 'CON', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district8', name: 'TESTING', code: 'TES', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district9', name: 'COMMISSIONING', code: 'COM', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district10', name: 'OPERATIONS', code: 'OPE', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district11', name: 'SAFETY', code: 'SAF', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district12', name: 'TRAINING', code: 'TRA', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district13', name: 'ADMINISTRATION', code: 'ADM', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district14', name: 'FINANCE', code: 'FIN', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district15', name: 'HUMAN RESOURCES', code: 'HR', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district16', name: 'IT', code: 'IT', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district17', name: 'PROCUREMENT', code: 'PRO', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district18', name: 'STORES', code: 'STO', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district19', name: 'TRANSPORT', code: 'TRA', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district20', name: 'SECURITY', code: 'SEC', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() }
  ],
  'users': [
    {
      id: 'user1',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'system_admin',
      region: null,
      district: null,
      staffId: 'ADM001',
      disabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'user2',
      name: 'District Engineer',
      email: 'engineer@example.com',
      role: 'district_engineer',
      region: 'SUBTRANSMISSION ACCRA',
      district: 'SUBSTATION MAINTENANCE',
      staffId: 'ENG001',
      disabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
};

async function clearCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  console.log(`Cleared collection: ${collectionName}`);
}

async function initializeCollection(collectionName, data) {
  try {
    // Clear existing data
    await clearCollection(collectionName);

    // Add new data
    const batch = db.batch();
    for (const item of data) {
      const docRef = db.collection(collectionName).doc(item.id);
      const itemData = { ...item };
      
      // Convert dates if they are Date objects
      if (itemData.createdAt instanceof Date) {
        itemData.createdAt = itemData.createdAt.toISOString();
      }
      if (itemData.updatedAt instanceof Date) {
        itemData.updatedAt = itemData.updatedAt.toISOString();
      }
      
      batch.set(docRef, itemData);
    }
    await batch.commit();
    console.log(`Initialized collection: ${collectionName}`);
  } catch (error) {
    console.error(`Error initializing ${collectionName}:`, error);
  }
}

async function initializeFirestore() {
  try {
    // First, create users in Authentication
    for (const user of sampleData.users) {
      try {
        await auth.createUser({
          uid: user.id,
          email: user.email,
          displayName: user.name,
          disabled: user.disabled
        });
        console.log(`Created user: ${user.email}`);
      } catch (error) {
        if (error.code === 'auth/uid-already-exists') {
          console.log(`User already exists: ${user.email}`);
        } else {
          console.error(`Error creating user ${user.email}:`, error);
        }
      }
    }

    // Then initialize collections
    for (const [collectionName, data] of Object.entries(sampleData)) {
      await initializeCollection(collectionName, data);
    }
    console.log('Firestore initialization completed successfully!');
  } catch (error) {
    console.error('Error initializing Firestore:', error);
  }
}

// Run the initialization
initializeFirestore(); 