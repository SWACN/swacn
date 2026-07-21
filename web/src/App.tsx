/**
 * @license
 * Copyright (c) 2026 SWACN. All rights reserved.
 * Proprietary and Confidential.
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Layout
import { Layout } from './components/Layout';

// Pages
import { Home } from './pages/Home';
import { Lab } from './pages/Lab';
import { Guide } from './pages/Guide';

import { AuthCallback } from './pages/AuthCallback';
import { Dashboard } from './pages/Dashboard';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth-callback" element={<AuthCallback />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/lab/:id" element={<Lab />} />
          <Route path="/lab" element={<Lab />} /> {/* Fallback for testing */}
          <Route path="/view/:id" element={<Lab />} />
          <Route path="/view" element={<Lab />} />
          <Route path="/guide" element={<Guide />} />

          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          {/* Fallback route */}

          <Route path="*" element={<Home />} />
        </Routes>
      </Layout>
    </Router>
  );
}