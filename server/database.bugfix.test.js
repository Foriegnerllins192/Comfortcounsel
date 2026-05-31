const { expect } = require('chai');
const fc = require('fast-check');
const { Pool } = require('pg');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * Bug Condition Exploration Test for Database Connection Timeout
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 * 
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code
 * - Failure confirms the bug exists (connection with channel_binding times out)
 * - Success after fix confirms the bug is resolved
 * 
 * Bug Condition: isBugCondition(input) where:
 *   - input contains "channel_binding=require"
 *   - input contains "sslmode=require"
 *   - connectionAttemptTimesOut()
 * 
 * Expected Behavior (after fix):
 *   - Connection establishes within 15 seconds
 *   - Returns valid client
 *   - Enables all database operations
 */

describe('Bug Condition Exploration: Database Connection Timeout with Channel Binding', () => {
  
  /**
   * Helper function to test database connection with a given connection string
   * @param {string} connectionString - PostgreSQL connection string
   * @param {number} timeout - Connection timeout in milliseconds
   * @returns {Promise<{success: boolean, duration: number, error: string|null}>}
   */
  async function testConnection(connectionString, timeout = 15000) {
    const startTime = Date.now();
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: timeout,
      max: 1,
      min: 0
    });

    try {
      const client = await pool.connect();
      const duration = Date.now() - startTime;
      
      // Test that we can execute a query
      await client.query('SELECT NOW()');
      client.release();
      await pool.end();
      
      return { success: true, duration, error: null };
    } catch (err) {
      const duration = Date.now() - startTime;
      await pool.end().catch(() => {});
      return { success: false, duration, error: err.message };
    }
  }

  /**
   * Helper function to check if a connection string contains the bug condition
   * @param {string} connectionString
   * @returns {boolean}
   */
  function isBugCondition(connectionString) {
    return connectionString.includes('channel_binding=require') &&
           connectionString.includes('sslmode=require');
  }

  /**
   * Helper function to remove channel_binding parameter from connection string
   * @param {string} connectionString
   * @returns {string}
   */
  function removeChannelBinding(connectionString) {
    return connectionString.replace(/[&?]channel_binding=require/g, '');
  }

  describe('Property 1: Bug Condition - Database Connection Timeout with Channel Binding', () => {
    
    it('should demonstrate bug: connection with channel_binding=require times out', async function() {
      this.timeout(70000); // Allow time for timeout to occur
      
      const currentConnectionString = process.env.DATABASE_URL;
      
      // Verify the current connection string has the bug condition
      if (!isBugCondition(currentConnectionString)) {
        throw new Error(
          'Test setup error: DATABASE_URL does not contain channel_binding=require. ' +
          'This test must run on UNFIXED code with the buggy connection string.'
        );
      }

      console.log('\n  Testing connection with channel_binding=require (EXPECTED TO TIMEOUT)...');
      
      // Test connection with channel_binding=require (should timeout)
      const buggyResult = await testConnection(currentConnectionString, 60000);
      
      console.log(`  Result: ${buggyResult.success ? 'SUCCESS' : 'TIMEOUT'} (${buggyResult.duration}ms)`);
      if (!buggyResult.success) {
        console.log(`  Error: ${buggyResult.error}`);
      }

      // This assertion will FAIL on unfixed code (which is correct - proves bug exists)
      // This assertion will PASS after fix (which confirms bug is resolved)
      expect(buggyResult.success).to.be.true;
      expect(buggyResult.duration).to.be.lessThan(15000);
    });

    it('should demonstrate expected behavior: connection without channel_binding succeeds', async function() {
      this.timeout(30000);
      
      const currentConnectionString = process.env.DATABASE_URL;
      const fixedConnectionString = removeChannelBinding(currentConnectionString);
      
      console.log('\n  Testing connection without channel_binding (EXPECTED TO SUCCEED)...');
      
      // Test connection without channel_binding (should succeed quickly)
      const fixedResult = await testConnection(fixedConnectionString, 15000);
      
      console.log(`  Result: ${fixedResult.success ? 'SUCCESS' : 'FAILED'} (${fixedResult.duration}ms)`);
      if (!fixedResult.success) {
        console.log(`  Error: ${fixedResult.error}`);
      }

      // This should pass even on unfixed code (demonstrates the fix works)
      expect(fixedResult.success).to.be.true;
      expect(fixedResult.duration).to.be.lessThan(15000);
    });
  });

  describe('Property-Based Test: Connection String Variations', () => {
    
    it('should verify bug condition across connection string variations', async function() {
      this.timeout(120000); // Allow time for multiple connection attempts
      
      // Get base connection string components
      const baseUrl = process.env.DATABASE_URL;
      const urlWithoutParams = baseUrl.split('?')[0];
      
      /**
       * Property: For any connection string with channel_binding=require,
       * removing channel_binding should result in successful connection
       */
      await fc.assert(
        fc.asyncProperty(
          // Generate variations of SSL and channel binding parameters
          fc.constantFrom(
            'sslmode=require&channel_binding=require',
            'sslmode=require&channel_binding=require&connect_timeout=10',
            'channel_binding=require&sslmode=require'
          ),
          async (params) => {
            const connectionStringWithBug = `${urlWithoutParams}?${params}`;
            const connectionStringFixed = removeChannelBinding(connectionStringWithBug);
            
            console.log(`\n  Testing: ${params}`);
            
            // Test the fixed version (without channel_binding)
            const fixedResult = await testConnection(connectionStringFixed, 15000);
            
            console.log(`    Fixed version: ${fixedResult.success ? 'SUCCESS' : 'FAILED'} (${fixedResult.duration}ms)`);
            
            // The fixed version should always succeed
            return fixedResult.success && fixedResult.duration < 15000;
          }
        ),
        { 
          numRuns: 3, // Run 3 variations
          verbose: true
        }
      );
    });
  });

  describe('Counterexample Documentation', () => {
    
    it('should document counterexamples that demonstrate the bug', async function() {
      this.timeout(70000);
      
      const currentConnectionString = process.env.DATABASE_URL;
      
      console.log('\n  === COUNTEREXAMPLE DOCUMENTATION ===');
      console.log('\n  Bug Condition:');
      console.log(`    - Connection string contains: channel_binding=require`);
      console.log(`    - Connection string contains: sslmode=require`);
      console.log(`    - Connection attempt times out after 60 seconds`);
      
      console.log('\n  Counterexample 1: Connection with channel_binding=require');
      const buggyResult = await testConnection(currentConnectionString, 60000);
      console.log(`    Result: ${buggyResult.success ? 'SUCCESS' : 'TIMEOUT'}`);
      console.log(`    Duration: ${buggyResult.duration}ms`);
      console.log(`    Error: ${buggyResult.error || 'None'}`);
      
      console.log('\n  Counterexample 2: Connection without channel_binding');
      const fixedConnectionString = removeChannelBinding(currentConnectionString);
      const fixedResult = await testConnection(fixedConnectionString, 15000);
      console.log(`    Result: ${fixedResult.success ? 'SUCCESS' : 'TIMEOUT'}`);
      console.log(`    Duration: ${fixedResult.duration}ms`);
      console.log(`    Error: ${fixedResult.error || 'None'}`);
      
      console.log('\n  === CONCLUSION ===');
      if (!buggyResult.success && fixedResult.success) {
        console.log('  ✓ Bug confirmed: channel_binding=require causes timeout');
        console.log('  ✓ Fix verified: removing channel_binding enables connection');
      } else if (buggyResult.success) {
        console.log('  ⚠ Unexpected: connection with channel_binding succeeded');
        console.log('  ⚠ This may indicate the bug is already fixed or root cause is incorrect');
      }
      
      // Store counterexamples for reporting
      const counterexamples = {
        buggy: {
          connectionString: currentConnectionString.replace(/:([^@]+)@/, ':****@'),
          success: buggyResult.success,
          duration: buggyResult.duration,
          error: buggyResult.error
        },
        fixed: {
          connectionString: fixedConnectionString.replace(/:([^@]+)@/, ':****@'),
          success: fixedResult.success,
          duration: fixedResult.duration,
          error: fixedResult.error
        }
      };
      
      // This test documents the counterexamples but doesn't assert
      // The actual assertion is in the first test
      console.log('\n  Counterexamples documented:', JSON.stringify(counterexamples, null, 2));
    });
  });
});
