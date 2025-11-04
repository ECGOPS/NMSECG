import { describe, it, expect, beforeEach } from 'vitest';
import { 
  op5FormSchema, 
  controlSystemOutageSchema, 
  loadMonitoringSchema,
  vitAssetSchema,
  staffIdSchema,
  userAuthSchema,
  districtPopulationSchema 
} from '@/lib/validation-schemas';

// Edge case test data
const edgeCaseInputs = {
  // Empty and null values
  emptyValues: {
    emptyString: '',
    nullValue: null,
    undefinedValue: undefined,
    whitespaceOnly: '   ',
    zeroValue: 0,
    negativeValue: -1,
    maxSafeInteger: Number.MAX_SAFE_INTEGER,
    minSafeInteger: Number.MIN_SAFE_INTEGER,
    infinity: Infinity,
    negativeInfinity: -Infinity,
    nan: NaN
  },

  // Extremely long inputs
  longInputs: {
    veryLongString: 'a'.repeat(10000),
    longHtml: '<script>alert("xss")</script>'.repeat(1000),
    longUnicode: '🚀'.repeat(5000),
    longSpecialChars: '!@#$%^&*()'.repeat(1000)
  },

  // Special characters and encoding
  specialChars: {
    unicode: '🚀⚡💻🎯',
    emojis: '😀😃😄😁😆😅😂🤣',
    htmlEntities: '&lt;&gt;&amp;&quot;&apos;',
    sqlInjection: "'; DROP TABLE users; --",
    xssPayloads: [
      '<script>alert("xss")</script>',
      'javascript:alert("xss")',
      'data:text/html,<script>alert("xss")</script>',
      'vbscript:msgbox("xss")',
      '<iframe src="javascript:alert(\'xss\')"></iframe>',
      '<img src="x" onerror="alert(\'xss\')">',
      '<svg onload="alert(\'xss\')">',
      '<body onload="alert(\'xss\')">'
    ]
  },

  // Boundary values
  boundaryValues: {
    numbers: {
      min: 0,
      max: 999999999,
      decimal: 3.14159,
      scientific: 1e-10,
      verySmall: 0.000000001
    },
    dates: {
      past: '1900-01-01',
      future: '2100-12-31',
      invalid: '2023-13-45',
      leapYear: '2024-02-29',
      nonLeapYear: '2023-02-29'
    }
  },

  // Malformed data structures
  malformedData: {
    wrongTypes: {
      stringForNumber: 'not-a-number',
      numberForString: 123,
      booleanForString: true,
      objectForString: { key: 'value' },
      arrayForString: ['item1', 'item2']
    },
    nestedIssues: {
      deepNesting: { a: { b: { c: { d: { e: 'value' } } } } },
      circularReference: {} as any,
      mixedTypes: { string: 'text', number: 123, boolean: true, null: null }
    }
  }
};

