-- Comfort Counsel Database Schema

-- Drop existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS counselor_payouts CASCADE;
DROP TABLE IF EXISTS wallet_transactions CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS password_resets CASCADE;
DROP TABLE IF EXISTS counselors CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users Table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'counselor', 'admin')),
  profile_picture TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Counselors Table
CREATE TABLE counselors (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  bio TEXT,
  phone_number VARCHAR(20) NOT NULL,
  location VARCHAR(255),
  years_experience INTEGER DEFAULT 0,
  profile_picture TEXT,
  subscription_tier VARCHAR(20) DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'standard', 'premium')),
  commission_rate NUMERIC(5,2) DEFAULT 20.00,
  verification_fee_paid BOOLEAN DEFAULT FALSE,
  verification_payment_reference VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_available BOOLEAN DEFAULT TRUE,
  session_duration INTEGER DEFAULT 45,
  rating NUMERIC(3,2) DEFAULT 0,
  price NUMERIC(10,2) DEFAULT 80,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Client Requests/Problems Table (when clients post their problems)
CREATE TABLE client_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  category VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  urgency VARCHAR(20) DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
  assigned_counselor_id INTEGER REFERENCES counselors(id) ON DELETE SET NULL,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sessions Table (actual counseling sessions after booking)
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  counselor_id INTEGER REFERENCES counselors(id) ON DELETE SET NULL,
  request_id INTEGER REFERENCES client_requests(id) ON DELETE SET NULL,
  caller_phone VARCHAR(20),
  counselor_phone VARCHAR(20),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  session_status VARCHAR(20) DEFAULT 'scheduled' CHECK (session_status IN ('scheduled', 'active', 'completed', 'cancelled')),
  session_amount NUMERIC(10,2),
  expires_at TIMESTAMP,
  call_started_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Payments Table
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  paystack_reference VARCHAR(255) UNIQUE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Wallets Table
CREATE TABLE wallets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  balance NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Wallet Transactions Table
CREATE TABLE wallet_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  type VARCHAR(20) CHECK (type IN ('credit', 'debit')),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Counselor Payouts Table
CREATE TABLE counselor_payouts (
  id SERIAL PRIMARY KEY,
  counselor_id INTEGER REFERENCES counselors(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  note TEXT,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Password Resets Table
CREATE TABLE password_resets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reset_token VARCHAR(255) NOT NULL,
  reset_token_expiry TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Verification Payments Table (for Standard and Premium tier payments)
CREATE TABLE verification_payments (
  id SERIAL PRIMARY KEY,
  counselor_id INTEGER REFERENCES counselors(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('standard', 'premium')),
  payment_reference VARCHAR(255) UNIQUE,
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'success', 'failed')),
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Platform Commission Tracking Table
CREATE TABLE platform_commissions (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  counselor_id INTEGER REFERENCES counselors(id) ON DELETE SET NULL,
  session_amount NUMERIC(10,2) NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(10,2) NOT NULL,
  counselor_earnings NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'paid_to_counselor')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- SAMPLE DATA
-- ========================================

-- Insert Admin User
INSERT INTO users (name, email, password, role) VALUES
('Admin User', 'admin@comfortcounsel.com', '$2a$10$YourHashedPasswordHere', 'admin');

-- Insert Sample Regular Users (Clients)
INSERT INTO users (name, email, password, role) VALUES
('John Mensah', 'john.mensah@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user'),
('Akua Asante', 'akua.asante@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user'),
('Kwame Osei', 'kwame.osei@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user'),
('Ama Boateng', 'ama.boateng@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user'),
('Kofi Adjei', 'kofi.adjei@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user');

-- Insert Counselor Users
INSERT INTO users (name, email, password, role) VALUES
('Dr. Sarah Owusu', 'sarah.owusu@comfortcounsel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'counselor'),
('Michael Appiah', 'michael.appiah@comfortcounsel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'counselor'),
('Grace Mensah', 'grace.mensah@comfortcounsel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'counselor'),
('Dr. Emmanuel Boateng', 'emmanuel.boateng@comfortcounsel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'counselor'),
('Abena Osei', 'abena.osei@comfortcounsel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'counselor'),
('Dr. Kwabena Asare', 'kwabena.asare@comfortcounsel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'counselor');

-- Insert Counselor Profiles (matching the user_ids from above)
-- Assuming user_ids start from 2 (after admin)
INSERT INTO counselors (user_id, category, bio, phone_number, location, years_experience, subscription_tier, commission_rate, verification_fee_paid, status, is_available) VALUES
(7, 'Relationship', 'Dr. Sarah Owusu is a licensed relationship counselor with over 12 years of experience helping couples and individuals navigate complex relationship dynamics. She specializes in communication strategies, conflict resolution, and building healthy partnerships. Her compassionate approach has helped hundreds of clients strengthen their relationships and find lasting happiness.', '0201234567', 'Accra, Ghana', 12, 'premium', 15.00, TRUE, 'approved', TRUE),

(8, 'Family', 'Michael Appiah is a dedicated family therapist who believes in the power of strong family bonds. With 8 years of experience, he works with families facing challenges such as parenting issues, sibling conflicts, and generational gaps. His warm and inclusive approach creates a safe space for all family members to express themselves and heal together.', '0202345678', 'Kumasi, Ghana', 8, 'standard', 15.00, TRUE, 'approved', TRUE),

(9, 'Career', 'Grace Mensah is a career development specialist who helps professionals navigate career transitions, workplace challenges, and professional growth. With 10 years of experience in corporate counseling, she provides practical strategies for career advancement, work-life balance, and professional fulfillment. Her clients appreciate her results-oriented approach.', '0203456789', 'Accra, Ghana', 10, 'premium', 15.00, TRUE, 'approved', TRUE),

(10, 'Youth', 'Dr. Emmanuel Boateng specializes in youth counseling and adolescent psychology. With 15 years of experience working with young people, he addresses issues such as academic pressure, identity formation, peer relationships, and mental health challenges. His engaging style and deep understanding of youth culture make him highly effective with teenagers and young adults.', '0204567890', 'Takoradi, Ghana', 15, 'basic', 20.00, FALSE, 'approved', TRUE),

(11, 'Business', 'Abena Osei is a business psychology consultant who helps entrepreneurs and business leaders manage stress, make strategic decisions, and build resilient organizations. With 7 years of experience in organizational psychology, she combines business acumen with psychological insights to help clients achieve sustainable success.', '0205678901', 'Accra, Ghana', 7, 'standard', 15.00, TRUE, 'approved', TRUE),

(12, 'Mental Wellness', 'Dr. Kwabena Asare is a clinical psychologist specializing in mental wellness, anxiety, depression, and stress management. With 20 years of experience, he uses evidence-based therapeutic approaches including CBT and mindfulness techniques. His calm demeanor and deep expertise provide clients with the tools they need to achieve lasting mental wellness.', '0206789012', 'Kumasi, Ghana', 20, 'premium', 15.00, TRUE, 'approved', TRUE);

-- Create wallets for all users
INSERT INTO wallets (user_id, balance) 
SELECT id, 0 FROM users;

-- Insert Sample Client Requests/Problems
INSERT INTO client_requests (user_id, category, title, description, urgency, status, assigned_counselor_id) VALUES
(2, 'Relationship', 'Struggling with communication in my marriage', 'My spouse and I have been having difficulty communicating effectively. We often misunderstand each other and arguments escalate quickly. I want to learn better communication strategies to improve our relationship.', 'high', 'assigned', 1),

(3, 'Career', 'Feeling stuck in my current job', 'I have been in the same position for 5 years and feel like I am not growing professionally. I am unsure whether to stay and try to advance or look for opportunities elsewhere. I need guidance on career planning.', 'normal', 'open', NULL),

(4, 'Youth', 'My teenager is becoming distant and rebellious', 'My 15-year-old son has been acting out lately - staying out late, poor grades, and refusing to talk to us. I am worried about him and do not know how to reconnect with him.', 'high', 'assigned', 4),

(5, 'Mental Wellness', 'Dealing with anxiety and stress', 'I have been experiencing constant worry and anxiety that is affecting my daily life. I have trouble sleeping and concentrating at work. I need help managing these feelings.', 'urgent', 'in_progress', 6),

(6, 'Family', 'Conflict between my mother and wife', 'There is ongoing tension between my mother and my wife which is putting me in a difficult position. Family gatherings are stressful and I feel torn between them. I need advice on how to handle this situation.', 'normal', 'open', NULL),

(2, 'Business', 'Stress from running my startup', 'I started my own business 2 years ago and the pressure is overwhelming. I am working 80+ hours a week and feeling burned out. I need help managing stress and finding balance.', 'high', 'open', NULL);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_counselors_user_id ON counselors(user_id);
CREATE INDEX idx_counselors_status ON counselors(status);
CREATE INDEX idx_counselors_category ON counselors(category);
CREATE INDEX idx_counselors_subscription_tier ON counselors(subscription_tier);
CREATE INDEX idx_client_requests_user_id ON client_requests(user_id);
CREATE INDEX idx_client_requests_category ON client_requests(category);
CREATE INDEX idx_client_requests_status ON client_requests(status);
CREATE INDEX idx_client_requests_counselor ON client_requests(assigned_counselor_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_counselor_id ON sessions(counselor_id);
CREATE INDEX idx_sessions_request_id ON sessions(request_id);
CREATE INDEX idx_sessions_status ON sessions(session_status);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_session_id ON payments(session_id);
CREATE INDEX idx_password_resets_token ON password_resets(reset_token);
CREATE INDEX idx_password_resets_expiry ON password_resets(reset_token_expiry);
CREATE INDEX idx_verification_payments_counselor ON verification_payments(counselor_id);
CREATE INDEX idx_verification_payments_status ON verification_payments(payment_status);
CREATE INDEX idx_platform_commissions_session ON platform_commissions(session_id);
CREATE INDEX idx_platform_commissions_counselor ON platform_commissions(counselor_id);
CREATE INDEX idx_platform_commissions_status ON platform_commissions(status);

-- ========================================
-- NOTES
-- ========================================
-- Default password for all sample users: "password123"
-- Password hash: $2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
-- 
-- SUBSCRIPTION TIERS:
-- - Basic (Free): 20% platform commission, no verification fee
-- - Standard (GHS 500): 15% platform commission, one-time verification fee
-- - Premium (GHS 700): 15% platform commission, one-time verification fee
--
-- COMMISSION CALCULATION:
-- When a session is completed and paid:
-- 1. Get counselor's commission_rate from counselors table
-- 2. Calculate: commission_amount = session_amount * (commission_rate / 100)
-- 3. Calculate: counselor_earnings = session_amount - commission_amount
-- 4. Insert record into platform_commissions table
-- 5. Credit counselor's wallet with counselor_earnings
-- 6. Platform keeps commission_amount
--
-- To reset the database, run this file against your PostgreSQL database:
-- psql -h your-host -U your-user -d your-database -f schema.sql
--
-- Or use the Neon SQL Editor to run this script
