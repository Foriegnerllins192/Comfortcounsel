-- Comfort Counsel Database Schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'counselor', 'admin')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS counselors (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  bio TEXT,
  phone_number VARCHAR(20) NOT NULL,
  location VARCHAR(255),
  years_experience INTEGER DEFAULT 0,
  profile_picture TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  counselor_id INTEGER REFERENCES counselors(id) ON DELETE SET NULL,
  caller_phone VARCHAR(20),
  counselor_phone VARCHAR(20),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  session_status VARCHAR(20) DEFAULT 'scheduled' CHECK (session_status IN ('scheduled', 'active', 'completed', 'cancelled')),
  expires_at TIMESTAMP,
  call_started_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  paystack_reference VARCHAR(255) UNIQUE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  balance NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  type VARCHAR(20) CHECK (type IN ('credit', 'debit')),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS counselor_payouts (
  id SERIAL PRIMARY KEY,
  counselor_id INTEGER REFERENCES counselors(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  note TEXT,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