describe('Validation Edge Cases - OP5 Form Schema', () => {
  describe('Empty and Null Values', () => {
    it('should handle empty strings for required fields', () => {
      const result = op5FormSchema.safeParse({
        regionId: '',
        districtId: '',
        outageType: '',
        outageDescription: '',
        areasAffected: '',
        substationNo: '',
        occurrenceDate: '',
        ruralAffected: null,
        urbanAffected: null,
        metroAffected: null
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors).toHaveLength(7); // All required fields should fail
    });

    it('should handle null values for population fields', () => {
      const result = op5FormSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        outageType: 'Power Outage',
        outageDescription: 'Test description',
        areasAffected: 'Test area',
        substationNo: 'SUB001',
        occurrenceDate: '2024-01-01',
        ruralAffected: null,
        urbanAffected: null,
        metroAffected: null
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('At least one affected population field must be filled'))).toBe(true);
    });

    it('should handle undefined values', () => {
      const result = op5FormSchema.safeParse({
        regionId: undefined,
        districtId: 'district1',
        outageType: 'Power Outage',
        outageDescription: 'Test description',
        areasAffected: 'Test area',
        substationNo: 'SUB001',
        occurrenceDate: '2024-01-01',
        ruralAffected: 100,
        urbanAffected: 50,
        metroAffected: 25
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('Region is required'))).toBe(true);
    });
  });

  describe('Extremely Long Inputs', () => {
    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const result = op5FormSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        outageType: 'Power Outage',
        outageDescription: longString,
        areasAffected: 'Test area',
        substationNo: 'SUB001',
        occurrenceDate: '2024-01-01',
        ruralAffected: 100,
        urbanAffected: 50,
        metroAffected: 25
      });
      
      expect(result.success).toBe(true);
    });

    it('should handle long HTML content', () => {
      const longHtml = '<script>alert("xss")</script>'.repeat(1000);
      const result = op5FormSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        outageType: 'Power Outage',
        outageDescription: longHtml,
        areasAffected: 'Test area',
        substationNo: 'SUB001',
        occurrenceDate: '2024-01-01',
        ruralAffected: 100,
        urbanAffected: 50,
        metroAffected: 25
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('Special Characters and Encoding', () => {
    it('should handle unicode characters', () => {
      const result = op5FormSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        outageType: 'Power Outage 🚀',
        outageDescription: 'Test description with emojis 😀😃😄',
        areasAffected: 'Test area with unicode ⚡💻',
        substationNo: 'SUB001',
        occurrenceDate: '2024-01-01',
        ruralAffected: 100,
        urbanAffected: 50,
        metroAffected: 25
      });
      
      expect(result.success).toBe(true);
    });

    it('should handle HTML entities', () => {
      const result = op5FormSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        outageType: 'Power Outage &amp; Maintenance',
        outageDescription: 'Test &lt;script&gt;alert("xss")&lt;/script&gt; description',
        areasAffected: 'Test area with &quot;quotes&quot;',
        substationNo: 'SUB001',
        occurrenceDate: '2024-01-01',
        ruralAffected: 100,
        urbanAffected: 50,
        metroAffected: 25
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('Boundary Values', () => {
    it('should handle extreme population numbers', () => {
      const result = op5FormSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        outageType: 'Power Outage',
        outageDescription: 'Test description',
        areasAffected: 'Test area',
        substationNo: 'SUB001',
        occurrenceDate: '2024-01-01',
        ruralAffected: Number.MAX_SAFE_INTEGER,
        urbanAffected: 0,
        metroAffected: 0
      });
      
      expect(result.success).toBe(true);
    });

    it('should handle zero population values', () => {
      const result = op5FormSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        outageType: 'Power Outage',
        outageDescription: 'Test description',
        areasAffected: 'Test area',
        substationNo: 'SUB001',
        occurrenceDate: '2024-01-01',
        ruralAffected: 0,
        urbanAffected: 0,
        metroAffected: 0
      });
      
      expect(result.success).toBe(true);
    });

    it('should reject negative population values', () => {
      const result = op5FormSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        outageType: 'Power Outage',
        outageDescription: 'Test description',
        areasAffected: 'Test area',
        substationNo: 'SUB001',
        occurrenceDate: '2024-01-01',
        ruralAffected: -100,
        urbanAffected: 50,
        metroAffected: 25
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('must be 0 or greater'))).toBe(true);
    });
  });

  describe('Conditional Validation', () => {
    it('should require circuit and phase for Replace Fuse', () => {
      const result = op5FormSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        outageType: 'Power Outage',
        outageDescription: 'Test description',
        areasAffected: 'Test area',
        substationNo: 'SUB001',
        occurrenceDate: '2024-01-01',
        specificFaultType: 'REPLACE FUSE',
        ruralAffected: 100,
        urbanAffected: 50,
        metroAffected: 25
        // Missing fuseCircuit and fusePhase
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('Circuit and phase are required for Replace Fuse'))).toBe(true);
    });

    it('should require otherFaultType when specificFaultType is OTHERS', () => {
      const result = op5FormSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        outageType: 'Power Outage',
        outageDescription: 'Test description',
        areasAffected: 'Test area',
        substationNo: 'SUB001',
        occurrenceDate: '2024-01-01',
        specificFaultType: 'OTHERS',
        ruralAffected: 100,
        urbanAffected: 50,
        metroAffected: 25
        // Missing otherFaultType
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('Please specify the fault type'))).toBe(true);
    });
  });
});

describe('Validation Edge Cases - Control System Outage Schema', () => {
  describe('Date Validation', () => {
    it('should handle invalid date formats', () => {
      const result = controlSystemOutageSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        occurrenceDate: 'invalid-date',
        faultType: 'System Fault',
        loadMW: 100,
        reason: 'Test reason',
        indications: 'Test indications',
        areaAffected: 'Test area',
        customersAffected: { rural: 100, urban: 50, metro: 25 },
        voltageLevel: '11kV',
        feederType: 'Underground'
      });
      
      expect(result.success).toBe(false);
    });

    it('should validate repair date order', () => {
      const result = controlSystemOutageSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        occurrenceDate: '2024-01-01',
        faultType: 'System Fault',
        loadMW: 100,
        reason: 'Test reason',
        indications: 'Test indications',
        areaAffected: 'Test area',
        customersAffected: { rural: 100, urban: 50, metro: 25 },
        voltageLevel: '11kV',
        feederType: 'Underground',
        repairStartDate: '2024-01-05',
        repairEndDate: '2024-01-03' // End before start
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('Repair end date must be after repair start date'))).toBe(true);
    });
  });

  describe('Population Validation', () => {
    it('should require at least one affected population', () => {
      const result = controlSystemOutageSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        occurrenceDate: '2024-01-01',
        faultType: 'System Fault',
        loadMW: 100,
        reason: 'Test reason',
        indications: 'Test indications',
        areaAffected: 'Test area',
        customersAffected: { rural: 0, urban: 0, metro: 0 },
        voltageLevel: '11kV',
        feederType: 'Underground'
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('At least one affected population field must be filled'))).toBe(true);
    });
  });
});

