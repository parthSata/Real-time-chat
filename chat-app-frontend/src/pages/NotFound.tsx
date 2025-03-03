import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home } from 'lucide-react';
import AnimatedPage from '../components/AnimatedPage';
import Button from '../components/Button';

const NotFound: React.FC = () => {
  return (
    <AnimatedPage>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-9xl font-bold text-primary-500 mb-4"
          >
            404
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Page Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            The page you are looking for doesn't exist or has been moved.
          </p>
          <Link to="/dashboard">
            <Button className="inline-flex items-center">
              <Home size={18} className="mr-2" />
              Back to Home
            </Button>
          </Link>
        </motion.div>
      </div>
    </AnimatedPage>
  );
};

export default NotFound;