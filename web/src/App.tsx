/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Layout
import { Layout } from './components/Layout';

// Pages
import { Home } from './pages/Home';
import { Lab } from './pages/Lab';
import { Guide } from './pages/Guide';
import { CLI } from './pages/CLI';
import { AuthCallback } from './pages/AuthCallback';
import { Dashboard } from './pages/Dashboard';

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
          <Route path="/guide" element={<Guide />} />
          <Route path="/cli" element={<CLI />} />
          {/* Fallback route */}
          <Route path="*" element={<Home />} />
        </Routes>
      </Layout>
    </Router>
  );
}