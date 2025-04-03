import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera } from 'lucide-react';
import Button from './Button';
import Input from './Input';
import { useAuth } from '../context/AuthContext';

interface ProfileDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const ProfileDialog: React.FC<ProfileDialogProps> = ({ isOpen, onClose }) => {
    const { user, updateProfile } = useAuth();
    const [formData, setFormData] = useState({
        username: user?.username || '',
        email: user?.email || '',
        password: '', // New password field (optional)
        status: user?.status || 'Hey there! I am using this chat app.',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [profilePic, setProfilePic] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState(user?.profilePic || '');
    const [error, setError] = useState('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setError('Profile picture must be less than 5MB');
                return;
            }
            setProfilePic(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const validateForm = () => {
        if (!formData.username.trim()) {
            setError('Username is required');
            return false;
        }
        if (!formData.email.trim()) {
            setError('Email is required');
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            setError('Invalid email format');
            return false;
        }
        if (formData.password && formData.password.length < 6) {
            setError('Password must be at least 6 characters if provided');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        try {
            const updateData: any = { ...formData };
            if (profilePic) {
                updateData.profilePic = profilePic;
            }
            // Remove password from updateData if it's empty
            if (!updateData.password) {
                delete updateData.password;
            }

            await updateProfile(updateData);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to update profile. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 backdrop-blur-md bg-opacity-30 flex items-center justify-center z-50 p-4"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
                    >
                        <div className="flex justify-between items-center p-4 border-b text-white">
                            <h2 className="text-xl font-semibold">Edit Profile</h2>
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

                            <div className="flex justify-center">
                                <div className="relative">
                                    <img
                                        src={previewUrl || 'https://via.placeholder.com/150'}
                                        alt="Profile"
                                        className="w-28 h-28 rounded-full text-white border object-cover"
                                    />
                                    <label className="absolute bottom-0 right-0 p-1 bg-primary-500 text-white rounded-full cursor-pointer">
                                        <Camera size={16} />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleProfilePicChange}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-white font-medium mb-1">Username</label>
                                <Input
                                    name="username"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    placeholder="Enter your username"
                                    required
                                    className="w-full rounded-md border border-gray-300 bg-white text-gray-600 placeholder:text-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 "
                                    fullWidth
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-white font-medium mb-1">Email</label>
                                <Input
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    placeholder="Enter your email"
                                    required
                                    className="w-full rounded-md border border-gray-300 bg-white text-gray-600 placeholder:text-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 "
                                    fullWidth
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-white font-medium mb-1">Password (optional)</label>
                                <Input
                                    name="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder="Enter new password"
                                    className="w-full rounded-md border border-gray-300 bg-white text-gray-600 placeholder:text-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 "
                                    fullWidth
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-white font-medium mb-1">Status</label>
                                <textarea
                                    name="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                    placeholder="Set your status message"
                                    className="w-full rounded-md border border-gray-300 bg-white text-gray-600 placeholder:text-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    rows={3}
                                    maxLength={100}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    {formData.status.length}/100 characters
                                </p>
                            </div>

                            <div className="flex justify-end space-x-2 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={onClose}
                                    type="button"
                                    className="text-white"
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" isLoading={isLoading}>
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ProfileDialog;