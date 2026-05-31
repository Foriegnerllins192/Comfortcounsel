const { expect } = require('chai');
const sinon = require('sinon');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const authController = require('./authController');
const { pool } = require('../database');
const { sendPasswordResetEmail } = require('../services/emailService');

describe('Authentication Controller Tests', () => {
  let req, res, poolStub, bcryptStub, jwtStub, cryptoStub, emailStub;

  beforeEach(() => {
    // Setup request and response mocks
    req = {
      body: {},
      user: {}
    };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis()
    };

    // Stub pool.query
    poolStub = sinon.stub(pool, 'query');
    
    // Stub email service - must return a promise
    const emailService = require('../services/emailService');
    sinon.stub(emailService, 'sendPasswordResetEmail').resolves();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Password Hashing and Verification', () => {
    it('should hash passwords with bcrypt during registration', async () => {
      req.body = { name: 'Test User', email: 'test@example.com', password: 'password123' };
      
      poolStub.onFirstCall().resolves({ rows: [] }); // Email doesn't exist
      poolStub.onSecondCall().resolves({ 
        rows: [{ id: 1, name: 'Test User', email: 'test@example.com', role: 'user' }] 
      });

      const hashSpy = sinon.spy(bcrypt, 'hash');
      sinon.stub(jwt, 'sign').returns('fake-token');

      await authController.register(req, res);

      expect(hashSpy.calledWith('password123', 10)).to.be.true;
      expect(res.status.calledWith(201)).to.be.true;
      
      hashSpy.restore();
    });

    it('should verify passwords with bcrypt during login', async () => {
      req.body = { email: 'test@example.com', password: 'password123' };
      
      const hashedPassword = await bcrypt.hash('password123', 10);
      poolStub.onFirstCall().resolves({ 
        rows: [{ 
          id: 1, 
          name: 'Test User', 
          email: 'test@example.com', 
          password: hashedPassword,
          role: 'user' 
        }] 
      });

      sinon.stub(jwt, 'sign').returns('fake-token');

      await authController.login(req, res);

      expect(res.json.called).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('token');
    });

    it('should reject login with incorrect password', async () => {
      req.body = { email: 'test@example.com', password: 'wrongpassword' };
      
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      poolStub.resolves({ 
        rows: [{ 
          id: 1, 
          email: 'test@example.com', 
          password: hashedPassword,
          role: 'user' 
        }] 
      });

      await authController.login(req, res);

      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledWith({ error: 'Invalid credentials' })).to.be.true;
    });
  });

  describe('JWT Token Generation and Validation', () => {
    it('should generate JWT token with correct payload on registration', async () => {
      req.body = { name: 'Test User', email: 'test@example.com', password: 'password123' };
      
      poolStub.onFirstCall().resolves({ rows: [] });
      poolStub.onSecondCall().resolves({ 
        rows: [{ id: 1, name: 'Test User', email: 'test@example.com', role: 'user' }] 
      });

      const jwtSignSpy = sinon.spy(jwt, 'sign');

      await authController.register(req, res);

      expect(jwtSignSpy.calledOnce).to.be.true;
      const payload = jwtSignSpy.firstCall.args[0];
      expect(payload).to.have.property('id', 1);
      expect(payload).to.have.property('role', 'user');
      
      jwtSignSpy.restore();
    });

    it('should generate JWT token with 7-day expiry', async () => {
      req.body = { name: 'Test User', email: 'test@example.com', password: 'password123' };
      
      poolStub.onFirstCall().resolves({ rows: [] });
      poolStub.onSecondCall().resolves({ 
        rows: [{ id: 1, name: 'Test User', email: 'test@example.com', role: 'user' }] 
      });

      const jwtSignSpy = sinon.spy(jwt, 'sign');

      await authController.register(req, res);

      const options = jwtSignSpy.firstCall.args[2];
      expect(options).to.have.property('expiresIn', '7d');
      
      jwtSignSpy.restore();
    });

    it('should return token in response on successful login', async () => {
      req.body = { email: 'test@example.com', password: 'password123' };
      
      const hashedPassword = await bcrypt.hash('password123', 10);
      poolStub.onFirstCall().resolves({ 
        rows: [{ 
          id: 1, 
          name: 'Test User', 
          email: 'test@example.com', 
          password: hashedPassword,
          role: 'user' 
        }] 
      });

      sinon.stub(jwt, 'sign').returns('test-jwt-token');

      await authController.login(req, res);

      expect(res.json.firstCall.args[0]).to.have.property('token', 'test-jwt-token');
    });
  });

  describe('Registration Validation', () => {
    it('should validate email format is provided', async () => {
      req.body = { name: 'Test User', email: '', password: 'password123' };

      await authController.register(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({ error: 'All fields are required' })).to.be.true;
    });

    it('should validate password length is provided', async () => {
      req.body = { name: 'Test User', email: 'test@example.com', password: '' };

      await authController.register(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({ error: 'All fields are required' })).to.be.true;
    });

    it('should validate name is provided', async () => {
      req.body = { name: '', email: 'test@example.com', password: 'password123' };

      await authController.register(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({ error: 'All fields are required' })).to.be.true;
    });

    it('should reject registration with duplicate email', async () => {
      req.body = { name: 'Test User', email: 'existing@example.com', password: 'password123' };
      
      poolStub.resolves({ rows: [{ id: 1 }] }); // Email exists

      await authController.register(req, res);

      expect(res.status.calledWith(409)).to.be.true;
      expect(res.json.calledWith({ error: 'Email already registered' })).to.be.true;
    });

    it('should successfully register with valid data', async () => {
      req.body = { name: 'Test User', email: 'new@example.com', password: 'password123' };
      
      poolStub.onFirstCall().resolves({ rows: [] }); // Email doesn't exist
      poolStub.onSecondCall().resolves({ 
        rows: [{ id: 1, name: 'Test User', email: 'new@example.com', role: 'user' }] 
      });

      sinon.stub(jwt, 'sign').returns('fake-token');

      await authController.register(req, res);

      expect(res.status.calledWith(201)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('user');
      expect(res.json.firstCall.args[0]).to.have.property('token');
    });
  });

  describe('Login with Invalid Credentials', () => {
    it('should reject login with non-existent email', async () => {
      req.body = { email: 'nonexistent@example.com', password: 'password123' };
      
      poolStub.resolves({ rows: [] }); // User not found

      await authController.login(req, res);

      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledWith({ error: 'Invalid credentials' })).to.be.true;
    });

    it('should reject login with missing email', async () => {
      req.body = { email: '', password: 'password123' };

      await authController.login(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({ error: 'Email and password required' })).to.be.true;
    });

    it('should reject login with missing password', async () => {
      req.body = { email: 'test@example.com', password: '' };

      await authController.login(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({ error: 'Email and password required' })).to.be.true;
    });

    it('should reject login with wrong password', async () => {
      req.body = { email: 'test@example.com', password: 'wrongpassword' };
      
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      poolStub.resolves({ 
        rows: [{ 
          id: 1, 
          email: 'test@example.com', 
          password: hashedPassword,
          role: 'user' 
        }] 
      });

      await authController.login(req, res);

      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledWith({ error: 'Invalid credentials' })).to.be.true;
    });

    it('should successfully login with correct credentials', async () => {
      req.body = { email: 'test@example.com', password: 'correctpassword' };
      
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      poolStub.onFirstCall().resolves({ 
        rows: [{ 
          id: 1, 
          name: 'Test User',
          email: 'test@example.com', 
          password: hashedPassword,
          role: 'user' 
        }] 
      });

      sinon.stub(jwt, 'sign').returns('fake-token');

      await authController.login(req, res);

      expect(res.json.called).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('user');
      expect(res.json.firstCall.args[0]).to.have.property('token');
    });

    it('should set counselor availability to true on login', async () => {
      req.body = { email: 'counselor@example.com', password: 'password123' };
      
      const hashedPassword = await bcrypt.hash('password123', 10);
      poolStub.onFirstCall().resolves({ 
        rows: [{ 
          id: 1, 
          name: 'Counselor',
          email: 'counselor@example.com', 
          password: hashedPassword,
          role: 'counselor' 
        }] 
      });
      poolStub.onSecondCall().resolves(); // UPDATE counselors query

      sinon.stub(jwt, 'sign').returns('fake-token');

      await authController.login(req, res);

      expect(poolStub.secondCall.args[0]).to.include('UPDATE counselors SET is_available=TRUE');
      expect(poolStub.secondCall.args[1]).to.deep.equal([1]);
    });
  });

  describe('Change Password', () => {
    it('should validate current password is correct', async () => {
      req.user = { id: 1 };
      req.body = { current_password: 'wrongpassword', new_password: 'newpassword123' };
      
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      poolStub.resolves({ rows: [{ password: hashedPassword }] });

      await authController.changePassword(req, res);

      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledWith({ error: 'Current password incorrect' })).to.be.true;
    });

    it('should successfully change password with correct current password', async () => {
      req.user = { id: 1 };
      req.body = { current_password: 'correctpassword', new_password: 'newpassword123' };
      
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      poolStub.onFirstCall().resolves({ rows: [{ password: hashedPassword }] });
      poolStub.onSecondCall().resolves();

      await authController.changePassword(req, res);

      expect(res.json.calledWith({ message: 'Password updated' })).to.be.true;
    });

    it('should require both current and new password fields', async () => {
      req.user = { id: 1 };
      req.body = { current_password: 'password123' };

      await authController.changePassword(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({ error: 'Both fields required' })).to.be.true;
    });
  });

  describe('Password Reset Token Generation', () => {
    it('should generate secure random token', async function() {
      this.timeout(5000); // Increase timeout for this test
      req.body = { email: 'test@example.com' };
      
      poolStub.onFirstCall().resolves({ rows: [{ id: 1, name: 'Test User' }] });
      poolStub.onSecondCall().resolves();

      const randomBytesSpy = sinon.spy(crypto, 'randomBytes');

      await authController.forgotPassword(req, res);

      expect(randomBytesSpy.calledWith(32)).to.be.true;
      
      randomBytesSpy.restore();
    });

    it('should set token expiry to 15 minutes', async function() {
      this.timeout(5000); // Increase timeout for this test
      req.body = { email: 'test@example.com' };
      
      poolStub.onFirstCall().resolves({ rows: [{ id: 1, name: 'Test User' }] });
      poolStub.onSecondCall().resolves();

      const beforeTime = Date.now();
      await authController.forgotPassword(req, res);
      const afterTime = Date.now();

      const insertCall = poolStub.secondCall.args[1];
      const expiryTime = insertCall[2].getTime();
      
      // Expiry should be approximately 15 minutes from now
      const expectedExpiry = beforeTime + (15 * 60 * 1000);
      expect(expiryTime).to.be.within(expectedExpiry - 1000, afterTime + (15 * 60 * 1000) + 1000);
    });

    it('should not reveal if email does not exist', async () => {
      req.body = { email: 'nonexistent@example.com' };
      
      poolStub.resolves({ rows: [] }); // User not found

      await authController.forgotPassword(req, res);

      expect(res.json.calledWith({ message: 'If email exists, a reset link has been sent' })).to.be.true;
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during registration', async () => {
      req.body = { name: 'Test User', email: 'test@example.com', password: 'password123' };
      
      poolStub.rejects(new Error('Database connection failed'));

      await authController.register(req, res);

      expect(res.status.calledWith(500)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('error');
    });

    it('should handle database errors during login', async () => {
      req.body = { email: 'test@example.com', password: 'password123' };
      
      poolStub.rejects(new Error('Database connection failed'));

      await authController.login(req, res);

      expect(res.status.calledWith(500)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('error');
    });

    it('should handle database errors during password change', async () => {
      req.user = { id: 1 };
      req.body = { current_password: 'password123', new_password: 'newpassword123' };
      
      poolStub.rejects(new Error('Database connection failed'));

      await authController.changePassword(req, res);

      expect(res.status.calledWith(500)).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('error');
    });
  });

  describe('Update User Profile', () => {
    beforeEach(() => {
      req.user = { id: 1, role: 'user' };
    });

    it('should validate name is required', async () => {
      req.body = { name: '', email: 'test@example.com' };

      await authController.updateUserProfile(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({ error: 'Name is required' })).to.be.true;
    });

    it('should validate name does not exceed 255 characters', async () => {
      req.body = { name: 'a'.repeat(256), email: 'test@example.com' };

      await authController.updateUserProfile(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({ error: 'Name must not exceed 255 characters' })).to.be.true;
    });

    it('should validate email format', async () => {
      req.body = { name: 'Test User', email: 'invalid-email' };

      await authController.updateUserProfile(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({ error: 'Valid email is required' })).to.be.true;
    });

    it('should validate phone format when provided', async () => {
      req.body = { name: 'Test User', email: 'test@example.com', phone: '123' };

      await authController.updateUserProfile(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({ error: 'Phone number must be 10 digits' })).to.be.true;
    });

    it('should trim whitespace from all text inputs', async () => {
      req.body = { name: '  Test User  ', email: '  test@example.com  ', phone: '  1234567890  ' };
      
      poolStub.onFirstCall().resolves({ rows: [] }); // No duplicate email
      poolStub.onSecondCall().resolves({ 
        rows: [{ id: 1, name: 'Test User', email: 'test@example.com', role: 'user', created_at: new Date() }] 
      });

      await authController.updateUserProfile(req, res);

      expect(poolStub.secondCall.args[1][0]).to.equal('Test User');
      expect(poolStub.secondCall.args[1][1]).to.equal('test@example.com');
    });

    it('should check for duplicate email addresses', async () => {
      req.body = { name: 'Test User', email: 'existing@example.com' };
      
      poolStub.resolves({ rows: [{ id: 2 }] }); // Email exists for another user

      await authController.updateUserProfile(req, res);

      expect(res.status.calledWith(409)).to.be.true;
      expect(res.json.calledWith({ error: 'Email already in use' })).to.be.true;
    });

    it('should allow user to keep their own email', async () => {
      req.body = { name: 'Test User', email: 'test@example.com' };
      
      poolStub.onFirstCall().resolves({ rows: [] }); // No other user has this email
      poolStub.onSecondCall().resolves({ 
        rows: [{ id: 1, name: 'Test User', email: 'test@example.com', role: 'user', created_at: new Date() }] 
      });

      await authController.updateUserProfile(req, res);

      expect(res.json.called).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message', 'Profile updated successfully');
    });

    it('should update user record in database', async () => {
      req.body = { name: 'Updated Name', email: 'updated@example.com' };
      
      poolStub.onFirstCall().resolves({ rows: [] }); // No duplicate email
      poolStub.onSecondCall().resolves({ 
        rows: [{ id: 1, name: 'Updated Name', email: 'updated@example.com', role: 'user', created_at: new Date() }] 
      });

      await authController.updateUserProfile(req, res);

      expect(poolStub.secondCall.args[0]).to.include('UPDATE users SET name = $1, email = $2 WHERE id = $3');
      expect(poolStub.secondCall.args[1]).to.deep.equal(['Updated Name', 'updated@example.com', 1]);
    });

    it('should return updated user data', async () => {
      req.body = { name: 'Test User', email: 'test@example.com' };
      
      const updatedUser = { id: 1, name: 'Test User', email: 'test@example.com', role: 'user', created_at: new Date() };
      poolStub.onFirstCall().resolves({ rows: [] }); // No duplicate email
      poolStub.onSecondCall().resolves({ rows: [updatedUser] });

      await authController.updateUserProfile(req, res);

      expect(res.json.firstCall.args[0]).to.have.property('user');
      expect(res.json.firstCall.args[0].user).to.deep.equal(updatedUser);
    });

    it('should update phone number for counselors', async () => {
      req.user = { id: 1, role: 'counselor' };
      req.body = { name: 'Counselor Name', email: 'counselor@example.com', phone: '1234567890' };
      
      poolStub.onFirstCall().resolves({ rows: [] }); // No duplicate email
      poolStub.onSecondCall().resolves({ 
        rows: [{ id: 1, name: 'Counselor Name', email: 'counselor@example.com', role: 'counselor', created_at: new Date() }] 
      });
      poolStub.onThirdCall().resolves(); // UPDATE counselors phone

      await authController.updateUserProfile(req, res);

      expect(poolStub.thirdCall.args[0]).to.include('UPDATE counselors SET phone_number = $1 WHERE user_id = $2');
      expect(poolStub.thirdCall.args[1]).to.deep.equal(['1234567890', 1]);
    });

    it('should not update phone for non-counselors', async () => {
      req.user = { id: 1, role: 'user' };
      req.body = { name: 'User Name', email: 'user@example.com', phone: '1234567890' };
      
      poolStub.onFirstCall().resolves({ rows: [] }); // No duplicate email
      poolStub.onSecondCall().resolves({ 
        rows: [{ id: 1, name: 'User Name', email: 'user@example.com', role: 'user', created_at: new Date() }] 
      });

      await authController.updateUserProfile(req, res);

      // Should only have 2 calls (email check and user update), no phone update
      expect(poolStub.callCount).to.equal(2);
    });

    it('should handle user not found', async () => {
      req.body = { name: 'Test User', email: 'test@example.com' };
      
      poolStub.onFirstCall().resolves({ rows: [] }); // No duplicate email
      poolStub.onSecondCall().resolves({ rows: [] }); // User not found

      await authController.updateUserProfile(req, res);

      expect(res.status.calledWith(404)).to.be.true;
      expect(res.json.calledWith({ error: 'User not found' })).to.be.true;
    });

    it('should handle database errors', async () => {
      req.body = { name: 'Test User', email: 'test@example.com' };
      
      poolStub.rejects(new Error('Database connection failed'));

      await authController.updateUserProfile(req, res);

      expect(res.status.calledWith(500)).to.be.true;
      expect(res.json.calledWith({ error: 'Failed to update profile. Please try again.' })).to.be.true;
    });
  });
});
