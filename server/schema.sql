-- schema.sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    github_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    api_key VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE casts (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    project_name VARCHAR(255),
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