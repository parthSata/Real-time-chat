import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Search, Plus, UserMinus } from 'lucide-react';
import Button from './Button';
import Input from './Input';

const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface User {
    _id: string;
    username: string;
    profilePic?: string;
    isOnline?: boolean;
}

interface CreateGroupDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateGroup: (name: string, members: string[]) => void;
}

const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({ isOpen, onClose, onCreateGroup }) => {
    const [groupName, setGroupName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set()); // Store usernames
    const [users, setUsers] = useState<User[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const fetchUsers = async () => {
            try {
                setLoading(true);
                const response = await fetch(`${VITE_API_BASE_URL}/api/v1/users/all`, {
                    credentials: 'include',
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                // Check if data.data is an array
                if (data.success && Array.isArray(data.message)) {
                    setUsers(data.message);
                } else {
                    throw new Error('Invalid data format from API: expected an array');
                }
            } catch (err: any) {
                console.warn('Fetch failed, falling back to mock data:', err.message);
                setError('Failed to fetch users');
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [isOpen]);

    const filteredUsers = users.filter((user) =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleMember = (username: string) => {
        const newSelected = new Set(selectedMembers);
        if (newSelected.has(username)) {
            newSelected.delete(username);
        } else {
            newSelected.add(username);
        }
        setSelectedMembers(newSelected);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!groupName.trim()) {
            setError('Group name is required');
            return;
        }

        if (selectedMembers.size < 2) {
            setError('Please select at least 2 members');
            return;
        }

        onCreateGroup(groupName, Array.from(selectedMembers));
        setGroupName('');
        setSelectedMembers(new Set());
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 backdrop-blur-md bg-opacity-50 flex items-center justify-center z-50 p-4"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
                    >
                        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                            <div className="flex items-center space-x-2">
                                <Users size={24} className="text-[#0284c7]" />
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Group</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                                    {error}
                                </div>
                            )}

                            <Input
                                label="Group Name"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                placeholder="Enter group name"
                                fullWidth
                            />

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Add Members
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                    <Input
                                        type="text"
                                        placeholder="Search users..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                        fullWidth
                                    />
                                </div>
                            </div>

                            {loading ? (
                                <div className="text-center text-gray-500">Loading users...</div>
                            ) : (
                                <div className="max-h-60 overflow-y-auto space-y-2">
                                    {filteredUsers.length === 0 && !error ? (
                                        <div className="text-center text-gray-500">No users found</div>
                                    ) : (
                                        filteredUsers.map((user) => (
                                            <motion.div
                                                key={user._id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`flex items-center justify-between p-2 rounded-lg ${selectedMembers.has(user.username)
                                                    ? 'bg-[#0284c7]/10 dark:bg-[#0284c7]/20'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <img
                                                        src={user.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                                                        alt={user.username}
                                                        className="w-10 h-10 rounded-full"
                                                    />
                                                    <span className="font-medium text-gray-900 dark:text-white">{user.username}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleMember(user.username)}
                                                    className={`p-2 rounded-full ${selectedMembers.has(user.username)
                                                        ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                        : 'text-[#0284c7] hover:bg-[#0284c7]/10 dark:hover:bg-[#0284c7]/20'
                                                        }`}
                                                >
                                                    {selectedMembers.has(user.username) ? <UserMinus size={20} /> : <Plus size={20} />}
                                                </button>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end space-x-2 pt-4">
                                <Button variant="outline" onClick={onClose} type="button">
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={selectedMembers.size < 2 || !groupName.trim() || loading}>
                                    Create Group
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default CreateGroupDialog;