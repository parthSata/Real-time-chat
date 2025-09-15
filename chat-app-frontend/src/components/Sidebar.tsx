import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Users, Settings, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const sidebarVariants = {
  open: { x: 0 },
  closed: { x: '-100%' },
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const sidebarLinks = [
    { to: '/dashboard', icon: <MessageSquare size={20} />, label: 'Chats' },
    { to: '/contacts', icon: <Users size={20} />, label: 'Contacts' },
    { to: '/profile', icon: <User size={20} />, label: 'Profile' },
    { to: '/settings', icon: <Settings size={20} />, label: 'Settings' },
  ];

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <motion.div
        variants={sidebarVariants}
        initial="closed"
        animate={isOpen ? 'open' : 'closed'}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-900 shadow-lg z-50 flex flex-col"
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-3">
          <img
            src={user?.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`}
            alt="Profile"
            className="w-10 h-10 rounded-full"
          />
          <div>
            <h3 className="font-semibold text-blue-300">{user?.username || 'User'}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email || 'user@example.com'}</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {sidebarLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`sidebar-link flex hover:text-[#0ea5e9] items-center space-x-3 px-3 py-2 rounded-md text-sm ${location.pathname === link.to ? 'active' : ''
                }`}
            >
              <span className="">{link.icon}</span>
              <span className='text-'>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={logout}
            className="sidebar-link flex items-center space-x-3 px-3 py-2 rounded-md text-sm w-full text-red-500"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </motion.div>
    </>
  );
};

export default Sidebar;