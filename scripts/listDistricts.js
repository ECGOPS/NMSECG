import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

async function listDistricts() {
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
    const districtsSnapshot = await db.collection('districts').get();
    
    if (districtsSnapshot.empty) {
      console.log('No districts found in the database.');
      return;
    }

    console.log('Districts in the database:');
    console.log('------------------------');
    
    districtsSnapshot.forEach(doc => {
      const district = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`Name: ${district.name}`);
      console.log(`Region ID: ${district.regionId}`);
      console.log('------------------------');
    });

  } catch (error) {
    console.error('Error fetching districts:', error);
  } finally {
    // Clean up
    admin.app().delete();
  }
}

listDistricts(); 