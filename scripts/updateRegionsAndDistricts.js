import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

const regions = [
  { id: 'subtransmission-accra', name: 'SUBTRANSMISSION ACCRA' },
  { id: 'subtransmission-ashanti', name: 'SUBTRANSMISSION ASHANTI' },
  { id: 'accra-east', name: 'ACCRA EAST REGION' },
  { id: 'accra-west', name: 'ACCRA WEST REGION' },
  { id: 'ashanti-east', name: 'ASHANTI EAST REGION' },
  { id: 'ashanti-west', name: 'ASHANTI WEST REGION' },
  { id: 'ashanti-south', name: 'ASHANTI SOUTH REGION' },
  { id: 'central', name: 'CENTRAL REGION' },
  { id: 'eastern', name: 'EASTERN REGION' },
  { id: 'tema', name: 'TEMA REGION' },
  { id: 'volta', name: 'VOLTA REGION' },
  { id: 'western', name: 'WESTERN REGION' }
];

const districts = [
  // SUBTRANSMISSION ACCRA
  { name: 'SUBSTATION MAINTENANCE', regionId: 'subtransmission-accra' },
  { name: 'CONTROL OPERATIONS', regionId: 'subtransmission-accra' },
  { name: 'NETWORK MAINTENANCE', regionId: 'subtransmission-accra' },
  { name: 'PROTECTION MAINTENANCE', regionId: 'subtransmission-accra' },

  // SUBTRANSMISSION ASHANTI
  { name: 'SUBSTATION MAINTENANCE', regionId: 'subtransmission-ashanti' },
  { name: 'CONTROL OPERATIONS', regionId: 'subtransmission-ashanti' },
  { name: 'NETWORK MAINTENANCE', regionId: 'subtransmission-ashanti' },
  { name: 'PROTECTION MAINTENANCE', regionId: 'subtransmission-ashanti' },

  // ACCRA EAST
  { name: 'ADENTA', regionId: 'accra-east' },
  { name: 'DODOWA', regionId: 'accra-east' },
  { name: 'KWABENYA', regionId: 'accra-east' },
  { name: 'LEGON', regionId: 'accra-east' },
  { name: 'MAKOLA', regionId: 'accra-east' },
  { name: 'AKWAPIM MAMPONG', regionId: 'accra-east' },
  { name: 'ROMAN RIDGE', regionId: 'accra-east' },
  { name: 'TESHIE', regionId: 'accra-east' },

  // ACCRA WEST
  { name: 'ABLEKUMA', regionId: 'accra-west' },
  { name: 'ACHIMOTA', regionId: 'accra-west' },
  { name: 'AMASAMAN', regionId: 'accra-west' },
  { name: 'BORTIANOR', regionId: 'accra-west' },
  { name: 'DANSOMAN', regionId: 'accra-west' },
  { name: 'KANESHIE', regionId: 'accra-west' },
  { name: 'KORLE-BU', regionId: 'accra-west' },
  { name: 'NSAWAM', regionId: 'accra-west' },

  // ASHANTI EAST
  { name: 'AYIGYA', regionId: 'ashanti-east' },
  { name: 'EFFIDUASE', regionId: 'ashanti-east' },
  { name: 'EJISU', regionId: 'ashanti-east' },
  { name: 'KONONGO', regionId: 'ashanti-east' },
  { name: 'KWABRE', regionId: 'ashanti-east' },
  { name: 'MAMPONG', regionId: 'ashanti-east' },
  { name: 'MANHYIA', regionId: 'ashanti-east' },

  // ASHANTI WEST
  { name: 'ABUAKWA', regionId: 'ashanti-west' },
  { name: 'ADUM', regionId: 'ashanti-west' },
  { name: 'AHINSAN', regionId: 'ashanti-west' },
  { name: 'BIBIANI', regionId: 'ashanti-west' },
  { name: 'DANYAME', regionId: 'ashanti-west' },
  { name: 'KOKOBEN', regionId: 'ashanti-west' },
  { name: 'SUAME', regionId: 'ashanti-west' },
  { name: 'OFFINSO', regionId: 'ashanti-west' },

  // ASHANTI SOUTH
  { name: 'ASOKWA', regionId: 'ashanti-south' },
  { name: 'BEKWAI', regionId: 'ashanti-south' },
  { name: 'DUNKWA', regionId: 'ashanti-south' },
  { name: 'MANSO NKWANTA', regionId: 'ashanti-south' },
  { name: 'NEW EDUBIASE', regionId: 'ashanti-south' },
  { name: 'OBUASI', regionId: 'ashanti-south' },

  // CENTRAL REGION
  { name: 'AGONA SWEDRU', regionId: 'central' },
  { name: 'AJUMAKO', regionId: 'central' },
  { name: 'ASSIN FOSO', regionId: 'central' },
  { name: 'BREMAN ASIKUMA', regionId: 'central' },
  { name: 'CAPE COAST', regionId: 'central' },
  { name: 'KASOA NORTH', regionId: 'central' },
  { name: 'KASOA SOUTH', regionId: 'central' },
  { name: 'SALTPOND', regionId: 'central' },
  { name: 'TWIFU PRASO', regionId: 'central' },
  { name: 'WINNEBA', regionId: 'central' },

  // EASTERN REGION
  { name: 'AKIM ODA', regionId: 'eastern' },
  { name: 'AKIM TAFO', regionId: 'eastern' },
  { name: 'AKWATIA', regionId: 'eastern' },
  { name: 'ASAMANKESE', regionId: 'eastern' },
  { name: 'BEGORO', regionId: 'eastern' },
  { name: 'DONKORKROM', regionId: 'eastern' },
  { name: 'KADE', regionId: 'eastern' },
  { name: 'KIBI', regionId: 'eastern' },
  { name: 'KOFORIDUA', regionId: 'eastern' },
  { name: 'MPRAESO', regionId: 'eastern' },
  { name: 'NEW ABIREM', regionId: 'eastern' },
  { name: 'NKAWKAW', regionId: 'eastern' },
  { name: 'SUHUM', regionId: 'eastern' },
  { name: 'ASESEWA', regionId: 'eastern' },

  // TEMA REGION
  { name: 'ADA', regionId: 'tema' },
  { name: 'AFIENYA', regionId: 'tema' },
  { name: 'ASHAIMAN', regionId: 'tema' },
  { name: 'JUAPONG', regionId: 'tema' },
  { name: 'KROBO', regionId: 'tema' },
  { name: 'NUNGUA', regionId: 'tema' },
  { name: 'PRAMPRAM', regionId: 'tema' },
  { name: 'TEMA NORTH', regionId: 'tema' },
  { name: 'TEMA SOUTH', regionId: 'tema' },

  // VOLTA REGION
  { name: 'AKATSI', regionId: 'volta' },
  { name: 'DAMBAI', regionId: 'volta' },
  { name: 'DENU', regionId: 'volta' },
  { name: 'HO', regionId: 'volta' },
  { name: 'HOHOE', regionId: 'volta' },
  { name: 'JASIKAN', regionId: 'volta' },
  { name: 'KETA', regionId: 'volta' },
  { name: 'KPANDU', regionId: 'volta' },
  { name: 'KPEVE', regionId: 'volta' },
  { name: 'NKWANTA', regionId: 'volta' },
  { name: 'SOGAKOPE', regionId: 'volta' },

  // WESTERN REGION
  { name: 'AGONA', regionId: 'western' },
  { name: 'ASANKRAGUA', regionId: 'western' },
  { name: 'AXIM', regionId: 'western' },
  { name: 'BOGOSO', regionId: 'western' },
  { name: 'ENCHI', regionId: 'western' },
  { name: 'HALF ASSINI', regionId: 'western' },
  { name: 'SEFWI WIAWSO', regionId: 'western' },
  { name: 'JUABESO', regionId: 'western' },
  { name: 'SEKONDI', regionId: 'western' },
  { name: 'TAKORADI', regionId: 'western' },
  { name: 'TARKWA', regionId: 'western' }
];

async function updateRegionsAndDistricts() {
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
    const batch = db.batch();

    // Delete all existing regions and districts
    const regionsSnapshot = await db.collection('regions').get();
    const districtsSnapshot = await db.collection('districts').get();

    regionsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    districtsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Add new regions
    regions.forEach((region) => {
      const regionRef = db.collection('regions').doc(region.id);
      batch.set(regionRef, region);
    });

    // Add new districts
    districts.forEach((district, index) => {
      const districtRef = db.collection('districts').doc(`district${index + 1}`);
      batch.set(districtRef, district);
    });

    // Commit the batch
    await batch.commit();
    console.log('Successfully updated regions and districts');

  } catch (error) {
    console.error('Error updating regions and districts:', error);
  } finally {
    // Clean up
    admin.app().delete();
  }
}

updateRegionsAndDistricts(); 