// src/pages/ChatRoomWrapper.tsx
import { useParams, useNavigate } from 'react-router-dom';
import ChatRoom from './ChatRoom';

const ChatRoomWrapper: React.FC = () => {
    const { id } = useParams<{ id: string }>(); // Extract chatId from URL
    const navigate = useNavigate();

    const handleClose = () => {
        navigate('/dashboard'); // Navigate back to dashboard
    };

    if (!id) {
        return <div className="h-screen flex items-center justify-center text-red-600">Invalid chat ID</div>;
    }

    return <ChatRoom chatId={id} onClose={handleClose} />;
};

export default ChatRoomWrapper;