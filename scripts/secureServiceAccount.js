const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Function to encrypt the service account key
function encryptServiceAccountKey(keyPath, outputPath, password) {
  try {
    // Read the service account key
    const keyData = fs.readFileSync(keyPath, 'utf8');
    
    // Generate a random salt
    const salt = crypto.randomBytes(16);
    
    // Generate key from password
    const key = crypto.scryptSync(password, salt, 32);
    
    // Generate random IV
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    // Encrypt the data
    let encrypted = cipher.update(keyData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get the auth tag
    const authTag = cipher.getAuthTag();
    
    // Combine salt, iv, auth tag, and encrypted data
    const encryptedData = {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted: encrypted
    };
    
    // Write the encrypted data to file
    fs.writeFileSync(outputPath, JSON.stringify(encryptedData));
    
    console.log('Service account key encrypted successfully');
  } catch (error) {
    console.error('Error encrypting service account key:', error);
    process.exit(1);
  }
}

// Function to decrypt the service account key
function decryptServiceAccountKey(encryptedPath, outputPath, password) {
  try {
    // Read the encrypted data
    const encryptedData = JSON.parse(fs.readFileSync(encryptedPath, 'utf8'));
    
    // Convert hex strings back to buffers
    const salt = Buffer.from(encryptedData.salt, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    // Generate key from password
    const key = crypto.scryptSync(password, salt, 32);
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Write the decrypted data to file
    fs.writeFileSync(outputPath, decrypted);
    
    console.log('Service account key decrypted successfully');
  } catch (error) {
    console.error('Error decrypting service account key:', error);
    process.exit(1);
  }
}

// Export the functions
module.exports = {
  encryptServiceAccountKey,
  decryptServiceAccountKey
}; 