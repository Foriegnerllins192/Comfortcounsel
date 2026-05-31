/**
 * Profile Picture Synchronization Bug Exploration Test
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * **GOAL**: Surface counterexamples that demonstrate the bug exists
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3**
 * 
 * Property 1: Bug Condition - Profile Picture Missing in Client Requests
 * 
 * For any API request to getClientRequests where client users have profile pictures set in the users table,
 * the function SHALL include the profile_picture field in the response data for each client request,
 * enabling counselors to see current client profile pictures.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const fc = require('fast-check');
const counselorController = require('./counselorController');
const { pool } = require('../database');

describe('Profile Picture Sync Bug Exploration Tests', () => {
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

  describe('Property 1: Bug Condition - Profile Picture Missing in Client Requests', () => {
    /**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * Test that getClientRequests API calls return missing profile_picture fields when clients have profile pictures set in users table.
     * The test assertions should match the Expected Behavior Properties from design: profile pictures SHALL be included from users table.
     * 
     * **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
     * Document counterexamples found to understand root cause (missing profile_picture field in API response)
     */
    it('should include profile_picture field for clients with profile pictures (EXPECTED TO FAIL on unfixed code)', async function() {
      this.timeout(30000); // Property-based tests need more time

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Generate client request data with profile pictures
            clientRequests: fc.array(
              fc.record({
                id: fc.integer({ min: 1, max: 100 }),
                user_id: fc.integer({ min: 1, max: 10 }),
                category: fc.constantFrom('Relationship', 'Career'),
                title: fc.string({ minLength: 10, maxLength: 50 }),
                description: fc.string({ minLength: 20, maxLength: 100 }),
                urgency: fc.constantFrom('low', 'high'),
                status: fc.constant('open'),
                is_anonymous: fc.boolean(),
                created_at: fc.date(),
                updated_at: fc.date()
              }),
              { minLength: 1, maxLength: 2 }
            ),
            // Generate client users with profile pictures
            clientUsers: fc.array(
              fc.record({
                id: fc.integer({ min: 1, max: 10 }),
                name: fc.string({ minLength: 5, maxLength: 30 }),
                email: fc.emailAddress(),
                role: fc.constant('user'),
                // Generate profile picture data URLs (base64 encoded images)
                profile_picture: fc.oneof(
                  fc.constant('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='),
                  fc.constant(null)
                )
              }),
              { minLength: 1, maxLength: 2 }
            ),
            // Query parameters
            queryParams: fc.record({
              category: fc.option(fc.constantFrom('Relationship', 'Career')),
              urgency: fc.option(fc.constantFrom('low', 'high')),
              status: fc.constant('open')
            })
          }),
          async ({ clientRequests, clientUsers, queryParams }) => {
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
              rows: [{ category: 'Relationship' }] // Mock counselor category
            });

            // Create mock database result that simulates the CURRENT (BUGGY) behavior
            // The current query does NOT include u.profile_picture, so we simulate that
            const mockClientRequestsWithoutProfilePicture = clientRequests.map(request => {
              const user = clientUsers.find(u => u.id === request.user_id) || clientUsers[0];
              return {
                ...request,
                client_name: user.name,
                display_name: request.is_anonymous ? 'Anonymous' : user.name
                // NOTE: profile_picture is MISSING - this simulates the current bug
              };
            });

            // Mock the getClientRequests query (second query) - simulates CURRENT BUGGY behavior
            poolStub.onSecondCall().resolves({
              rows: mockClientRequestsWithoutProfilePicture
            });

            // Call the getClientRequests function
            await counselorController.getClientRequests(req, res);

            // Verify the function executed successfully
            expect(res.json.called).to.be.true;
            const responseData = res.json.firstCall.args[0];

            // **BUG CONDITION CHECK**: This assertion SHOULD FAIL on unfixed code
            // The bug is that profile_picture field is missing from the response
            
            // Find clients that have profile pictures set in the users table
            const clientsWithProfilePictures = clientRequests.filter(request => {
              const user = clientUsers.find(u => u.id === request.user_id);
              return user && user.profile_picture && !request.is_anonymous;
            });

            if (clientsWithProfilePictures.length > 0) {
              // **EXPECTED BEHAVIOR**: For clients with profile pictures, the response SHOULD include profile_picture field
              // **CURRENT BUG**: This assertion will FAIL because profile_picture is missing from the response
              
              clientsWithProfilePictures.forEach(expectedRequest => {
                const responseRequest = responseData.find(r => r.id === expectedRequest.id);
                expect(responseRequest, `Client request ${expectedRequest.id} should be in response`).to.exist;
                
                // **THIS ASSERTION WILL FAIL ON UNFIXED CODE** - proving the bug exists
                expect(responseRequest, `Client request ${expectedRequest.id} should have profile_picture field`).to.have.property('profile_picture');
                
                // Find the corresponding user to get expected profile picture
                const expectedUser = clientUsers.find(u => u.id === expectedRequest.user_id);
                if (expectedUser && expectedUser.profile_picture) {
                  expect(responseRequest.profile_picture, `Profile picture should match user's profile picture`).to.equal(expectedUser.profile_picture);
                }
              });
            }

            // **PRESERVATION CHECK**: Anonymous clients should not have profile pictures
            const anonymousRequests = clientRequests.filter(request => request.is_anonymous);
            anonymousRequests.forEach(expectedRequest => {
              const responseRequest = responseData.find(r => r.id === expectedRequest.id);
              if (responseRequest) {
                // Anonymous clients should show "Anonymous" as display name
                expect(responseRequest.display_name).to.equal('Anonymous');
                // Anonymous clients should not have profile pictures (this should work even in buggy code)
                if (responseRequest.hasOwnProperty('profile_picture')) {
                  expect(responseRequest.profile_picture).to.be.null;
                }
              }
            });

            // **PRESERVATION CHECK**: Verify existing functionality still works
            expect(responseData).to.be.an('array');
            responseData.forEach(request => {
              expect(request).to.have.property('client_name');
              expect(request).to.have.property('display_name');
              expect(request).to.have.property('category');
              expect(request).to.have.property('title');
              expect(request).to.have.property('description');
            });
          }
        ),
        { 
          numRuns: 3, // Reduced runs for faster exploration test
          verbose: true // Show counterexamples when test fails
        }
      );
    });

    it('should demonstrate specific bug case with concrete example (EXPECTED TO FAIL on unfixed code)', async () => {
      // Reset stubs
      poolStub.resetHistory();
      res.status.resetHistory();
      res.json.resetHistory();

      // Setup a concrete test case that demonstrates the bug
      req.query = { status: 'open' };

      // Mock counselor lookup
      poolStub.onFirstCall().resolves({
        rows: [{ category: 'Relationship' }]
      });

      // Mock client requests data - simulates current buggy behavior (no profile_picture field)
      const mockBuggyResponse = [
        {
          id: 1,
          user_id: 2,
          category: 'Relationship',
          title: 'Need help with communication',
          description: 'My partner and I are having communication issues',
          urgency: 'high',
          status: 'open',
          is_anonymous: false,
          client_name: 'John Mensah',
          display_name: 'John Mensah',
          created_at: new Date(),
          updated_at: new Date()
          // NOTE: profile_picture field is MISSING - this is the bug
        },
        {
          id: 2,
          user_id: 3,
          category: 'Career',
          title: 'Career transition advice',
          description: 'Looking for guidance on changing careers',
          urgency: 'normal',
          status: 'open',
          is_anonymous: false,
          client_name: 'Akua Asante',
          display_name: 'Akua Asante',
          created_at: new Date(),
          updated_at: new Date()
          // NOTE: profile_picture field is MISSING - this is the bug
        }
      ];

      // Mock the database response (simulates current buggy query)
      poolStub.onSecondCall().resolves({
        rows: mockBuggyResponse
      });

      // Call the function
      await counselorController.getClientRequests(req, res);

      // Verify function executed
      expect(res.json.called).to.be.true;
      const responseData = res.json.firstCall.args[0];

      // **BUG DEMONSTRATION**: These assertions WILL FAIL on unfixed code
      expect(responseData).to.be.an('array');
      expect(responseData).to.have.length(2);

      // **CRITICAL ASSERTION THAT WILL FAIL**: Check for missing profile_picture field
      responseData.forEach((request, index) => {
        expect(request, `Request ${index} should have profile_picture field`).to.have.property('profile_picture');
      });

      // **EXPECTED BEHAVIOR**: Non-anonymous clients should have profile_picture field
      const johnRequest = responseData.find(r => r.client_name === 'John Mensah');
      expect(johnRequest, 'John Mensah request should exist').to.exist;
      expect(johnRequest, 'John Mensah should have profile_picture field').to.have.property('profile_picture');

      const akuaRequest = responseData.find(r => r.client_name === 'Akua Asante');
      expect(akuaRequest, 'Akua Asante request should exist').to.exist;
      expect(akuaRequest, 'Akua Asante should have profile_picture field').to.have.property('profile_picture');
    });

    it('should verify SQL query structure demonstrates the root cause (EXPECTED TO FAIL on unfixed code)', async () => {
      // This test verifies that the SQL query is missing the profile_picture field
      // by checking what parameters are passed to pool.query
      
      poolStub.resetHistory();
      res.status.resetHistory();
      res.json.resetHistory();

      req.query = { status: 'open' };

      // Mock counselor lookup
      poolStub.onFirstCall().resolves({
        rows: [{ category: 'Relationship' }]
      });

      // Mock empty result to focus on query structure
      poolStub.onSecondCall().resolves({
        rows: []
      });

      // Call the function
      await counselorController.getClientRequests(req, res);

      // Verify the SQL query was called
      expect(poolStub.callCount).to.be.at.least(2);
      
      // Get the SQL query from the second call (the main client requests query)
      const sqlQuery = poolStub.secondCall.args[0];
      
      // **ROOT CAUSE VERIFICATION**: The SQL query should include u.profile_picture
      // **THIS ASSERTION WILL FAIL ON UNFIXED CODE** - proving the root cause
      expect(sqlQuery, 'SQL query should select profile_picture field').to.include('u.profile_picture');
      
      // Verify the query structure includes the expected fields
      expect(sqlQuery).to.include('SELECT');
      expect(sqlQuery).to.include('u.name as client_name');
      expect(sqlQuery).to.include('FROM client_requests cr');
      expect(sqlQuery).to.include('JOIN users u ON cr.user_id = u.id');
      
      // **BUG EVIDENCE**: This shows the query is missing the profile_picture field
      console.log('Current SQL Query (missing profile_picture):', sqlQuery);
    });
  });
});