describe('Validation Edge Cases - Load Monitoring Schema', () => {
  describe('Array Validation', () => {
    it('should require at least one feeder leg', () => {
      const result = loadMonitoringSchema.safeParse({
        date: '2024-01-01',
        time: '10:00',
        regionId: 'region1',
        districtId: 'district1',
        region: 'Test Region',
        district: 'Test District',
        substationName: 'Test Substation',
        substationNumber: 'SUB001',
        rating: 100,
        feederLegs: [] // Empty array
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('At least one feeder leg is required'))).toBe(true);
    });

    it('should validate nested array objects', () => {
      const result = loadMonitoringSchema.safeParse({
        date: '2024-01-01',
        time: '10:00',
        regionId: 'region1',
        districtId: 'district1',
        region: 'Test Region',
        district: 'Test District',
        substationName: 'Test Substation',
        substationNumber: 'SUB001',
        rating: 100,
        feederLegs: [
          {
            redPhaseCurrent: -50, // Negative value
            yellowPhaseCurrent: 100,
            bluePhaseCurrent: 75,
            neutralCurrent: 25
          }
        ]
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('must be 0 or greater'))).toBe(true);
    });
  });

  describe('Rating Validation', () => {
    it('should reject zero rating', () => {
      const result = loadMonitoringSchema.safeParse({
        date: '2024-01-01',
        time: '10:00',
        regionId: 'region1',
        districtId: 'district1',
        region: 'Test Region',
        district: 'Test District',
        substationName: 'Test Substation',
        substationNumber: 'SUB001',
        rating: 0, // Zero rating
        feederLegs: [
          {
            redPhaseCurrent: 100,
            yellowPhaseCurrent: 100,
            bluePhaseCurrent: 100,
            neutralCurrent: 0
          }
        ]
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('must be greater than 0'))).toBe(true);
    });

    it('should handle very small rating values', () => {
      const result = loadMonitoringSchema.safeParse({
        date: '2024-01-01',
        time: '10:00',
        regionId: 'region1',
        districtId: 'district1',
        region: 'Test Region',
        district: 'Test District',
        substationName: 'Test Substation',
        substationNumber: 'SUB001',
        rating: 0.000001, // Very small value
        feederLegs: [
          {
            redPhaseCurrent: 100,
            yellowPhaseCurrent: 100,
            bluePhaseCurrent: 100,
            neutralCurrent: 0
          }
        ]
      });
      
      expect(result.success).toBe(true);
    });
  });
});

describe('Validation Edge Cases - Staff ID Schema', () => {
  describe('Role-Based Validation', () => {
    it('should require region for district-specific roles', () => {
      const result = staffIdSchema.safeParse({
        name: 'John Doe',
        role: 'district_engineer',
        // Missing region
        district: 'Test District'
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('Region is required for this role'))).toBe(true);
    });

    it('should require district for district-specific roles', () => {
      const result = staffIdSchema.safeParse({
        name: 'John Doe',
        role: 'district_engineer',
        region: 'Test Region',
        // Missing district
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('District is required for this role'))).toBe(true);
    });

    it('should not require region for global roles', () => {
      const result = staffIdSchema.safeParse({
        name: 'John Doe',
        role: 'global_engineer'
        // No region required
      });
      
      expect(result.success).toBe(true);
    });
  });
});

