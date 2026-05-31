const { expect } = require('chai');
const sinon = require('sinon');
const { updateProfile } = require('./counselorController');
const { pool } = require('../database');

describe('counselorController - updateProfile', () => {
  let req, res, clientMock, poolConnectStub;

  beforeEach(() => {
    // Setup request mock
    req = {
      body: {},
      user: { id: 1 }
    };

    // Setup response mock
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis()
    };

    // Setup database client mock
    clientMock = {
      query: sinon.stub(),
      release: sinon.stub()
    };

    // Stub pool.connect to return our mock client
    poolConnectStub = sinon.stub(pool, 'connect').resolves(clientMock);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Validation Tests', () => {
    it('should reject bio exceeding 2000 characters', async () => {
      req.body = {
        bio: 'a'.repeat(2001),
        location: 'Accra',
        years_experience: 5,
        phone_number: '0201234567',
        name: 'John Doe'
      };

      await updateProfile(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({ error: 'Bio must not exceed 2000 characters' })).to.be.true;
      expect(poolConnectStub.called).to.be.false; // Should not reach database
    });

    it('should accept bio with exactly 2000 characters', async () => {
      req.body = {
        bio: 'a'.repeat(2000),
        location: 'Accra',
        years_experience: 5,
        phone_number: '0201234567',
        name: 'John Doe'
      };

      clientMock.query.resolves();

      await updateProfile(req, res);

      expect(res.status.called).to.be.false;
      expect(res.json.calledWith({ message: 'Profile updated successfully' })).to.be.true;
    });

    it('should reject negative years_experience', async () => {
      req.body = {
        bio: 'Test bio',
        location: 'Accra',
        years_experience: -1,
        phone_number: '0201234567',
        name: 'John Doe'
      };

      await updateProfile(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({ error: 'Years of experience must be between 0 and 50' })).to.be.true;
    });

    it('should reject years_experience greater than 50', async () => {
      req.body = {
        bio: 'Test bio',
        location: 'Accra',
        years_experience: 51,
        phone_number: '0201234567',
        name: 'John Doe'
      };

      await updateProfile(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({ error: 'Years of experience must be between 0 and 50' })).to.be.true;
    });

    it('should accept years_experience of 0', async () => {
      req.body = {
        bio: 'Test bio',
        location: 'Accra',
        years_experience: 0,
        phone_number: '0201234567',
        name: 'John Doe'
      };

      clientMock.query.resolves();

      await updateProfile(req, res);

      expect(res.status.called).to.be.false;
      expect(res.json.calledWith({ message: 'Profile updated successfully' })).to.be.true;
    });

    it('should accept years_experience of 50', async () => {
      req.body = {
        bio: 'Test bio',
        location: 'Accra',
        years_experience: 50,
        phone_number: '0201234567',
        name: 'John Doe'
      };

      clientMock.query.resolves();

      await updateProfile(req, res);

      expect(res.status.called).to.be.false;
      expect(res.json.calledWith({ message: 'Profile updated successfully' })).to.be.true;
    });

    it('should reject phone number with less than 10 digits', async () => {
      req.body = {
        bio: 'Test bio',
        location: 'Accra',
        years_experience: 5,
        phone_number: '020123456', // 9 digits
        name: 'John Doe'
      };

      await updateProfile(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({ error: 'Phone number must be 10 digits' })).to.be.true;
    });

    it('should reject phone number with more than 10 digits', async () => {
      req.body = {
        bio: 'Test bio',
        location: 'Accra',
        years_experience: 5,
        phone_number: '02012345678', // 11 digits
        name: 'John Doe'
      };

      await updateProfile(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({ error: 'Phone number must be 10 digits' })).to.be.true;
    });

    it('should reject phone number with non-digit characters', async () => {
      req.body = {
        bio: 'Test bio',
        location: 'Accra',
        years_experience: 5,
        phone_number: '020-123-456', // Contains dashes
        name: 'John Doe'
      };

      await updateProfile(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({ error: 'Phone number must be 10 digits' })).to.be.true;
    });

    it('should accept valid 10-digit phone number', async () => {
      req.body = {
        bio: 'Test bio',
        location: 'Accra',
        years_experience: 5,
        phone_number: '0201234567',
        name: 'John Doe'
      };

      clientMock.query.resolves();

      await updateProfile(req, res);

      expect(res.status.called).to.be.false;
      expect(res.json.calledWith({ message: 'Profile updated successfully' })).to.be.true;
    });
  });

  describe('Whitespace Trimming Tests', () => {
    it('should trim whitespace from bio', async () => {
      req.body = {
        bio: '  Test bio with spaces  ',
        location: 'Accra',
        years_experience: 5,
        phone_number: '0201234567',
        name: 'John Doe'
      };

      clientMock.query.resolves();

      await updateProfile(req, res);

      // Check that the trimmed bio was passed to the database
      const updateCall = clientMock.query.getCalls().find(call => 
        call.args[0].includes('UPDATE counselors')
      );
      expect(updateCall.args[1][0]).to.equal('Test bio with spaces');
    });

    it('should trim whitespace from location', async () => {
      req.body = {
        bio: 'Test bio',
        location: '  Accra  ',
        years_experience: 5,
        phone_number: '0201234567',
        name: 'John Doe'
      };

      clientMock.query.resolves();

      await updateProfile(req, res);

      const updateCall = clientMock.query.getCalls().find(call => 
        call.args[0].includes('UPDATE counselors')
      );
      expect(updateCall.args[1][1]).to.equal('Accra');
    });

    it('should trim whitespace from phone_number', async () => {
      req.body = {
        bio: 'Test bio',
        location: 'Accra',
        years_experience: 5,
        phone_number: '  0201234567  ',
        name: 'John Doe'
      };

      clientMock.query.resolves();

      await updateProfile(req, res);

      const updateCall = clientMock.query.getCalls().find(call => 
        call.args[0].includes('UPDATE counselors')
      );
      expect(updateCall.args[1][3]).to.equal('0201234567');
    });

    it('should trim whitespace from name', async () => {
      req.body = {
        bio: 'Test bio',
        location: 'Accra',
        years_experience: 5,
        phone_number: '0201234567',
        name: '  John Doe  '
      };

      clientMock.query.resolves();

      await updateProfile(req, res);

      const updateCall = clientMock.query.getCalls().find(call => 
        call.args[0].includes('UPDATE users')
      );
      expect(updateCall.args[1][0]).to.equal('John Doe');
    });
  });

  describe('Transaction Tests', () => {
    it('should use database transaction for updates', async () => {
      req.body = {
        bio: 'Test bio',
        location: 'Accra',
        years_experience: 5,
        phone_number: '0201234567',
        name: 'John Doe'
      };

      clientMock.query.resolves();

      await updateProfile(req, res);

      // Verify transaction commands
      expect(clientMock.query.getCall(0).args[0]).to.equal('BEGIN');
      expect(clientMock.query.getCall(3).args[0]).to.equal('COMMIT');
      expect(clientMock.release.called).to.be.true;
    });

    it('should rollback transaction on error', async () => {
      req.body = {
        bio: 'Test bio',
        location: 'Accra',
        years_experience: 5,
        phone_number: '0201234567',
        name: 'John Doe'
      };

      // Simulate database error
      clientMock.query.onCall(0).resolves(); // BEGIN
      clientMock.query.onCall(1).rejects(new Error('Database error')); // UPDATE counselors

      await updateProfile(req, res);

      // Verify rollback was called
      expect(clientMock.query.calledWith('ROLLBACK')).to.be.true;
      expect(clientMock.release.called).to.be.true;
      expect(res.status.calledWith(500)).to.be.true;
      expect(res.json.calledWith({ error: 'Failed to update profile. Please try again.' })).to.be.true;
    });

    it('should update both counselors and users tables', async () => {
      req.body = {
        bio: 'Test bio',
        location: 'Accra',
        years_experience: 5,
        phone_number: '0201234567',
        name: 'John Doe'
      };

      clientMock.query.resolves();

      await updateProfile(req, res);

      // Verify both UPDATE queries were called
      const counselorUpdate = clientMock.query.getCalls().find(call => 
        call.args[0].includes('UPDATE counselors')
      );
      const userUpdate = clientMock.query.getCalls().find(call => 
        call.args[0].includes('UPDATE users')
      );

      expect(counselorUpdate).to.exist;
      expect(userUpdate).to.exist;
    });

    it('should not update users table if name is not provided', async () => {
      req.body = {
        bio: 'Test bio',
        location: 'Accra',
        years_experience: 5,
        phone_number: '0201234567'
        // name is omitted
      };

      clientMock.query.resolves();

      await updateProfile(req, res);

      // Verify only counselors table was updated
      const userUpdate = clientMock.query.getCalls().find(call => 
        call.args[0].includes('UPDATE users')
      );

      expect(userUpdate).to.be.undefined;
    });
  });

  describe('Success Response Tests', () => {
    it('should return success message on successful update', async () => {
      req.body = {
        bio: 'Test bio',
        location: 'Accra',
        years_experience: 5,
        phone_number: '0201234567',
        name: 'John Doe'
      };

      clientMock.query.resolves();

      await updateProfile(req, res);

      expect(res.json.calledWith({ message: 'Profile updated successfully' })).to.be.true;
    });
  });
});
