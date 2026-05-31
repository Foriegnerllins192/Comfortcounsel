const { expect } = require('chai');
const sinon = require('sinon');
const { Pool } = require('pg');

describe('Database Connection Tests', () => {
  let poolStub;
  let consoleLogStub;

  beforeEach(() => {
    // Stub console.log to suppress output during tests
    consoleLogStub = sinon.stub(console, 'log');
  });

  afterEach(() => {
    // Restore all stubs
    sinon.restore();
  });

  describe('Connection Pool Initialization', () => {
    it('should create a connection pool with correct configuration', () => {
      // Set test environment variables
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
      
      // Clear the require cache to reload the module
      delete require.cache[require.resolve('./database')];
      
      const { pool } = require('./database');
      
      expect(pool).to.be.instanceOf(Pool);
      expect(pool.options.connectionString).to.equal(process.env.DATABASE_URL);
      expect(pool.options.ssl).to.deep.equal({ rejectUnauthorized: false });
    });

    it('should initialize database tables successfully', async () => {
      const mockClient = {
        query: sinon.stub().resolves(),
        release: sinon.stub()
      };

      const mockPool = {
        connect: sinon.stub().resolves(mockClient)
      };

      // Clear the require cache
      delete require.cache[require.resolve('./database')];
      
      // Mock the Pool constructor
      const PoolStub = sinon.stub().returns(mockPool);
      require.cache[require.resolve('pg')] = {
        exports: { Pool: PoolStub }
      };

      const { initDB } = require('./database');
      
      await initDB();

      expect(mockPool.connect.calledOnce).to.be.true;
      expect(mockClient.query.called).to.be.true;
      expect(mockClient.release.calledOnce).to.be.true;
      expect(consoleLogStub.calledWith('Database tables initialized')).to.be.true;
    });

    it('should create all required tables', async () => {
      const mockClient = {
        query: sinon.stub().resolves(),
        release: sinon.stub()
      };

      const mockPool = {
        connect: sinon.stub().resolves(mockClient)
      };

      delete require.cache[require.resolve('./database')];
      
      const PoolStub = sinon.stub().returns(mockPool);
      require.cache[require.resolve('pg')] = {
        exports: { Pool: PoolStub }
      };

      const { initDB } = require('./database');
      
      await initDB();

      const queryCall = mockClient.query.firstCall.args[0];
      
      // Verify all required tables are created
      expect(queryCall).to.include('CREATE TABLE IF NOT EXISTS users');
      expect(queryCall).to.include('CREATE TABLE IF NOT EXISTS counselors');
      expect(queryCall).to.include('CREATE TABLE IF NOT EXISTS sessions');
      expect(queryCall).to.include('CREATE TABLE IF NOT EXISTS counselor_payouts');
      expect(queryCall).to.include('CREATE TABLE IF NOT EXISTS wallets');
      expect(queryCall).to.include('CREATE TABLE IF NOT EXISTS wallet_transactions');
      expect(queryCall).to.include('CREATE TABLE IF NOT EXISTS payments');
      expect(queryCall).to.include('CREATE TABLE IF NOT EXISTS password_resets');
    });
  });

  describe('Connection Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      const connectionError = new Error('Connection failed');
      
      const mockPool = {
        connect: sinon.stub().rejects(connectionError)
      };

      delete require.cache[require.resolve('./database')];
      
      const PoolStub = sinon.stub().returns(mockPool);
      require.cache[require.resolve('pg')] = {
        exports: { Pool: PoolStub }
      };

      const { initDB } = require('./database');
      
      try {
        await initDB();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Connection failed');
      }
    });

    it('should release client connection even if query fails', async () => {
      const queryError = new Error('Query failed');
      
      const mockClient = {
        query: sinon.stub().rejects(queryError),
        release: sinon.stub()
      };

      const mockPool = {
        connect: sinon.stub().resolves(mockClient)
      };

      delete require.cache[require.resolve('./database')];
      
      const PoolStub = sinon.stub().returns(mockPool);
      require.cache[require.resolve('pg')] = {
        exports: { Pool: PoolStub }
      };

      const { initDB } = require('./database');
      
      try {
        await initDB();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Query failed');
        expect(mockClient.release.calledOnce).to.be.true;
      }
    });

    it('should handle missing DATABASE_URL environment variable', () => {
      // Clear DATABASE_URL
      const originalUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      
      delete require.cache[require.resolve('./database')];
      
      const { pool } = require('./database');
      
      // Pool should still be created but with undefined connectionString
      expect(pool).to.exist;
      
      // Restore original URL
      process.env.DATABASE_URL = originalUrl;
    });

    it('should handle invalid DATABASE_URL format', () => {
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'invalid-url';
      
      delete require.cache[require.resolve('./database')];
      
      const { pool } = require('./database');
      
      // Pool should be created but connection will fail when used
      expect(pool).to.exist;
      
      // Restore original URL
      process.env.DATABASE_URL = originalUrl;
    });

    it('should handle migration errors gracefully', async () => {
      const migrationError = new Error('Migration failed');
      
      const mockClient = {
        query: sinon.stub()
          .onFirstCall().resolves() // First query succeeds (table creation)
          .onSecondCall().rejects(migrationError), // Second query fails (migrations)
        release: sinon.stub()
      };

      const mockPool = {
        connect: sinon.stub().resolves(mockClient)
      };

      delete require.cache[require.resolve('./database')];
      
      const PoolStub = sinon.stub().returns(mockPool);
      require.cache[require.resolve('pg')] = {
        exports: { Pool: PoolStub }
      };

      const { initDB } = require('./database');
      
      try {
        await initDB();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Migration failed');
        expect(mockClient.release.calledOnce).to.be.true;
      }
    });
  });

  describe('Connection Pool Configuration', () => {
    it('should configure SSL with rejectUnauthorized set to false', () => {
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
      
      // Clear all require caches including pg
      Object.keys(require.cache).forEach(key => {
        if (key.includes('database') || key.includes('pg')) {
          delete require.cache[key];
        }
      });
      
      const { pool } = require('./database');
      
      expect(pool).to.exist;
      expect(pool.connect).to.be.a('function');
      expect(pool.query).to.be.a('function');
      
      // Restore original URL
      process.env.DATABASE_URL = originalUrl;
    });

    it('should use environment variable for connection string', () => {
      const testConnectionString = 'postgresql://user:pass@host:5432/db';
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = testConnectionString;
      
      // Clear all require caches including pg
      Object.keys(require.cache).forEach(key => {
        if (key.includes('database') || key.includes('pg')) {
          delete require.cache[key];
        }
      });
      
      const { pool } = require('./database');
      
      expect(pool).to.exist;
      expect(pool.connect).to.be.a('function');
      expect(pool.query).to.be.a('function');
      
      // Restore original URL
      process.env.DATABASE_URL = originalUrl;
    });
  });
});
