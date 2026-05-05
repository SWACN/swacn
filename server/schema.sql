-- schema.sql

-- 1. Enterprises table for seat management (Admins)
CREATE TABLE enterprises (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    pro_seats_total INT DEFAULT 0,
    pro_seats_used INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Enterprise domains for auto-provisioning
CREATE TABLE enterprise_domains (
    id SERIAL PRIMARY KEY,
    enterprise_id INT REFERENCES enterprises(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL, -- e.g., 'google.com'
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
    is_pro BOOLEAN DEFAULT FALSE,         -- can import projects, can make Super Projects
    
    -- Enterprise Relation
    enterprise_id INT REFERENCES enterprises(id) ON DELETE SET NULL,
    enterprise_email VARCHAR(255) UNIQUE, -- Tracks the exact email used to claim the seat

    -- Dodo Payments
    dodo_customer_id VARCHAR(255),
    dodo_subscription_id VARCHAR(255),
    
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
    
    -- VM and File System state
    manifest_url TEXT NOT NULL,
    baseline_url TEXT,
    
    -- Theme and Display settings
    theme VARCHAR(255) DEFAULT 'swacn-dark',
    show_keystrokes BOOLEAN DEFAULT TRUE,
    allow_fs_download BOOLEAN DEFAULT TRUE,
    embed_theme VARCHAR(255) DEFAULT 'dark',
    is_public BOOLEAN DEFAULT TRUE,
    
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
    recording_url TEXT,
    deleted_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);