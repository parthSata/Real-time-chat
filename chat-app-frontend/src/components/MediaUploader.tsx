import { X } from 'lucide-react';
import React from 'react';

interface MediaUploaderProps {
    onFileSelect: (files: File[]) => void;
    onRemove: (index: number) => void;
    selectedFiles: File[];
}

const MediaUploader: React.FC<MediaUploaderProps> = ({ onFileSelect, onRemove, selectedFiles }) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            onFileSelect(Array.from(e.target.files));
        }
    };

    return (
        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <input type="file" multiple onChange={handleFileChange} className="mb-2" />
            <div className="flex flex-wrap gap-2">
                {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center space-x-2">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{file.name}</span>
                        <button onClick={() => onRemove(index)} className="text-red-500 hover:text-red-700">
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MediaUploader;