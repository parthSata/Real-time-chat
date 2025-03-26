import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import './index.css';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ChatRoom from './pages/ChatRoom';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';
import ErrorBoundary from './components/ErrorBoundary';

// Context
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/chat/:id" element={
              <ErrorBoundary>
                <ChatRoom />
              </ErrorBoundary>
            }
            />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </AnimatePresence>
      </Router>
    </AuthProvider>
  );
}

export default App;