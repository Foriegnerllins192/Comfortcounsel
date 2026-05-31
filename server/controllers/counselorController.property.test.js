const { expect } = require('chai');
const sinon = require('sinon');
const fc = require('fast-check');
const counselorController = require('./counselorController');
const { pool } = require('../database');

describe('Counselor Controller Property-Based Tests', () => {
  let req, res, poolStub, clientStub;

  beforeEach(() => {
    // Setup request and response mocks
    req = {
      body: {},
      user: { id: 1, role: 'counselor' }
    };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis()
    };

    // Create a mock client for transaction handling
    clientStub = {
      query: sinon.stub(),
      release: sinon.stub()
    };

    // Stub pool.connect to return our mock client
    poolStub = sinon.stub(pool, 'connect').resolves(clientStub);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Property 3: Profile Update Idempotence', () => {
    /**
     * **Validates: Requirements 3.6**
     * 
     * For any valid profile data, updating a counselor profile twice with the same data 
     * SHALL result in the same database state as updating once.
     * 
     * This property ensures that profile updates are idempotent - applying the same
     * update multiple times has the same effect as applying it once.
     */
    it('should produce identical database state when updating profile twice with same data', async function() {
      this.timeout(30000); // Property-based tests need more time

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            bio: fc.string({ maxLength: 2000 }),
            location: fc.string({ maxLength: 255 }),
            years_experience: fc.integer({ min: 0, max: 50 }),
            phone_number: fc.tuple(
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9')
            ).map(digits => digits.join('')),
            name: fc.string({ minLength: 1, maxLength: 255 }).filter(s => s.trim().length > 0)
          }),
          async (profileData) => {
            // Reset stubs for each iteration
            poolStub.resetHistory();
            clientStub.query.reset();
            clientStub.release.reset();
            res.status.resetHistory();
            res.json.resetHistory();

            // Setup request body
            req.body = { ...profileData };

            // Mock database responses for first update
            clientStub.query.onCall(0).resolves(); // BEGIN
            clientStub.query.onCall(1).resolves(); // UPDATE counselors
            clientStub.query.onCall(2).resolves(); // UPDATE users
            clientStub.query.onCall(3).resolves(); // COMMIT

            // First update
            await counselorController.updateProfile(req, res);

            // Capture the database operations from first update
            const firstBeginCall = clientStub.query.getCall(0);
            const firstCounselorUpdateCall = clientStub.query.getCall(1);
            const firstUserUpdateCall = clientStub.query.getCall(2);
            const firstCommitCall = clientStub.query.getCall(3);

            // Verify first update succeeded
            expect(res.json.called).to.be.true;
            expect(res.json.firstCall.args[0]).to.have.property('message', 'Profile updated successfully');

            // Extract the parameters from first update
            const firstCounselorParams = firstCounselorUpdateCall.args[1];
            const firstUserParams = firstUserUpdateCall.args[1];

            // Reset for second update
            poolStub.resetHistory();
            clientStub.query.reset();
            clientStub.release.reset();
            res.status.resetHistory();
            res.json.resetHistory();

            // Setup same request body for second update
            req.body = { ...profileData };

            // Mock database responses for second update (identical to first)
            clientStub.query.onCall(0).resolves(); // BEGIN
            clientStub.query.onCall(1).resolves(); // UPDATE counselors
            clientStub.query.onCall(2).resolves(); // UPDATE users
            clientStub.query.onCall(3).resolves(); // COMMIT

            // Second update with same data
            await counselorController.updateProfile(req, res);

            // Capture the database operations from second update
            const secondBeginCall = clientStub.query.getCall(0);
            const secondCounselorUpdateCall = clientStub.query.getCall(1);
            const secondUserUpdateCall = clientStub.query.getCall(2);
            const secondCommitCall = clientStub.query.getCall(3);

            // Verify second update succeeded
            expect(res.json.called).to.be.true;
            expect(res.json.firstCall.args[0]).to.have.property('message', 'Profile updated successfully');

            // Extract the parameters from second update
            const secondCounselorParams = secondCounselorUpdateCall.args[1];
            const secondUserParams = secondUserUpdateCall.args[1];

            // IDEMPOTENCE CHECK: Both updates should produce identical SQL queries
            expect(firstCounselorUpdateCall.args[0]).to.equal(secondCounselorUpdateCall.args[0]);
            expect(firstUserUpdateCall.args[0]).to.equal(secondUserUpdateCall.args[0]);

            // IDEMPOTENCE CHECK: Both updates should use identical parameters
            expect(firstCounselorParams).to.deep.equal(secondCounselorParams);
            expect(firstUserParams).to.deep.equal(secondUserParams);

            // IDEMPOTENCE CHECK: The trimmed values should be identical
            // Note: The controller uses `bio ? bio.trim() : null` which means:
            // - Falsy values (null, undefined, "") become null
            // - Truthy values (including whitespace-only) are trimmed (may result in empty string)
            const expectedBio = profileData.bio ? profileData.bio.trim() : null;
            const expectedLocation = profileData.location ? profileData.location.trim() : null;
            const expectedPhone = profileData.phone_number ? profileData.phone_number.trim() : null;
            const expectedName = profileData.name ? profileData.name.trim() : null;

            expect(firstCounselorParams[0]).to.equal(expectedBio);
            expect(firstCounselorParams[1]).to.equal(expectedLocation);
            expect(firstCounselorParams[2]).to.equal(profileData.years_experience);
            expect(firstCounselorParams[3]).to.equal(expectedPhone);
            expect(firstCounselorParams[4]).to.equal(req.user.id);

            expect(secondCounselorParams[0]).to.equal(expectedBio);
            expect(secondCounselorParams[1]).to.equal(expectedLocation);
            expect(secondCounselorParams[2]).to.equal(profileData.years_experience);
            expect(secondCounselorParams[3]).to.equal(expectedPhone);
            expect(secondCounselorParams[4]).to.equal(req.user.id);

            // IDEMPOTENCE CHECK: User name updates should be identical
            expect(firstUserParams[0]).to.equal(expectedName);
            expect(firstUserParams[1]).to.equal(req.user.id);
            expect(secondUserParams[0]).to.equal(expectedName);
            expect(secondUserParams[1]).to.equal(req.user.id);

            // Verify transaction structure is identical
            expect(firstBeginCall.args[0]).to.equal('BEGIN');
            expect(secondBeginCall.args[0]).to.equal('BEGIN');
            expect(firstCommitCall.args[0]).to.equal('COMMIT');
            expect(secondCommitCall.args[0]).to.equal('COMMIT');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle whitespace consistently across multiple updates', async function() {
      this.timeout(30000); // Property-based tests need more time

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            bio: fc.string({ maxLength: 1990 }).map(s => `  ${s}  `), // Add whitespace
            location: fc.string({ maxLength: 245 }).map(s => ` ${s} `), // Add whitespace
            years_experience: fc.integer({ min: 0, max: 50 }),
            phone_number: fc.tuple(
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9')
            ).map(digits => `  ${digits.join('')}  `), // Add whitespace
            name: fc.string({ minLength: 1, maxLength: 245 }).filter(s => s.trim().length > 0).map(s => `  ${s}  `) // Add whitespace
          }),
          async (profileDataWithWhitespace) => {
            // Reset stubs for each iteration
            poolStub.resetHistory();
            clientStub.query.reset();
            clientStub.release.reset();
            res.status.resetHistory();
            res.json.resetHistory();

            // Setup request body with whitespace
            req.body = { ...profileDataWithWhitespace };

            // Mock database responses for first update
            clientStub.query.onCall(0).resolves(); // BEGIN
            clientStub.query.onCall(1).resolves(); // UPDATE counselors
            clientStub.query.onCall(2).resolves(); // UPDATE users
            clientStub.query.onCall(3).resolves(); // COMMIT

            // First update
            await counselorController.updateProfile(req, res);

            // Capture trimmed values from first update
            const firstCounselorParams = clientStub.query.getCall(1).args[1];
            const firstUserParams = clientStub.query.getCall(2).args[1];

            // Reset for second update
            poolStub.resetHistory();
            clientStub.query.reset();
            clientStub.release.reset();
            res.status.resetHistory();
            res.json.resetHistory();

            // Setup same request body with whitespace for second update
            req.body = { ...profileDataWithWhitespace };

            // Mock database responses for second update
            clientStub.query.onCall(0).resolves(); // BEGIN
            clientStub.query.onCall(1).resolves(); // UPDATE counselors
            clientStub.query.onCall(2).resolves(); // UPDATE users
            clientStub.query.onCall(3).resolves(); // COMMIT

            // Second update with same data (including whitespace)
            await counselorController.updateProfile(req, res);

            // Capture trimmed values from second update
            const secondCounselorParams = clientStub.query.getCall(1).args[1];
            const secondUserParams = clientStub.query.getCall(2).args[1];

            // IDEMPOTENCE CHECK: Whitespace should be trimmed consistently
            expect(firstCounselorParams[0]).to.equal(secondCounselorParams[0]);
            expect(firstCounselorParams[1]).to.equal(secondCounselorParams[1]);
            expect(firstCounselorParams[3]).to.equal(secondCounselorParams[3]);
            expect(firstUserParams[0]).to.equal(secondUserParams[0]);

            // IDEMPOTENCE CHECK: Trimmed values should not contain leading/trailing whitespace
            // Note: The controller uses `bio ? bio.trim() : null` which means:
            // - Falsy values (null, undefined, "") become null
            // - Truthy values (including whitespace-only) are trimmed (may result in empty string)
            const expectedBio = profileDataWithWhitespace.bio ? profileDataWithWhitespace.bio.trim() : null;
            const expectedLocation = profileDataWithWhitespace.location ? profileDataWithWhitespace.location.trim() : null;
            const expectedPhone = profileDataWithWhitespace.phone_number ? profileDataWithWhitespace.phone_number.trim() : null;
            const expectedName = profileDataWithWhitespace.name ? profileDataWithWhitespace.name.trim() : null;

            expect(firstCounselorParams[0]).to.equal(expectedBio);
            expect(firstCounselorParams[1]).to.equal(expectedLocation);
            expect(firstCounselorParams[3]).to.equal(expectedPhone);
            expect(firstUserParams[0]).to.equal(expectedName);

            expect(secondCounselorParams[0]).to.equal(expectedBio);
            expect(secondCounselorParams[1]).to.equal(expectedLocation);
            expect(secondCounselorParams[3]).to.equal(expectedPhone);
            expect(secondUserParams[0]).to.equal(expectedName);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should produce identical results for updates without name changes', async function() {
      this.timeout(30000); // Property-based tests need more time

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            bio: fc.string({ maxLength: 2000 }),
            location: fc.string({ maxLength: 255 }),
            years_experience: fc.integer({ min: 0, max: 50 }),
            phone_number: fc.tuple(
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9')
            ).map(digits => digits.join(''))
          }),
          async (profileData) => {
            // Reset stubs for each iteration
            poolStub.resetHistory();
            clientStub.query.reset();
            clientStub.release.reset();
            res.status.resetHistory();
            res.json.resetHistory();

            // Setup request body WITHOUT name (name is optional)
            req.body = { ...profileData };

            // Mock database responses for first update
            clientStub.query.onCall(0).resolves(); // BEGIN
            clientStub.query.onCall(1).resolves(); // UPDATE counselors
            clientStub.query.onCall(2).resolves(); // COMMIT (no user update)

            // First update
            await counselorController.updateProfile(req, res);

            // Verify first update succeeded
            expect(res.json.called).to.be.true;
            expect(res.json.firstCall.args[0]).to.have.property('message', 'Profile updated successfully');

            // Capture the database operations from first update
            const firstCounselorParams = clientStub.query.getCall(1).args[1];

            // Reset for second update
            poolStub.resetHistory();
            clientStub.query.reset();
            clientStub.release.reset();
            res.status.resetHistory();
            res.json.resetHistory();

            // Setup same request body for second update
            req.body = { ...profileData };

            // Mock database responses for second update
            clientStub.query.onCall(0).resolves(); // BEGIN
            clientStub.query.onCall(1).resolves(); // UPDATE counselors
            clientStub.query.onCall(2).resolves(); // COMMIT

            // Second update with same data
            await counselorController.updateProfile(req, res);

            // Verify second update succeeded
            expect(res.json.called).to.be.true;
            expect(res.json.firstCall.args[0]).to.have.property('message', 'Profile updated successfully');

            // Capture the database operations from second update
            const secondCounselorParams = clientStub.query.getCall(1).args[1];

            // IDEMPOTENCE CHECK: Both updates should use identical parameters
            expect(firstCounselorParams).to.deep.equal(secondCounselorParams);

            // IDEMPOTENCE CHECK: The trimmed values should be identical
            // Note: The controller uses `bio ? bio.trim() : null` which means:
            // - Falsy values (null, undefined, "") become null
            // - Truthy values (including whitespace-only) are trimmed (may result in empty string)
            const expectedBio = profileData.bio ? profileData.bio.trim() : null;
            const expectedLocation = profileData.location ? profileData.location.trim() : null;
            const expectedPhone = profileData.phone_number ? profileData.phone_number.trim() : null;

            expect(firstCounselorParams[0]).to.equal(expectedBio);
            expect(firstCounselorParams[1]).to.equal(expectedLocation);
            expect(firstCounselorParams[2]).to.equal(profileData.years_experience);
            expect(firstCounselorParams[3]).to.equal(expectedPhone);
            expect(firstCounselorParams[4]).to.equal(req.user.id);

            expect(secondCounselorParams[0]).to.equal(expectedBio);
            expect(secondCounselorParams[1]).to.equal(expectedLocation);
            expect(secondCounselorParams[2]).to.equal(profileData.years_experience);
            expect(secondCounselorParams[3]).to.equal(expectedPhone);
            expect(secondCounselorParams[4]).to.equal(req.user.id);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 7: Data Sanitization', () => {
    /**
     * **Validates: Requirements 8.2**
     * 
     * For any text input, the system SHALL trim leading and trailing whitespace 
     * before validation and storage.
     * 
     * This property ensures that all text inputs are consistently sanitized by
     * removing leading and trailing whitespace, preventing storage of unnecessary
     * whitespace and ensuring consistent data quality.
     */
    it('should trim leading and trailing whitespace from all text inputs', async function() {
      this.timeout(30000); // Property-based tests need more time

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            bio: fc.string({ maxLength: 1990 }).map(s => {
              // Generate random whitespace patterns
              const leadingWs = fc.sample(fc.constantFrom('', ' ', '  ', '\t', '\n', '   '))[0];
              const trailingWs = fc.sample(fc.constantFrom('', ' ', '  ', '\t', '\n', '   '))[0];
              return `${leadingWs}${s}${trailingWs}`;
            }),
            location: fc.string({ maxLength: 245 }).map(s => {
              const leadingWs = fc.sample(fc.constantFrom('', ' ', '  ', '\t'))[0];
              const trailingWs = fc.sample(fc.constantFrom('', ' ', '  ', '\t'))[0];
              return `${leadingWs}${s}${trailingWs}`;
            }),
            years_experience: fc.integer({ min: 0, max: 50 }),
            phone_number: fc.tuple(
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9')
            ).map(digits => {
              const phone = digits.join('');
              const leadingWs = fc.sample(fc.constantFrom('', ' ', '  '))[0];
              const trailingWs = fc.sample(fc.constantFrom('', ' ', '  '))[0];
              return `${leadingWs}${phone}${trailingWs}`;
            }),
            name: fc.string({ minLength: 1, maxLength: 245 })
              .filter(s => s.trim().length > 0)
              .map(s => {
                const leadingWs = fc.sample(fc.constantFrom('', ' ', '  ', '\t'))[0];
                const trailingWs = fc.sample(fc.constantFrom('', ' ', '  ', '\t'))[0];
                return `${leadingWs}${s}${trailingWs}`;
              })
          }),
          async (profileDataWithWhitespace) => {
            // Reset stubs for each iteration
            poolStub.resetHistory();
            clientStub.query.reset();
            clientStub.release.reset();
            res.status.resetHistory();
            res.json.resetHistory();

            // Setup request body with whitespace-padded inputs
            req.body = { ...profileDataWithWhitespace };

            // Mock database responses
            clientStub.query.onCall(0).resolves(); // BEGIN
            clientStub.query.onCall(1).resolves(); // UPDATE counselors
            clientStub.query.onCall(2).resolves(); // UPDATE users
            clientStub.query.onCall(3).resolves(); // COMMIT

            // Call updateProfile
            await counselorController.updateProfile(req, res);

            // Verify the update succeeded
            expect(res.json.called).to.be.true;
            expect(res.json.firstCall.args[0]).to.have.property('message', 'Profile updated successfully');

            // Capture the database parameters
            const counselorParams = clientStub.query.getCall(1).args[1];
            const userParams = clientStub.query.getCall(2).args[1];

            // SANITIZATION CHECK: All text inputs should have whitespace trimmed
            // The controller uses `bio ? bio.trim() : null` pattern
            const expectedBio = profileDataWithWhitespace.bio ? profileDataWithWhitespace.bio.trim() : null;
            const expectedLocation = profileDataWithWhitespace.location ? profileDataWithWhitespace.location.trim() : null;
            const expectedPhone = profileDataWithWhitespace.phone_number ? profileDataWithWhitespace.phone_number.trim() : null;
            const expectedName = profileDataWithWhitespace.name ? profileDataWithWhitespace.name.trim() : null;

            // Verify bio is trimmed
            expect(counselorParams[0]).to.equal(expectedBio);
            if (expectedBio !== null && expectedBio.length > 0) {
              // Should not have leading whitespace
              expect(counselorParams[0]).to.not.match(/^\s/);
              // Should not have trailing whitespace
              expect(counselorParams[0]).to.not.match(/\s$/);
            }

            // Verify location is trimmed
            expect(counselorParams[1]).to.equal(expectedLocation);
            if (expectedLocation !== null && expectedLocation.length > 0) {
              expect(counselorParams[1]).to.not.match(/^\s/);
              expect(counselorParams[1]).to.not.match(/\s$/);
            }

            // Verify phone_number is trimmed
            expect(counselorParams[3]).to.equal(expectedPhone);
            if (expectedPhone !== null && expectedPhone.length > 0) {
              expect(counselorParams[3]).to.not.match(/^\s/);
              expect(counselorParams[3]).to.not.match(/\s$/);
            }

            // Verify name is trimmed
            expect(userParams[0]).to.equal(expectedName);
            if (expectedName !== null && expectedName.length > 0) {
              expect(userParams[0]).to.not.match(/^\s/);
              expect(userParams[0]).to.not.match(/\s$/);
            }

            // SANITIZATION CHECK: Trimmed values should equal manually trimmed originals
            expect(counselorParams[0]).to.equal(profileDataWithWhitespace.bio ? profileDataWithWhitespace.bio.trim() : null);
            expect(counselorParams[1]).to.equal(profileDataWithWhitespace.location ? profileDataWithWhitespace.location.trim() : null);
            expect(counselorParams[3]).to.equal(profileDataWithWhitespace.phone_number ? profileDataWithWhitespace.phone_number.trim() : null);
            expect(userParams[0]).to.equal(profileDataWithWhitespace.name ? profileDataWithWhitespace.name.trim() : null);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle empty strings and null values correctly after trimming', async function() {
      this.timeout(30000); // Property-based tests need more time

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            bio: fc.oneof(
              fc.constant(null),
              fc.constant(''),
              fc.constant('   '), // Whitespace-only
              fc.string({ maxLength: 100 })
            ),
            location: fc.oneof(
              fc.constant(null),
              fc.constant(''),
              fc.constant('  '), // Whitespace-only
              fc.string({ maxLength: 100 })
            ),
            years_experience: fc.integer({ min: 0, max: 50 }),
            phone_number: fc.oneof(
              fc.constant(null),
              fc.constant(''),
              fc.tuple(
                fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
                fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
                fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
                fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
                fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
                fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
                fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
                fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
                fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
                fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9')
              ).map(digits => digits.join(''))
            ),
            name: fc.oneof(
              fc.constant(null),
              fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
            )
          }),
          async (profileData) => {
            // Reset stubs for each iteration
            poolStub.resetHistory();
            clientStub.query.reset();
            clientStub.release.reset();
            res.status.resetHistory();
            res.json.resetHistory();

            // Setup request body
            req.body = { ...profileData };

            // Mock database responses
            clientStub.query.onCall(0).resolves(); // BEGIN
            clientStub.query.onCall(1).resolves(); // UPDATE counselors
            if (profileData.name) {
              clientStub.query.onCall(2).resolves(); // UPDATE users
              clientStub.query.onCall(3).resolves(); // COMMIT
            } else {
              clientStub.query.onCall(2).resolves(); // COMMIT (no user update)
            }

            // Call updateProfile
            await counselorController.updateProfile(req, res);

            // Verify the update succeeded
            expect(res.json.called).to.be.true;
            expect(res.json.firstCall.args[0]).to.have.property('message', 'Profile updated successfully');

            // Capture the database parameters
            const counselorParams = clientStub.query.getCall(1).args[1];

            // SANITIZATION CHECK: Empty strings and whitespace-only strings should become null or empty
            // The controller uses `bio ? bio.trim() : null` which means:
            // - null/undefined -> null
            // - '' -> null (falsy)
            // - '   ' -> '' (truthy but trims to empty)
            // - 'text' -> 'text' (truthy and has content)

            const expectedBio = profileData.bio ? profileData.bio.trim() : null;
            const expectedLocation = profileData.location ? profileData.location.trim() : null;
            const expectedPhone = profileData.phone_number ? profileData.phone_number.trim() : null;

            expect(counselorParams[0]).to.equal(expectedBio);
            expect(counselorParams[1]).to.equal(expectedLocation);
            expect(counselorParams[3]).to.equal(expectedPhone);

            // SANITIZATION CHECK: Verify no leading/trailing whitespace in stored values
            if (counselorParams[0] && counselorParams[0].length > 0) {
              expect(counselorParams[0]).to.not.match(/^\s/);
              expect(counselorParams[0]).to.not.match(/\s$/);
            }
            if (counselorParams[1] && counselorParams[1].length > 0) {
              expect(counselorParams[1]).to.not.match(/^\s/);
              expect(counselorParams[1]).to.not.match(/\s$/);
            }
            if (counselorParams[3] && counselorParams[3].length > 0) {
              expect(counselorParams[3]).to.not.match(/^\s/);
              expect(counselorParams[3]).to.not.match(/\s$/);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should preserve internal whitespace while trimming leading and trailing', async function() {
      this.timeout(30000); // Property-based tests need more time

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            bio: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 })
              .map(words => {
                const text = words.join(' '); // Internal spaces
                const leadingWs = fc.sample(fc.constantFrom('', ' ', '  '))[0];
                const trailingWs = fc.sample(fc.constantFrom('', ' ', '  '))[0];
                return `${leadingWs}${text}${trailingWs}`;
              }),
            location: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 3 })
              .map(words => {
                const text = words.join(' '); // Internal spaces
                const leadingWs = fc.sample(fc.constantFrom('', ' '))[0];
                const trailingWs = fc.sample(fc.constantFrom('', ' '))[0];
                return `${leadingWs}${text}${trailingWs}`;
              }),
            years_experience: fc.integer({ min: 0, max: 50 }),
            phone_number: fc.tuple(
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
              fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9')
            ).map(digits => digits.join('')),
            name: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 2, maxLength: 3 })
              .map(words => {
                const text = words.join(' '); // Internal spaces
                const leadingWs = fc.sample(fc.constantFrom('', ' '))[0];
                const trailingWs = fc.sample(fc.constantFrom('', ' '))[0];
                return `${leadingWs}${text}${trailingWs}`;
              })
          }),
          async (profileData) => {
            // Reset stubs for each iteration
            poolStub.resetHistory();
            clientStub.query.reset();
            clientStub.release.reset();
            res.status.resetHistory();
            res.json.resetHistory();

            // Setup request body
            req.body = { ...profileData };

            // Mock database responses
            clientStub.query.onCall(0).resolves(); // BEGIN
            clientStub.query.onCall(1).resolves(); // UPDATE counselors
            clientStub.query.onCall(2).resolves(); // UPDATE users
            clientStub.query.onCall(3).resolves(); // COMMIT

            // Call updateProfile
            await counselorController.updateProfile(req, res);

            // Verify the update succeeded
            expect(res.json.called).to.be.true;

            // Capture the database parameters
            const counselorParams = clientStub.query.getCall(1).args[1];
            const userParams = clientStub.query.getCall(2).args[1];

            // SANITIZATION CHECK: Internal whitespace should be preserved
            const expectedBio = profileData.bio.trim();
            const expectedLocation = profileData.location.trim();
            const expectedName = profileData.name.trim();

            // Verify trimming occurred
            expect(counselorParams[0]).to.equal(expectedBio);
            expect(counselorParams[1]).to.equal(expectedLocation);
            expect(userParams[0]).to.equal(expectedName);

            // SANITIZATION CHECK: Internal spaces should be preserved
            // Count spaces in original (after trim) vs stored value
            const originalBioSpaces = expectedBio.split(' ').length - 1;
            const storedBioSpaces = counselorParams[0].split(' ').length - 1;
            expect(storedBioSpaces).to.equal(originalBioSpaces);

            const originalLocationSpaces = expectedLocation.split(' ').length - 1;
            const storedLocationSpaces = counselorParams[1].split(' ').length - 1;
            expect(storedLocationSpaces).to.equal(originalLocationSpaces);

            const originalNameSpaces = expectedName.split(' ').length - 1;
            const storedNameSpaces = userParams[0].split(' ').length - 1;
            expect(storedNameSpaces).to.equal(originalNameSpaces);

            // SANITIZATION CHECK: No leading/trailing whitespace
            expect(counselorParams[0]).to.not.match(/^\s/);
            expect(counselorParams[0]).to.not.match(/\s$/);
            expect(counselorParams[1]).to.not.match(/^\s/);
            expect(counselorParams[1]).to.not.match(/\s$/);
            expect(userParams[0]).to.not.match(/^\s/);
            expect(userParams[0]).to.not.match(/\s$/);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
