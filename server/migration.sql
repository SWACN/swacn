-- migration.sql
-- This script drops existing tables and recreates them with the new schema

-- Drop existing tables (in reverse order of dependencies)
DROP TABLE IF EXISTS casts CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS enterprise_domains CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS enterprises CASCADE;

-- 1. Enterprises table for seat management (Admins)
CREATE TABLE enterprises (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    learner_seats_total INT DEFAULT 0,
    learner_seats_used INT DEFAULT 0,
    creator_seats_total INT DEFAULT 0,
    creator_seats_used INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Enterprise domains for auto-provisioning
CREATE TABLE enterprise_domains (
    id SERIAL PRIMARY KEY,
    enterprise_id INT REFERENCES enterprises(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL, -- e.g., 'google.com'
    assign_role VARCHAR(50) NOT NULL CHECK (assign_role IN ('learner', 'creator')),
    UNIQUE(enterprise_id, domain)
);

-- 3. Users table with Tiers
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    github_id VARCHAR(255) UNIQUE,
    google_id VARCHAR(255) UNIQUE,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    
    -- Roles and Tiers
    is_super_admin BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,       -- Can manage their Enterprise
    is_creator BOOLEAN DEFAULT FALSE,     -- Can make Super Projects
    is_learner BOOLEAN DEFAULT FALSE,     -- Gets 50GB quota, can import projects
    
    -- Enterprise Relation
    enterprise_id INT REFERENCES enterprises(id) ON DELETE SET NULL,
    
    -- Quotas (for Learners)
    internet_quota_bytes BIGINT DEFAULT 0, -- e.g., 53687091200 for 50GB
    quota_reset_date TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Projects table (Represents a workspace/VM and groups casts)
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    is_super_project BOOLEAN DEFAULT FALSE,
    
    -- For Learners importing projects
    forked_from_project_id INT REFERENCES projects(id) ON DELETE SET NULL,
    
    -- Saved state of the VM for this project
    vm_state_url TEXT,
    
    deleted_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Casts (asciinema recordings)
CREATE TABLE casts (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE, -- Links multiple casts to a project
    title VARCHAR(255), -- Replaced project_name
    manifest_url TEXT NOT NULL,
    baseline_url TEXT,
    recording_url TEXT,
    theme VARCHAR(255) DEFAULT 'swacn-dark',
    show_keystrokes BOOLEAN DEFAULT TRUE,
    allow_fs_download BOOLEAN DEFAULT TRUE,
    embed_theme VARCHAR(255) DEFAULT 'dark',
    deleted_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
