const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');

// Demo configuration
const demoConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(demoConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Sample data for demo
const sampleData = {
  assets: [
    {
      id: 'POLE-001',
      type: 'pole',
      condition: 'good',
      location: { lat: 5.6037, lng: -0.1870 },
      lastInspection: new Date(),
      status: 'active'
    },
    {
      id: 'TRANS-001',
      type: 'transformer',
      condition: 'good',
      location: { lat: 5.6038, lng: -0.1871 },
      lastInspection: new Date(),
      status: 'active'
    }
  ],
  faults: [
    {
      id: 'FAULT-001',
      type: 'power_outage',
      location: { lat: 5.6039, lng: -0.1872 },
      reportedAt: new Date(),
      status: 'resolved',
      resolutionTime: 120 // minutes
    }
  ],
  inspections: [
    {
      id: 'INSP-001',
      assetId: 'POLE-001',
      date: new Date(),
      findings: 'All components in good condition',
      inspector: 'Demo Inspector'
    }
  ]
};

async function setupDemoEnvironment() {
  try {
    // Create demo user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      'demo@ecg-oms.com',
      'demo123'
    );
    console.log('Demo user created:', userCredential.user.email);

    // Add sample data to Firestore
    for (const [collectionName, items] of Object.entries(sampleData)) {
      const collectionRef = collection(db, collectionName);
      for (const item of items) {
        await addDoc(collectionRef, item);
      }
      console.log(`Added ${items.length} items to ${collectionName}`);
    }

    console.log('Demo environment setup completed successfully!');
  } catch (error) {
    console.error('Error setting up demo environment:', error);
  }
}

setupDemoEnvironment(); 