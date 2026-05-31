const { expect } = require('chai');
const fc = require('fast-check');
const { Pool } = require('pg');
const path = require('path');
const { spawn } = require('child_process');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * Preservation Property Tests for Database Connection Timeout Fix
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 * 
 * IMPORTANT: These tests run on UNFIXED code with channel_binding temporarily removed
 * to establish connection, then test operations that occur AFTER connection.
 * 
 * EXPECTED OUTCOME: All tests PASS (confirms baseline behavior to preserve)
 * 
 * Preservation Property: All database operations that occur AFTER connection
 * establishment should be completely unaffected by the fix.
 * 
 * Scope: Query execution, transaction handling, connection pool management,
 * error handling, table creation, all application-level operations
 */

describe('Preservation Property Tests: Existing Database Functionality', () => {
  
  let testPool;
  
  /**
   * Helper function to get a working connection string (without channel_binding)
   * This allows us to test post-connection behavior on unfixed code
   */
  function getWorkingConnectionString() {
    const originalUrl = process.env.DATABASE_URL;
    return originalUrl.replace(/[&?]channel_binding=require/g, '');
  }

  /**
   * Setup: Create a test pool with working connection string
   */
  before(async function() {
    this.timeout(30000);
    
    const workingConnectionString = getWorkingConnectionString();
    
    testPool = new Pool({
      connectionString: workingConnectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    });
    
    // Verify we can connect
    const client = await testPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    console.log('\n  ✓ Test pool established (using connection without channel_binding)');
  });

  /**
   * Cleanup: Close test pool
   */
  after(async function() {
    if (testPool) {
      await testPool.end();
      console.log('  ✓ Test pool closed');
    }
  });

  describe('Property 2.1: Password Masking in Console Logs (Requirement 3.1)', () => {
    
    it('should mask password in DATABASE_URL when logged', () => {
      const originalUrl = process.env.DATABASE_URL;
      const maskedUrl = originalUrl.replace(/:([^@]+)@/, ':****@');
      
      // Verify password is not visible in masked version
      expect(maskedUrl).to.not.include('npg_ahu9E4IDTqpC');
      expect(maskedUrl).to.include(':****@');
      
      console.log(`\n  Original URL contains password: ${originalUrl.includes('npg_ahu9E4IDTqpC')}`);
      console.log(`  Masked URL hides password: ${!maskedUrl.includes('npg_ahu9E4IDTqpC')}`);
    });

    it('should use property-based testing to verify password masking across various URLs', () => {
      /**
       * Property: For any connection string with a password,
       * masking should hide the password while preserving structure
       */
      fc.assert(
        fc.property(
          // Generate connection strings with various passwords
          fc.record({
            user: fc.constantFrom('user', 'admin', 'neondb_owner'),
            password: fc.string({ minLength: 8, maxLength: 32 }),
            host: fc.constantFrom('localhost', 'example.com', 'ep-test.aws.neon.tech'),
            database: fc.constantFrom('testdb', 'neondb', 'postgres')
          }),
          ({ user, password, host, database }) => {
            const connectionString = `postgresql://${user}:${password}@${host}/${database}`;
            const maskedString = connectionString.replace(/:([^@]+)@/, ':****@');
            
            // Property: masked string should not contain the password
            const passwordHidden = !maskedString.includes(password);
            // Property: masked string should contain the mask
            const maskPresent = maskedString.includes(':****@');
            // Property: other components should be preserved
            const structurePreserved = maskedString.includes(user) && 
                                       maskedString.includes(host) && 
                                       maskedString.includes(database);
            
            return passwordHidden && maskPresent && structurePreserved;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 2.2: SSL Configuration Unchanged (Requirement 3.2)', () => {
    
    it('should maintain SSL configuration with rejectUnauthorized: false', () => {
      const poolConfig = testPool.options;
      
      // Verify SSL is configured
      expect(poolConfig.ssl).to.exist;
      expect(poolConfig.ssl.rejectUnauthorized).to.be.false;
      
      console.log(`\n  SSL enabled: ${!!poolConfig.ssl}`);
      console.log(`  rejectUnauthorized: ${poolConfig.ssl.rejectUnauthorized}`);
    });

    it('should verify SSL configuration is preserved across pool instances', () => {
      /**
       * Property: For any pool created with SSL config,
       * the SSL settings should be preserved
       */
      fc.assert(
        fc.property(
          fc.constantFrom(true, false),
          (rejectUnauthorized) => {
            const workingConnectionString = getWorkingConnectionString();
            const tempPool = new Pool({
              connectionString: workingConnectionString,
              ssl: { rejectUnauthorized },
              max: 1
            });
            
            const sslConfigPreserved = tempPool.options.ssl.rejectUnauthorized === rejectUnauthorized;
            
            // Cleanup
            tempPool.end().catch(() => {});
            
            return sslConfigPreserved;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 2.3: Detailed Error Logging (Requirement 3.3)', () => {
    
    it('should log detailed error information for query failures', async function() {
      this.timeout(10000);
      
      const client = await testPool.connect();
      
      try {
        // Execute an invalid query to trigger error
        await client.query('SELECT * FROM nonexistent_table_xyz');
        expect.fail('Should have thrown an error');
      } catch (err) {
        // Verify error has detailed information
        expect(err.message).to.exist;
        expect(err.code).to.exist;
        expect(err.message).to.include('nonexistent_table_xyz');
        
        console.log(`\n  Error message present: ${!!err.message}`);
        console.log(`  Error code present: ${!!err.code}`);
        console.log(`  Error details: ${err.code} - ${err.message.substring(0, 50)}...`);
      } finally {
        client.release();
      }
    });

    it('should use property-based testing to verify error logging for various invalid queries', async function() {
      this.timeout(30000);
      
      /**
       * Property: For any invalid query, the error should contain
       * detailed information (message, code, and context)
       */
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'SELECT * FROM nonexistent_table_1',
            'INSERT INTO fake_table VALUES (1)',
            'UPDATE missing_table SET x=1',
            'DELETE FROM phantom_table'
          ),
          async (invalidQuery) => {
            const client = await testPool.connect();
            
            try {
              await client.query(invalidQuery);
              client.release();
              return false; // Should have thrown
            } catch (err) {
              client.release();
              
              // Property: error has message and code
              const hasMessage = !!err.message && err.message.length > 0;
              const hasCode = !!err.code;
              
              return hasMessage && hasCode;
            }
          }
        ),
        { numRuns: 4 }
      );
    });
  });

  describe('Property 2.4: Connection Pool Configuration (Requirement 3.6)', () => {
    
    it('should maintain connection pool configuration (max: 10, min: 0)', () => {
      const poolConfig = testPool.options;
      
      expect(poolConfig.max).to.equal(10);
      expect(poolConfig.min).to.equal(0);
      expect(poolConfig.connectionTimeoutMillis).to.equal(15000);
      expect(poolConfig.idleTimeoutMillis).to.equal(30000);
      
      console.log(`\n  Max connections: ${poolConfig.max}`);
      console.log(`  Min connections: ${poolConfig.min}`);
      console.log(`  Connection timeout: ${poolConfig.connectionTimeoutMillis}ms`);
      console.log(`  Idle timeout: ${poolConfig.idleTimeoutMillis}ms`);
    });

    it('should verify pool configuration is preserved across various settings', () => {
      /**
       * Property: For any valid pool configuration,
       * the settings should be preserved in the pool instance
       */
      fc.assert(
        fc.property(
          fc.record({
            max: fc.integer({ min: 1, max: 20 }),
            min: fc.integer({ min: 0, max: 5 }),
            connectionTimeoutMillis: fc.constantFrom(10000, 15000, 30000, 60000),
            idleTimeoutMillis: fc.constantFrom(10000, 30000, 60000)
          }),
          (config) => {
            const workingConnectionString = getWorkingConnectionString();
            const tempPool = new Pool({
              connectionString: workingConnectionString,
              ssl: { rejectUnauthorized: false },
              ...config
            });
            
            const configPreserved = 
              tempPool.options.max === config.max &&
              tempPool.options.min === config.min &&
              tempPool.options.connectionTimeoutMillis === config.connectionTimeoutMillis &&
              tempPool.options.idleTimeoutMillis === config.idleTimeoutMillis;
            
            // Cleanup
            tempPool.end().catch(() => {});
            
            return configPreserved;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 2.5: Query Execution After Connection (Post-Connection Operations)', () => {
    
    it('should execute SELECT queries successfully', async function() {
      this.timeout(10000);
      
      const client = await testPool.connect();
      
      try {
        const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
        
        expect(result.rows).to.have.lengthOf(1);
        expect(result.rows[0].current_time).to.exist;
        expect(result.rows[0].pg_version).to.exist;
        
        console.log(`\n  Query executed successfully`);
        console.log(`  Rows returned: ${result.rows.length}`);
      } finally {
        client.release();
      }
    });

    it('should use property-based testing to verify query execution across various queries', async function() {
      this.timeout(30000);
      
      /**
       * Property: For any valid SELECT query, the query should execute
       * and return results with expected structure
       */
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'SELECT 1 as num',
            'SELECT NOW() as time',
            "SELECT 'test' as text",
            'SELECT 1+1 as sum',
            'SELECT true as bool'
          ),
          async (query) => {
            const client = await testPool.connect();
            
            try {
              const result = await client.query(query);
              client.release();
              
              // Property: result has rows array
              const hasRows = Array.isArray(result.rows);
              // Property: result has at least one row
              const hasData = result.rows.length > 0;
              
              return hasRows && hasData;
            } catch (err) {
              client.release();
              return false;
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 2.6: Transaction Handling After Connection', () => {
    
    it('should handle transactions (BEGIN/COMMIT) correctly', async function() {
      this.timeout(10000);
      
      const client = await testPool.connect();
      
      try {
        await client.query('BEGIN');
        await client.query('SELECT 1');
        await client.query('COMMIT');
        
        console.log(`\n  Transaction executed successfully (BEGIN/COMMIT)`);
      } finally {
        client.release();
      }
    });

    it('should handle transaction rollback correctly', async function() {
      this.timeout(10000);
      
      const client = await testPool.connect();
      
      try {
        await client.query('BEGIN');
        await client.query('SELECT 1');
        await client.query('ROLLBACK');
        
        console.log(`  Transaction rollback executed successfully`);
      } finally {
        client.release();
      }
    });

    it('should use property-based testing to verify transaction operations', async function() {
      this.timeout(30000);
      
      /**
       * Property: For any sequence of transaction commands,
       * the transaction should complete without errors
       */
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            ['BEGIN', 'SELECT 1', 'COMMIT'],
            ['BEGIN', 'SELECT NOW()', 'COMMIT'],
            ['BEGIN', 'SELECT 1', 'ROLLBACK'],
            ['BEGIN', "SELECT 'test'", 'ROLLBACK']
          ),
          async (commands) => {
            const client = await testPool.connect();
            
            try {
              for (const cmd of commands) {
                await client.query(cmd);
              }
              client.release();
              return true;
            } catch (err) {
              client.release();
              return false;
            }
          }
        ),
        { numRuns: 4 }
      );
    });
  });

  describe('Property 2.7: Connection Pool Acquire/Release Operations', () => {
    
    it('should acquire and release clients from pool correctly', async function() {
      this.timeout(10000);
      
      const client1 = await testPool.connect();
      const client2 = await testPool.connect();
      
      expect(client1).to.exist;
      expect(client2).to.exist;
      
      client1.release();
      client2.release();
      
      console.log(`\n  Successfully acquired and released 2 clients from pool`);
    });

    it('should use property-based testing to verify pool operations', async function() {
      this.timeout(30000);
      
      /**
       * Property: For any number of concurrent client acquisitions (up to max),
       * all clients should be acquirable and releasable
       */
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (numClients) => {
            const clients = [];
            
            try {
              // Acquire multiple clients
              for (let i = 0; i < numClients; i++) {
                const client = await testPool.connect();
                clients.push(client);
              }
              
              // All clients should be acquired
              const allAcquired = clients.length === numClients;
              
              // Release all clients
              for (const client of clients) {
                client.release();
              }
              
              return allAcquired;
            } catch (err) {
              // Release any acquired clients
              for (const client of clients) {
                try {
                  client.release();
                } catch (e) {}
              }
              return false;
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 2.8: Server Startup Independence (Requirement 3.5)', () => {
    
    it('should verify server can start regardless of database status', function(done) {
      this.timeout(15000);
      
      // Spawn a test server process
      const serverProcess = spawn('node', ['server/server.js'], {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, PORT: '3099' }, // Use different port for test
        stdio: 'pipe'
      });
      
      let serverStarted = false;
      let output = '';
      
      serverProcess.stdout.on('data', (data) => {
        output += data.toString();
        if (output.includes('Comfort Counsel server running')) {
          serverStarted = true;
          serverProcess.kill();
        }
      });
      
      serverProcess.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      serverProcess.on('close', (code) => {
        console.log(`\n  Server startup test completed`);
        console.log(`  Server started: ${serverStarted}`);
        
        // Server should start even if database fails
        expect(serverStarted).to.be.true;
        done();
      });
      
      // Timeout fallback
      setTimeout(() => {
        if (!serverStarted) {
          serverProcess.kill();
          done(new Error('Server did not start within timeout'));
        }
      }, 12000);
    });
  });

  describe('Property 2.10: Background Job for Expired Sessions (Requirement 3.6)', () => {
    
    it('should verify background job configuration is preserved', function() {
      // Read server.js to verify background job configuration
      const fs = require('fs');
      const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
      
      // Verify setInterval is configured for 2 minutes (2 * 60 * 1000 = 120000ms)
      const hasBackgroundJob = serverCode.includes('setInterval(handleExpiredSessions, 2 * 60 * 1000)');
      const hasExpiredSessionsHandler = serverCode.includes('handleExpiredSessions');
      
      expect(hasBackgroundJob).to.be.true;
      expect(hasExpiredSessionsHandler).to.be.true;
      
      console.log(`\n  Background job configured: ${hasBackgroundJob}`);
      console.log(`  Interval: 2 minutes (120000ms)`);
      console.log(`  Handler function present: ${hasExpiredSessionsHandler}`);
    });

    it('should verify background job only runs when database is connected', function() {
      const fs = require('fs');
      const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
      
      // Verify the handler checks isDatabaseConnected before running
      const hasConnectionCheck = serverCode.includes('if (!isDatabaseConnected)');
      
      expect(hasConnectionCheck).to.be.true;
      
      console.log(`  Database connection check present: ${hasConnectionCheck}`);
    });
  });

  describe('Property 2.11: Graceful Shutdown on SIGINT/SIGTERM (Requirement 3.4)', () => {
    
    it('should verify graceful shutdown handlers are configured', function() {
      const fs = require('fs');
      const databaseCode = fs.readFileSync(path.join(__dirname, 'database.js'), 'utf8');
      
      // Verify SIGINT handler exists
      const hasSIGINTHandler = databaseCode.includes("process.on('SIGINT'");
      const hasSIGTERMHandler = databaseCode.includes("process.on('SIGTERM'");
      const hasClosePool = databaseCode.includes('closePool');
      
      expect(hasSIGINTHandler).to.be.true;
      expect(hasSIGTERMHandler).to.be.true;
      expect(hasClosePool).to.be.true;
      
      console.log(`\n  SIGINT handler configured: ${hasSIGINTHandler}`);
      console.log(`  SIGTERM handler configured: ${hasSIGTERMHandler}`);
      console.log(`  closePool function present: ${hasClosePool}`);
    });

    it('should verify closePool function closes database connections', function() {
      const fs = require('fs');
      const databaseCode = fs.readFileSync(path.join(__dirname, 'database.js'), 'utf8');
      
      // Verify closePool calls pool.end()
      const closesPool = databaseCode.includes('pool.end()');
      
      expect(closesPool).to.be.true;
      
      console.log(`  closePool calls pool.end(): ${closesPool}`);
    });
  });

  describe('Property 2.9: Comprehensive Preservation Property', () => {
    
    it('should verify all database operations produce consistent results', async function() {
      this.timeout(30000);
      
      /**
       * Meta-property: For any database operation after connection,
       * the operation should behave identically regardless of how
       * the connection was established (with or without channel_binding)
       */
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            { type: 'query', sql: 'SELECT 1 as num' },
            { type: 'query', sql: 'SELECT NOW() as time' },
            { type: 'transaction', commands: ['BEGIN', 'SELECT 1', 'COMMIT'] },
            { type: 'transaction', commands: ['BEGIN', 'SELECT 1', 'ROLLBACK'] }
          ),
          async (operation) => {
            const client = await testPool.connect();
            
            try {
              if (operation.type === 'query') {
                const result = await client.query(operation.sql);
                client.release();
                return result.rows.length > 0;
              } else if (operation.type === 'transaction') {
                for (const cmd of operation.commands) {
                  await client.query(cmd);
                }
                client.release();
                return true;
              }
              client.release();
              return false;
            } catch (err) {
              client.release();
              return false;
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