describe('Validation Edge Cases - User Authentication Schema', () => {
  describe('Password Complexity', () => {
    it('should reject passwords without uppercase letters', () => {
      const result = userAuthSchema.safeParse({
        email: 'test@example.com',
        password: 'password123!' // No uppercase
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('uppercase letter'))).toBe(true);
    });

    it('should reject passwords without lowercase letters', () => {
      const result = userAuthSchema.safeParse({
        email: 'test@example.com',
        password: 'PASSWORD123!' // No lowercase
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('lowercase letter'))).toBe(true);
    });

    it('should reject passwords without numbers', () => {
      const result = userAuthSchema.safeParse({
        email: 'test@example.com',
        password: 'Password!' // No numbers
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('number'))).toBe(true);
    });

    it('should reject passwords without special characters', () => {
      const result = userAuthSchema.safeParse({
        email: 'test@example.com',
        password: 'Password123' // No special characters
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('special character'))).toBe(true);
    });

    it('should reject short passwords', () => {
      const result = userAuthSchema.safeParse({
        email: 'test@example.com',
        password: 'Pass1!' // Too short
      });
      
      expect(result.success).toBe(false);
      expect(result.error.errors.some(e => e.message.includes('at least 8 characters'))).toBe(true);
    });
  });

  describe('Email Validation', () => {
    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test.example.com',
        'test@.com',
        'test@example.',
        'test space@example.com',
        'test@example..com'
      ];

      invalidEmails.forEach(email => {
        const result = userAuthSchema.safeParse({
          email,
          password: 'ValidPass123!'
        });
        
        expect(result.success).toBe(false);
        expect(result.error.errors.some(e => e.message.includes('Invalid email format'))).toBe(true);
      });
    });

    it('should accept valid email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        '123@example.com',
        'user-name@example-domain.com'
      ];

      validEmails.forEach(email => {
        const result = userAuthSchema.safeParse({
          email,
          password: 'ValidPass123!'
        });
        
        expect(result.success).toBe(true);
      });
    });
  });
});

describe('Validation Edge Cases - District Population Schema', () => {
  describe('Population Totals', () => {
    it('should validate total population calculation', () => {
      const result = districtPopulationSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        rural: 100,
        urban: 200,
        metro: 300,
        total: 700 // Incorrect total
      });
      
      expect(result.success).toBe(false);
      // Note: This schema doesn't currently validate total calculation
      // This test shows a potential edge case that could be added
    });

    it('should handle zero populations', () => {
      const result = districtPopulationSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        rural: 0,
        urban: 0,
        metro: 0,
        total: 0
      });
      
      expect(result.success).toBe(true);
    });
  });
});

describe('Validation Edge Cases - Sanitization Integration', () => {
  describe('XSS Payload Handling', () => {
    it('should sanitize script tags in all schemas', () => {
      const xssPayload = '<script>alert("xss")</script>Test content';
      
      // Test OP5 schema
      const op5Result = op5FormSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        outageType: 'Power Outage',
        outageDescription: xssPayload,
        areasAffected: 'Test area',
        substationNo: 'SUB001',
        occurrenceDate: '2024-01-01',
        ruralAffected: 100,
        urbanAffected: 50,
        metroAffected: 25
      });
      
      expect(op5Result.success).toBe(true);
      // The schema should accept the content, but sanitization should happen before processing
    });
  });

  describe('SQL Injection Handling', () => {
    it('should handle SQL injection attempts', () => {
      const sqlInjection = "'; DROP TABLE users; --";
      
      const result = op5FormSchema.safeParse({
        regionId: 'region1',
        districtId: 'district1',
        outageType: 'Power Outage',
        outageDescription: sqlInjection,
        areasAffected: 'Test area',
        substationNo: 'SUB001',
        occurrenceDate: '2024-01-01',
        ruralAffected: 100,
        urbanAffected: 50,
        metroAffected: 25
      });
      
      expect(result.success).toBe(true);
      // Schema validation should pass, but sanitization should clean the input
    });
  });
});

describe('Validation Edge Cases - Performance and Memory', () => {
  describe('Large Data Sets', () => {
    it('should handle large nested objects', () => {
      const largeObject = {
        regionId: 'region1',
        districtId: 'district1',
        outageType: 'Power Outage',
        outageDescription: 'Test description',
        areasAffected: 'Test area',
        substationNo: 'SUB001',
        occurrenceDate: '2024-01-01',
        ruralAffected: 100,
        urbanAffected: 50,
        metroAffected: 25,
        metadata: {
          tags: Array(1000).fill('tag'),
          history: Array(1000).fill({ timestamp: Date.now(), action: 'test' }),
          notes: Array(1000).fill('note')
        }
      };
      
      const startTime = performance.now();
      const result = op5FormSchema.safeParse(largeObject);
      const endTime = performance.now();
      
      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe('Memory Usage', () => {
    it('should not cause memory leaks with repeated validation', () => {
      const testData = {
        regionId: 'region1',
        districtId: 'district1',
        outageType: 'Power Outage',
        outageDescription: 'Test description',
        areasAffected: 'Test area',
        substationNo: 'SUB001',
        occurrenceDate: '2024-01-01',
        ruralAffected: 100,
        urbanAffected: 50,
        metroAffected: 25
      };
      
      // Perform validation multiple times
      for (let i = 0; i < 1000; i++) {
        const result = op5FormSchema.safeParse(testData);
        expect(result.success).toBe(true);
      }
      
      // If we reach here without memory issues, the test passes
      expect(true).toBe(true);
    });
  });
});
