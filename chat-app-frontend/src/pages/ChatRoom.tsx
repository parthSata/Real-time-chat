import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Paperclip, Mic, MoreVertical, Trash2, Smile, Video, VolumeX, Volume2, Minimize2, Maximize2 } from 'lucide-react';
import ChatMessage from '../components/ChatMessage';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';

const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface Participant {
  _id: string;
  username: string;
  isOnline: boolean;
  profilePic?: string;
}

interface Message {
  _id: string;
  message: string;
  sender: { _id: string; username: string; profilePic?: string };
  recipient?: { _id: string; username: string; profilePic?: string };
  chatId: string;
  timestamp: Date;
  delivered: boolean;
  isRead: boolean;
  messageType?: 'text' | 'image' | 'video';
}

interface Chat {
  _id: string;
  participants: Participant[];
  isGroupChat: boolean;
  chatName: string;
  createdBy: string;
}

interface ChatRoomProps {
  chatId: string;
  onClose: () => void;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ chatId, onClose }) => {
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [showOptionsMenu, setShowOptionsMenu] = useState<boolean>(false);
  const [showParticipantsDialog, setShowParticipantsDialog] = useState<boolean>(false);
  const [selectedMedia, setSelectedMedia] = useState<{ file: File; preview: string; type: 'image' | 'video' } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [isVideoCallActive, setIsVideoCallActive] = useState<boolean>(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // @ts-ignore
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isInitiator, setIsInitiator] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoMaximized, setIsVideoMaximized] = useState<boolean>(false);
  const [isVideoMinimized, setIsVideoMinimized] = useState<boolean>(false);
  const [videoPopupPosition, setVideoPopupPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const videoPopupRef = useRef<HTMLDivElement>(null);
  const { user, socket } = useAuth();

  // WebRTC configuration with STUN servers
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    if (!chatId) {
      setError('Invalid chat ID');
      onClose();
      return;
    }

    const loadChat = async () => {
      try {
        setLoading(true);
        const [chatResponse, messagesResponse] = await Promise.all([
          fetch(`${VITE_API_BASE_URL}/api/v1/chats/${chatId}`, { credentials: 'include' }),
          fetch(`${VITE_API_BASE_URL}/api/v1/chats/${chatId}/messages`, { credentials: 'include' }),
        ]);
        const chatData = await chatResponse.json();
        const messagesData = await messagesResponse.json();

        if (!chatData.success || !messagesData.success) throw new Error('Failed to load chat data');
        setChat(chatData.message);
        setMessages(messagesData.message.map((msg: Message) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          messageType: msg.messageType || 'text',
        })));
      } catch (err: any) {
        setError(err.message || 'Failed to load chat');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    loadChat();
  }, [chatId, onClose]);

  useEffect(() => {
    if (!socket || !chatId || !user || !chat) return;

    socket.emit('joinChat', chatId);

    socket.on('newMessage', ({ chatId: incomingChatId, message }: { chatId: string; message: Message }) => {
      if (incomingChatId === chatId) {
        setMessages((prev) =>
          prev.some((m) => m._id === message._id)
            ? prev
            : [...prev, { ...message, timestamp: new Date(message.timestamp), messageType: message.messageType || 'text' }]
        );
      }
    });

    socket.on('groupUpdated', (updatedChat: Chat) => {
      if (updatedChat._id === chatId) setChat(updatedChat);
    });

    socket.on('messagesDeleted', ({ chatId: deletedChatId, messageIds }: { chatId: string; messageIds: string[] }) => {
      if (deletedChatId === chatId) {
        setMessages((prev) => prev.filter((msg) => !messageIds.includes(msg._id)));
      }
    });

    socket.on('videoCallInitiated', (callData: { chatId: string; initiatorId: string; recipientId: string }) => {
      if (callData.chatId === chatId && callData.recipientId === user._id) {
        if (window.confirm(`${chat.participants.find(p => p._id === callData.initiatorId)?.username} is calling you. Accept?`)) {
          startVideoCall(false, callData.initiatorId);
          socket.emit('acceptVideoCall', { chatId });
        }
      }
    });

    socket.on('videoCallAccepted', ({ chatId: acceptedChatId }: { chatId: string }) => {
      if (acceptedChatId === chatId && isInitiator) {
        initiateWebRTCCall();
      }
    });

    socket.on('videoCallSignal', async ({ signal }: { signal: RTCSessionDescriptionInit | RTCIceCandidateInit }) => {
      if (!peerConnectionRef.current) return;

      try {
        if ('type' in signal) {
          // Handle offer or answer
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
          if (signal.type === 'offer' && !isInitiator) {
            // Create and send answer
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);
            const recipientId = chat.participants.find(p => p._id !== user._id)?._id;
            if (recipientId) {
              socket.emit('videoCallSignal', {
                chatId,
                signal: answer,
                to: recipientId,
                from: user._id,
              });
            }
          }
        } else {
          // Handle ICE candidate
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signal));
        }
      } catch (err: any) {
        setError('Failed to process signal: ' + err.message);
      }
    });

    socket.on('videoCallEnded', ({ chatId: endedChatId }: { chatId: string }) => {
      if (endedChatId === chatId) {
        endVideoCall();
      }
    });

    return () => {
      socket.off('newMessage');
      socket.off('groupUpdated');
      socket.off('messagesDeleted');
      socket.off('videoCallInitiated');
      socket.off('videoCallAccepted');
      socket.off('videoCallSignal');
      socket.off('videoCallEnded');
      socket.emit('leaveChat', chatId);
      endVideoCall();
    };
  }, [socket, chatId, user, chat, isInitiator]);

  useLayoutEffect(() => {
    if (!loading && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading, messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        optionsMenuRef.current &&
        !optionsMenuRef.current.contains(event.target as Node) &&
        moreButtonRef.current &&
        !moreButtonRef.current.contains(event.target as Node)
      ) {
        setShowOptionsMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Draggable video popup
  useEffect(() => {
    const videoPopup = videoPopupRef.current;
    if (!videoPopup || isVideoMaximized || isVideoMinimized) return;

    let isDragging = false;
    let currentX: number;
    let currentY: number;
    let initialX: number;
    let initialY: number;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      initialX = e.clientX - currentX;
      initialY = e.clientY - currentY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        setVideoPopupPosition({ x: currentX, y: currentY });
      }
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    currentX = videoPopupPosition.x;
    currentY = videoPopupPosition.y;

    videoPopup.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      videoPopup.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [videoPopupPosition, isVideoMaximized, isVideoMinimized]);

  const startVideoCall = async (initiator: boolean, recipientId?: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setIsVideoCallActive(true);
      setIsInitiator(initiator);

      // Initialize RTCPeerConnection
      const peerConnection = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = peerConnection;

      // Add local stream tracks
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        const [remote] = event.streams;
        setRemoteStream(remote);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && recipientId) {
          socket?.emit('videoCallSignal', {
            chatId,
            signal: event.candidate,
            to: recipientId,
            from: user?._id,
          });
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection.iceConnectionState === 'disconnected' || peerConnection.iceConnectionState === 'closed') {
          endVideoCall();
        }
      };

      if (initiator && recipientId) {
        const response = await fetch(`${VITE_API_BASE_URL}/api/v1/chats/${chatId}/initiate-video-call`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to initiate video call');
      }
    } catch (err: any) {
      setError('Failed to access camera/microphone: ' + err.message);
      setIsVideoCallActive(false);
    }
  };

  const initiateWebRTCCall = async () => {
    if (!peerConnectionRef.current || !localStream || !chat || !user) return;

    const recipientId = chat.participants.find(p => p._id !== user._id)?._id;
    if (!recipientId) return;

    try {
      // Create offer
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      socket?.emit('videoCallSignal', {
        chatId,
        signal: offer,
        to: recipientId,
        from: user._id,
      });
    } catch (err: any) {
      setError('WebRTC error: ' + err.message);
      endVideoCall();
    }
  };

  const toggleMute = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const endVideoCall = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsVideoCallActive(false);
    setIsInitiator(false);
    setIsMuted(false);
    setIsVideoMaximized(false);
    setIsVideoMinimized(false);
    setVideoPopupPosition({ x: 0, y: 0 });
    socket?.emit('endVideoCall', { chatId });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !chatId || !user || !chat) return;

    try {
      const response = await fetch(`${VITE_API_BASE_URL}/api/v1/chats/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chatId, content: message }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      setMessage('');
      formRef.current?.reset();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedMedia({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('image') ? 'image' : 'video',
    });

    const formData = new FormData();
    formData.append('media', file);

    try {
      const response = await fetch(`${VITE_API_BASE_URL}/api/v1/chats/${chatId}/upload-media`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to upload media');
      setSelectedMedia(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      const response = await fetch(`${VITE_API_BASE_URL}/api/v1/chats/remove-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chatId, userIdToRemove: userId }),
      });
      if (!response.ok) throw new Error('Failed to remove user');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleMessageSelection = (messageId: string) => {
    if (isSelectionMode) {
      const newSelected = new Set(selectedMessages);
      if (newSelected.has(messageId)) newSelected.delete(messageId);
      else newSelected.add(messageId);
      setSelectedMessages(newSelected);
    }
  };

  const handleDeleteSelectedMessages = async () => {
    try {
      const messageIds = Array.from(selectedMessages);
      const response = await fetch(`${VITE_API_BASE_URL}/api/v1/chats/${chatId}/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageIds }),
      });
      if (!response.ok) throw new Error('Failed to delete messages');
      setSelectedMessages(new Set());
      setIsSelectionMode(false);
    } catch (err: any) {
      setError('Failed to delete messages: ' + err.message);
    }
  };

  const renderMediaPreview = () => {
    if (!selectedMedia) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-20 left-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg z-50"
      >
        {selectedMedia.type === 'image' ? (
          <img src={selectedMedia.preview} alt="Preview" className="max-h-64 rounded" />
        ) : (
          <video src={selectedMedia.preview} controls className="max-h-64 rounded" />
        )}
        <Button
          onClick={() => setSelectedMedia(null)}
          variant="outline"
          size="sm"
          className="mt-2"
        >
          Cancel
        </Button>
      </motion.div>
    );
  };

  const renderMessageContent = (msg: Message) => {
    if (msg.messageType === 'image') {
      return (
        <img
          src={msg.message}
          alt="Chat image"
          className="max-w-xs rounded-lg cursor-pointer"
          onClick={() => window.open(msg.message, '_blank')}
        />
      );
    } else if (msg.messageType === 'video') {
      return (
        <video
          src={msg.message}
          controls
          className="max-w-xs rounded-lg"
        />
      );
    }
    return msg.message;
  };

  if (error) return <div className="h-screen flex items-center justify-center text-red-600">{error}</div>;
  if (!chat || !user) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  const displayName = chat.isGroupChat ? chat.chatName : chat.participants.find((p) => p._id !== user._id)?.username || 'Unknown';
  const recipientId = chat.participants.find((p) => p._id !== user._id)?._id;

  const profilePic = chat.isGroupChat
    ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.chatName}`
    : chat.participants.find((p) => p._id !== user._id)?.profilePic ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`;

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 relative">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-600">
              <ArrowLeft size={20} />
            </button>
            <div
              className="ml-3 flex items-center cursor-pointer"
              onClick={() => chat.isGroupChat && setShowParticipantsDialog(true)}
            >
              <img
                src={profilePic}
                alt={displayName}
                className="w-10 h-10 rounded-full"
              />
              <div className="ml-3">
                <h2 className="text-lg font-medium text-gray-800 dark:text-white">{displayName}</h2>
                {chat.isGroupChat ? (
                  <p className="text-xs text-gray-500">{chat.participants.length} members</p>
                ) : (
                  <div className="flex items-center">
                    <span
                      className={`h-2 w-2 rounded-full ${chat.participants.find((p) => p._id !== user._id)?.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}
                    ></span>
                    <span className="ml-1 text-xs text-gray-500">
                      {chat.participants.find((p) => p._id !== user._id)?.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {!chat.isGroupChat && !isSelectionMode && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => startVideoCall(true, recipientId)}
                className="p-2 text-gray-500 hover:text-gray-600"
                disabled={isVideoCallActive}
              >
                <Video size={20} />
              </motion.button>
            )}
            {isSelectionMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedMessages(new Set());
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDeleteSelectedMessages}
                  className="bg-red-500 hover:bg-red-600"
                  disabled={selectedMessages.size === 0}
                >
                  Delete ({selectedMessages.size})
                </Button>
              </>
            ) : (
              <>
                <div className="relative">
                  <motion.button
                    ref={moreButtonRef}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowOptionsMenu((prev) => !prev)}
                    className="p-2 text-gray-500 hover:text-gray-600"
                  >
                    <MoreVertical size={20} />
                  </motion.button>
                  <AnimatePresence>
                    {showOptionsMenu && (
                      <motion.div
                        ref={optionsMenuRef}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 z-50"
                      >
                        <div className="py-1">
                          <button
                            onClick={() => {
                              setIsSelectionMode(true);
                              setShowOptionsMenu(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                          >
                            <Trash2 size={16} className="mr-2 inline" /> Select and Delete
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto relative">
        <div className="max-w-3xl mx-auto">
          <AnimatePresence>
            {messages.map((msg) => (
              <div
                key={msg._id}
                onClick={() => toggleMessageSelection(msg._id)}
                className={`relative mb-2 ${isSelectionMode ? 'cursor-pointer' : ''}`}
              >
                {isSelectionMode && (
                  <div
                    className={`absolute -left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 rounded-full border-2 ${selectedMessages.has(msg._id) ? 'bg-[#0284c7] border-[#0284c7]' : 'border-gray-300'}`}
                  />
                )}
                <div className={`flex ${msg.sender._id === user._id ? 'justify-end' : 'justify-start'}`}>
                  <div className="w-full">
                    {chat.isGroupChat && msg.sender._id !== user._id && (
                      <p className="text-xs text-gray-500 mb-1">{msg.sender.username}</p>
                    )}
                    <ChatMessage
                      message={{
                        id: msg._id,
                        text: renderMessageContent(msg),
                        sender: msg.sender._id,
                        timestamp: msg.timestamp,
                        isMe: msg.sender._id === user._id,
                        delivered: msg.delivered,
                        isRead: msg.isRead,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
        {renderMediaPreview()}
      </main>

      <footer className="bg-white dark:bg-gray-800 border-t p-4 relative">
        <form ref={formRef} onSubmit={handleSendMessage} className="max-w-3xl mx-auto">
          <div className="flex items-center space-x-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-500"
            >
              <Paperclip size={20} />
            </motion.button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleMediaUpload}
              accept="image/*,video/*"
              className="hidden"
            />
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 text-gray-500"
            >
              <Smile size={20} />
            </motion.button>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none dark:text-white"
            />
            {message.trim() === '' ? (
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="button" className="p-2 text-gray-500">
                <Mic size={20} />
              </motion.button>
            ) : (
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="submit" className="p-2 bg-[#0284c7] text-white rounded-full">
                <Send size={20} />
              </motion.button>
            )}
          </div>
        </form>
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-16 left-4 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg z-50"
            >
              <div className="grid grid-cols-5 gap-2">
                {['😊', '😂', '👍', '❤️', '😢'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiSelect(emoji)}
                    className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </footer>

      {/* Video Call Pop-up */}
      <AnimatePresence>
        {isVideoCallActive && (
          <motion.div
            ref={videoPopupRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`fixed z-50 bg-gray-800 rounded-lg shadow-lg overflow-hidden
              ${isVideoMaximized ? 'top-0 left-0 w-full h-full' : isVideoMinimized ? 'bottom-4 right-4 w-48 h-48' : 'w-[600px] h-[400px]'}
              ${!isVideoMaximized && !isVideoMinimized ? 'cursor-move' : ''}`}
            style={!isVideoMaximized && !isVideoMinimized ? { top: videoPopupPosition.y, left: videoPopupPosition.x } : {}}
          >
            <div className="flex flex-col h-full">
              {/* Header for dragging and controls */}
              <div className="flex justify-between items-center p-2 bg-gray-900">
                <span className="text-white text-sm">Video Call with {displayName}</span>
                <div className="flex space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={toggleMute}
                    className="p-1 text-white hover:text-gray-300"
                  >
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      if (isVideoMaximized) {
                        setIsVideoMaximized(false);
                        setIsVideoMinimized(false);
                      } else if (isVideoMinimized) {
                        setIsVideoMinimized(false);
                        setIsVideoMaximized(false);
                      } else {
                        setIsVideoMaximized(true);
                        setIsVideoMinimized(false);
                      }
                    }}
                    className="p-1 text-white hover:text-gray-300"
                  >
                    {isVideoMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsVideoMinimized(!isVideoMinimized)}
                    className="p-1 text-white hover:text-gray-300"
                  >
                    <Minimize2 size={20} />
                  </motion.button>
                </div>
              </div>
              {/* Video streams */}
              <div className="flex-1 flex flex-col sm:flex-row gap-2 p-2 bg-gray-700">
                <div className="relative flex-1">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <span className="absolute bottom-2 left-2 text-white bg-black bg-opacity-50 px-2 py-1 rounded text-sm">
                    You
                  </span>
                </div>
                <div className="relative flex-1">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <span className="absolute bottom-2 left-2 text-white bg-black bg-opacity-50 px-2 py-1 rounded text-sm">
                    {displayName}
                  </span>
                </div>
              </div>
              {/* Control buttons */}
              <div className="p-2 bg-gray-900 flex justify-center">
                <Button
                  onClick={endVideoCall}
                  variant="primary"
                  size="sm"
                  className="bg-red-500 hover:bg-red-600"
                >
                  End Call
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showParticipantsDialog && chat.isGroupChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 backdrop-blur-md bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Group Members</h3>
                <button onClick={() => setShowParticipantsDialog(false)} className="p-2 text-gray-500 hover:text-gray-600">
                  <ArrowLeft size={20} />
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {chat.participants.map((p) => (
                  <div key={p._id} className="flex justify-between items-center">
                    <span className="text-gray-900 dark:text-white">{p.username}</span>
                    {chat.createdBy === user._id && p._id !== user._id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveUser(p._id)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatRoom;