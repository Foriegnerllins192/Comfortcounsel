/**
 * Profile Picture Synchronization Bug - Preservation Property Tests
 * 
 * **IMPORTANT**: Follow observation-first methodology
 * **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
 * 
 * These tests observe behavior on UNFIXED code for non-buggy inputs (anonymous clients, filtering functionality)
 * and write property-based tests capturing observed behavior patterns from Preservation Requirements.
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 * 
 * Property 2: Preservation - Anonymous Client and Filtering Behavior
 */

const { expect } = require('chai');
const sinon = require('sinon');
const fc = require('fast-check');
const counselorController = require('./counselorController');
const { pool } = require('../database');

describe('Profile Picture Sync Preservation Tests', () => {
  let req, res, poolStub;

  beforeEach(() => {
    // Setup request and response mocks
    req = {
      query: {},
      user: { id: 1, role: 'counselor' }
    };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis()
    };

    // Stub pool.query
    poolStub = sinon.stub(pool, 'query');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Property 2: Preservation - Anonymous Client and Filtering Behavior', () => {
    /**
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
     * 
     * Test anonymous client handling continues to show "Anonymous" without profile pictures
     * Test filtering by category, urgency, and status continues to work correctly
     * Test display name logic (CASE statement) continues working as before
     * 
     * **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
     */
    it('should preserve anonymous client handling (display "Anonymous" without profile pictures)', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Generate anonymous client requests
            anonymousRequests: fc.array(
              fc.record({
                id: fc.integer({ min: 1, max: 1000 }),
                user_id: fc.integer({ min: 1, max: 100 }),
                category: fc.constantFrom('Relationship', 'Career', 'Family', 'Youth', 'Mental Wellness', 'Business'),
                title: fc.string({ minLength: 10, maxLength: 100 }),
                description: fc.string({ minLength: 20, maxLength: 500 }),
                urgency: fc.constantFrom('low', 'normal', 'high', 'urgent'),
                status: fc.constantFrom('open', 'assigned', 'in_progress', 'resolved', 'closed'),
                is_anonymous: fc.constant(true), // Force anonymous
                created_at: fc.date(),
                updated_at: fc.date()
              }),
              { minLength: 1, maxLength: 3 }
            ),
            // Generate corresponding users
            users: fc.array(
              fc.record({
                id: fc.integer({ min: 1, max: 100 }),
                name: fc.string({ minLength: 5, maxLength: 50 }),
                email: fc.emailAddress(),
                role: fc.constant('user')
              }),
              { minLength: 1, maxLength: 3 }
            ),
            // Query parameters
            queryParams: fc.record({
              category: fc.option(fc.constantFrom('Relationship', 'Career', 'Family', 'Youth', 'Mental Wellness', 'Business')),
              urgency: fc.option(fc.constantFrom('low', 'normal', 'high', 'urgent')),
              status: fc.option(fc.constantFrom('open', 'assigned', 'in_progress', 'resolved', 'closed'), { nil: 'open' })
            })
          }),
          async ({ anonymousRequests, users, queryParams }) => {
            // Reset stubs for each iteration
            poolStub.resetHistory();
            res.status.resetHistory();
            res.json.resetHistory();

            // Setup request query parameters
            req.query = {
              category: queryParams.category,
              urgency: queryParams.urgency,
              status: queryParams.status || 'open'
            };

            // Mock counselor lookup (first query)
            poolStub.onFirstCall().resolves({
              rows: [{ category: 'Relationship' }]
            });

            // Create mock database result that simulates the CURRENT behavior for anonymous clients
            const mockAnonymousResults = anonymousRequests.map(request => {
              const user = users.find(u => u.id === request.user_id) || users[0];
              return {
                ...request,
                client_name: user.name, // Real name is stored but not displayed
                display_name: 'Anonymous' // This is the key preservation requirement
                // NOTE: No profile_picture field - this is expected for anonymous clients
              };
            });

            // Mock the getClientRequests query (second query)
            poolStub.onSecondCall().resolves({
              rows: mockAnonymousResults
            });

            // Call the getClientRequests function
            await counselorController.getClientRequests(req, res);

            // Verify the function executed successfully
            expect(res.json.called).to.be.true;
            const responseData = res.json.firstCall.args[0];

            // **PRESERVATION CHECK**: Anonymous clients should show "Anonymous" as display_name
            responseData.forEach(request => {
              if (request.is_anonymous) {
                expect(request.display_name, 'Anonymous clients should display "Anonymous"').to.equal('Anonymous');
                // Anonymous clients should NOT have profile pictures (this behavior should be preserved)
                if (request.hasOwnProperty('profile_picture')) {
                  expect(request.profile_picture, 'Anonymous clients should not have profile pictures').to.be.null;
                }
              }
            });

            // **PRESERVATION CHECK**: Verify existing response structure
            expect(responseData).to.be.an('array');
            responseData.forEach(request => {
              expect(request).to.have.property('client_name');
              expect(request).to.have.property('display_name');
              expect(request).to.have.property('category');
              expect(request).to.have.property('title');
              expect(request).to.have.property('description');
              expect(request).to.have.property('urgency');
              expect(request).to.have.property('status');
              expect(request).to.have.property('is_anonymous');
            });
          }
        ),
        { 
          numRuns: 5, // Reduced runs for preservation test
          verbose: false
        }
      );
    });

    it('should preserve filtering functionality (category, urgency, status)', async function() {
      this.timeout(30000);

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Generate client requests with various filters
            clientRequests: fc.array(
              fc.record({
                id: fc.integer({ min: 1, max: 1000 }),
                user_id: fc.integer({ min: 1, max: 100 }),
                category: fc.constantFrom('Relationship', 'Career', 'Family', 'Youth', 'Mental Wellness', 'Business'),
                title: fc.string({ minLength: 10, maxLength: 100 }),
                description: fc.string({ minLength: 20, maxLength: 500 }),
                urgency: fc.constantFrom('low', 'normal', 'high', 'urgent'),
                status: fc.constantFrom('open', 'assigned', 'in_progress', 'resolved', 'closed'),
                is_anonymous: fc.boolean(),
                created_at: fc.date(),
                updated_at: fc.date()
              }),
              { minLength: 1, maxLength: 5 }
            ),
            // Generate corresponding users
            users: fc.array(
              fc.record({
                id: fc.integer({ min: 1, max: 100 }),
                name: fc.string({ minLength: 5, maxLength: 50 }),
                email: fc.emailAddress(),
                role: fc.constant('user')
              }),
              { minLength: 1, maxLength: 5 }
            ),
            // Test different filter combinations
            filters: fc.record({
              category: fc.option(fc.constantFrom('Relationship', 'Career', 'Family', 'Youth', 'Mental Wellness', 'Business')),
              urgency: fc.option(fc.constantFrom('low', 'normal', 'high', 'urgent')),
              status: fc.constantFrom('open', 'assigned', 'in_progress', 'resolved', 'closed')
            })
          }),
          async ({ clientRequests, users, filters }) => {
            // Reset stubs for each iteration
            poolStub.resetHistory();
            res.status.resetHistory();
            res.json.resetHistory();

            // Setup request query parameters with filters
            req.query = {
              category: filters.category,
              urgency: filters.urgency,
              status: filters.status
            };

            // Mock counselor lookup (first query)
            poolStub.onFirstCall().resolves({
              rows: [{ category: 'Relationship' }]
            });

            // Filter the mock data based on the query parameters (simulating database filtering)
            let filteredRequests = clientRequests.filter(request => request.status === filters.status);
            
            if (filters.category) {
              filteredRequests = filteredRequests.filter(request => 
                request.category.toLowerCase() === filters.category.toLowerCase()
              );
            }
            
            if (filters.urgency) {
              filteredRequests = filteredRequests.filter(request => request.urgency === filters.urgency);
            }

            // Create mock database result that simulates the CURRENT filtering behavior
            const mockFilteredResults = filteredRequests.map(request => {
              const user = users.find(u => u.id === request.user_id) || users[0];
              return {
                ...request,
                client_name: user.name,
                display_name: request.is_anonymous ? 'Anonymous' : user.name
                // NOTE: No profile_picture field - this simulates current behavior
              };
            });

            // Mock the getClientRequests query (second query)
            poolStub.onSecondCall().resolves({
              rows: mockFilteredResults
            });

            // Call the getClientRequests function
            await counselorController.getClientRequests(req, res);

            // Verify the function executed successfully
            expect(res.json.called).to.be.true;
            const responseData = res.json.firstCall.args[0];

            // **PRESERVATION CHECK**: Verify filtering works correctly
            responseData.forEach(request => {
              // All results should match the status filter
              expect(request.status, 'All results should match status filter').to.equal(filters.status);
              
              // If category filter was applied, all results should match
              if (filters.category) {
                expect(request.category.toLowerCase(), 'All results should match category filter')
                  .to.equal(filters.category.toLowerCase());
              }
              
              // If urgency filter was applied, all results should match
              if (filters.urgency) {
                expect(request.urgency, 'All results should match urgency filter').to.equal(filters.urgency);
              }
            });

            // **PRESERVATION CHECK**: Verify display name logic still works
            responseData.forEach(request => {
              if (request.is_anonymous) {
                expect(request.display_name, 'Anonymous clients should display "Anonymous"').to.equal('Anonymous');
              } else {
                expect(request.display_name, 'Non-anonymous clients should display their name').to.equal(request.client_name);
              }
            });

            // **PRESERVATION CHECK**: Verify response structure remains unchanged
            expect(responseData).to.be.an('array');
            responseData.forEach(request => {
              expect(request).to.have.property('client_name');
              expect(request).to.have.property('display_name');
              expect(request).to.have.property('category');
              expect(request).to.have.property('title');
              expect(request).to.have.property('description');
              expect(request).to.have.property('urgency');
              expect(request).to.have.property('status');
              expect(request).to.have.property('is_anonymous');
            });
          }
        ),
        { 
          numRuns: 8, // More runs to test various filter combinations
          verbose: false
        }
      );
    });

    it('should preserve SQL query structure and parameter handling', async () => {
      // This test verifies that the current SQL query structure is preserved
      // and that parameter handling continues to work correctly
      
      poolStub.resetHistory();
      res.status.resetHistory();
      res.json.resetHistory();

      // Test with multiple query parameters
      req.query = { 
        category: 'Relationship', 
        urgency: 'high', 
        status: 'open' 
      };

      // Mock counselor lookup
      poolStub.onFirstCall().resolves({
        rows: [{ category: 'Relationship' }]
      });

      // Mock client requests result
      poolStub.onSecondCall().resolves({
        rows: [
          {
            id: 1,
            user_id: 2,
            category: 'Relationship',
            title: 'Need relationship advice',
            description: 'Having issues with communication',
            urgency: 'high',
            status: 'open',
            is_anonymous: false,
            client_name: 'John Doe',
            display_name: 'John Doe',
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });

      // Call the function
      await counselorController.getClientRequests(req, res);

      // Verify the SQL query was called correctly
      expect(poolStub.callCount).to.be.at.least(2);
      
      // Get the SQL query and parameters from the second call (main query)
      const sqlQuery = poolStub.secondCall.args[0];
      const sqlParams = poolStub.secondCall.args[1];
      
      // **PRESERVATION CHECK**: Verify SQL query structure is preserved
      expect(sqlQuery).to.include('SELECT cr.*');
      expect(sqlQuery).to.include('u.name as client_name');
      expect(sqlQuery).to.include('CASE WHEN cr.is_anonymous THEN \'Anonymous\' ELSE u.name END as display_name');
      expect(sqlQuery).to.include('FROM client_requests cr');
      expect(sqlQuery).to.include('JOIN users u ON cr.user_id = u.id');
      expect(sqlQuery).to.include('WHERE cr.status = $1');
      expect(sqlQuery).to.include('ORDER BY cr.created_at DESC');
      
      // **PRESERVATION CHECK**: Verify parameter handling is preserved
      expect(sqlParams).to.be.an('array');
      expect(sqlParams[0]).to.equal('open'); // status parameter
      expect(sqlParams).to.include('Relationship'); // category parameter
      expect(sqlParams).to.include('high'); // urgency parameter
      
      // **PRESERVATION CHECK**: Verify response structure
      expect(res.json.called).to.be.true;
      const responseData = res.json.firstCall.args[0];
      expect(responseData).to.be.an('array');
      expect(responseData[0]).to.have.property('client_name');
      expect(responseData[0]).to.have.property('display_name');
      expect(responseData[0].display_name).to.equal('John Doe');
    });

    it('should preserve CASE statement logic for display_name', async () => {
      // Test that the CASE statement logic for display_name continues working correctly
      
      poolStub.resetHistory();
      res.status.resetHistory();
      res.json.resetHistory();

      req.query = { status: 'open' };

      // Mock counselor lookup
      poolStub.onFirstCall().resolves({
        rows: [{ category: 'Relationship' }]
      });

      // Mock mixed anonymous and non-anonymous requests
      poolStub.onSecondCall().resolves({
        rows: [
          {
            id: 1,
            user_id: 2,
            category: 'Relationship',
            title: 'Anonymous request',
            description: 'This is anonymous',
            urgency: 'normal',
            status: 'open',
            is_anonymous: true,
            client_name: 'John Doe', // Real name stored but not displayed
            display_name: 'Anonymous', // CASE statement result
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 2,
            user_id: 3,
            category: 'Career',
            title: 'Public request',
            description: 'This is not anonymous',
            urgency: 'high',
            status: 'open',
            is_anonymous: false,
            client_name: 'Jane Smith',
            display_name: 'Jane Smith', // CASE statement result
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });

      // Call the function
      await counselorController.getClientRequests(req, res);

      // Verify response
      expect(res.json.called).to.be.true;
      const responseData = res.json.firstCall.args[0];

      // **PRESERVATION CHECK**: Verify CASE statement logic is preserved
      const anonymousRequest = responseData.find(r => r.is_anonymous === true);
      const publicRequest = responseData.find(r => r.is_anonymous === false);

      expect(anonymousRequest, 'Anonymous request should exist').to.exist;
      expect(anonymousRequest.display_name, 'Anonymous request should show "Anonymous"').to.equal('Anonymous');
      expect(anonymousRequest.client_name, 'Anonymous request should still have client_name stored').to.equal('John Doe');

      expect(publicRequest, 'Public request should exist').to.exist;
      expect(publicRequest.display_name, 'Public request should show real name').to.equal('Jane Smith');
      expect(publicRequest.client_name, 'Public request should have client_name').to.equal('Jane Smith');
    });

    it('should preserve default status filtering behavior', async () => {
      // Test that default status='open' filtering is preserved when no status is provided
      
      poolStub.resetHistory();
      res.status.resetHistory();
      res.json.resetHistory();

      // No status provided in query - should default to 'open'
      req.query = {};

      // Mock counselor lookup
      poolStub.onFirstCall().resolves({
        rows: [{ category: 'Relationship' }]
      });

      // Mock result
      poolStub.onSecondCall().resolves({
        rows: []
      });

      // Call the function
      await counselorController.getClientRequests(req, res);

      // **PRESERVATION CHECK**: Verify default status='open' is used
      expect(poolStub.callCount).to.be.at.least(2);
      const sqlParams = poolStub.secondCall.args[1];
      expect(sqlParams[0], 'Default status should be "open"').to.equal('open');
    });
  });
});