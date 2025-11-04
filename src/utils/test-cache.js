// Test script for IndexedDB cache functionality
import { cache } from './cache';

async function testIndexedDBCache() {
  console.log('🧪 Testing IndexedDB cache functionality...');
  
  try {
    // Test 1: Set cache
    const testData = { data: ['test1', 'test2', 'test3'], timestamp: Date.now() };
    await cache.set('test-key', testData);
    console.log('✅ Test 1: Cache set successfully');
    
    // Test 2: Get cache
    const retrieved = await cache.get('test-key');
    if (retrieved && retrieved.data.length === 3) {
      console.log('✅ Test 2: Cache retrieved successfully');
    } else {
      console.log('❌ Test 2: Cache retrieval failed');
    }
    
    // Test 3: Check validity
    const isValid = await cache.isValid('test-key');
    console.log(`✅ Test 3: Cache validity check: ${isValid}`);
    
    // Test 4: Get cache info
    const info = await cache.getInfo();
    console.log('✅ Test 4: Cache info retrieved:', info);
    
    // Test 5: Delete cache
    await cache.delete('test-key');
    const afterDelete = await cache.get('test-key');
    if (!afterDelete) {
      console.log('✅ Test 5: Cache deleted successfully');
    } else {
      console.log('❌ Test 5: Cache deletion failed');
    }
    
    // Test 6: Clear all cache
    await cache.set('test-key-1', { data: ['test'], timestamp: Date.now() });
    await cache.set('test-key-2', { data: ['test'], timestamp: Date.now() });
    await cache.clear();
    const infoAfterClear = await cache.getInfo();
    if (infoAfterClear.length === 0) {
      console.log('✅ Test 6: All cache cleared successfully');
    } else {
      console.log('❌ Test 6: Cache clear failed');
    }
    
    console.log('🎉 All IndexedDB cache tests passed!');
    
  } catch (error) {
    console.error('❌ IndexedDB cache test failed:', error);
  }
}

// Run the test if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment
  window.testIndexedDBCache = testIndexedDBCache;
} else {
  // Node.js environment
  testIndexedDBCache();
}

export { testIndexedDBCache }; 