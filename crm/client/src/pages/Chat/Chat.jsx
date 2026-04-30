import React, { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

// ── Socket singleton ─────────────────────────────────────────────────────────
// In dev: Vite runs on :3000, server on :3001 → replace port.
// In prod: same origin (nginx should proxy /socket.io/ → :3001).
let socketInstance = null;
function getSocket() {
  if (!socketInstance) {
    const token = localStorage.getItem('crm_token');
    const isDev  = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const url    = isDev
      ? window.location.origin.replace(/:\d+$/, ':3001')
      : window.location.origin;          // prod: nginx proxies /socket.io/
    socketInstance = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
  }
  return socketInstance;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['bg-sky-500','bg-violet-500','bg-pink-500','bg-teal-500','bg-orange-500','bg-indigo-500'];
const avatarColor = (id) => AVATAR_COLORS[(id || 0) % AVATAR_COLORS.length];

function fmtTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T') + '+05:30');
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function fmtMsgTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T') + '+05:30');
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function groupMessagesByDate(messages) {
  const groups = [];
  let currentDate = null;
  messages.forEach(msg => {
    const d = new Date(msg.created_at.replace(' ', 'T') + '+05:30');
    const dateKey = d.toDateString();
    if (dateKey !== currentDate) {
      currentDate = dateKey;
      const now = new Date();
      const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
      let label;
      if (dateKey === now.toDateString()) label = 'Today';
      else if (dateKey === yesterday.toDateString()) label = 'Yesterday';
      else label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
      groups.push({ type: 'date', label });
    }
    groups.push({ type: 'message', ...msg });
  });
  return groups;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Chat() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [mobileShowRooms, setMobileShowRooms] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const socket = getSocket();

  // Load rooms
  const loadRooms = useCallback(async () => {
    try {
      const r = await api.get('/chat/rooms');
      setRooms(r.data.rooms);
    } catch {}
  }, []);

  useEffect(() => {
    loadRooms().finally(() => setLoading(false));
  }, [loadRooms]);

  // Socket.io events
  useEffect(() => {
    socket.on('new_message', (msg) => {
      if (activeRoom && msg.room_id === activeRoom.id) {
        // Dedupe: socket may re-broadcast a message we already added via REST fallback
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        // Mark as read
        socket.emit('mark_read', { room_id: msg.room_id });
        api.put(`/chat/rooms/${msg.room_id}/read`).catch(() => {});
      }
      // Update room list (last message preview)
      setRooms(prev => prev.map(r =>
        r.id === msg.room_id
          ? { ...r, last_message: msg.message, last_message_at: msg.created_at, last_sender_name: msg.sender_name,
              unread_count: (activeRoom?.id === msg.room_id) ? 0 : (r.unread_count || 0) + 1 }
          : r
      ).sort((a, b) => {
        const aTime = a.last_message_at || a.created_at;
        const bTime = b.last_message_at || b.created_at;
        return bTime.localeCompare(aTime);
      }));
    });

    return () => { socket.off('new_message'); };
  }, [socket, activeRoom]);

  // Open a room
  const openRoom = async (room) => {
    setActiveRoom(room);
    setMobileShowRooms(false);
    setMsgLoading(true);
    setMessages([]);
    setMembers([]);
    try {
      const r = await api.get(`/chat/rooms/${room.id}/messages`);
      setMessages(r.data.messages);
      setMembers(r.data.members);
      // Mark as read
      socket.emit('mark_read', { room_id: room.id });
      await api.put(`/chat/rooms/${room.id}/read`);
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, unread_count: 0 } : r));
    } catch {}
    finally { setMsgLoading(false); }
    inputRef.current?.focus();
  };

  // Send message — socket if connected, REST fallback otherwise
  const sendMessage = async (e) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || !activeRoom) return;
    setInput('');

    if (socket.connected) {
      socket.emit('send_message', { room_id: activeRoom.id, message: msg });
    } else {
      // REST fallback (works even without WebSocket proxy)
      try {
        const r = await api.post(`/chat/rooms/${activeRoom.id}/messages`, { message: msg });
        // Dedupe: if socket reconnects and echoes the same id, the new_message handler will skip it
        setMessages(prev => prev.some(m => m.id === r.data.message.id) ? prev : [...prev, r.data.message]);
        setRooms(prev => prev.map(room =>
          room.id === activeRoom.id
            ? { ...room, last_message: msg, last_message_at: r.data.message.created_at }
            : room
        ));
      } catch {
        setInput(msg); // restore on failure
      }
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const totalUnread = rooms.reduce((sum, r) => sum + (r.unread_count || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="h-[calc(100vh-5rem)] flex rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">

      {/* ── Room List (Left Panel) ── */}
      <div className={`w-full md:w-72 flex-shrink-0 border-r border-gray-100 flex flex-col bg-gray-50
        ${mobileShowRooms ? 'flex' : 'hidden md:flex'}`}>

        {/* Header */}
        <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-900">Team Chat</h2>
            {totalUnread > 0 && (
              <span className="bg-sky-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-7 h-7 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 flex items-center justify-center transition-colors"
            title="New group"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Room list */}
        <div className="flex-1 overflow-y-auto py-2">
          {rooms.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-8">No rooms yet</p>
          ) : (
            rooms.map(room => (
              <button
                key={room.id}
                onClick={() => openRoom(room)}
                className={`w-full px-3 py-2.5 flex items-start gap-3 hover:bg-gray-100 transition-colors text-left
                  ${activeRoom?.id === room.id ? 'bg-sky-50 hover:bg-sky-50' : ''}`}
              >
                {/* Room avatar */}
                <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-sm font-bold
                  ${room.type === 'general' ? 'bg-gradient-to-br from-sky-400 to-violet-500' : 'bg-gradient-to-br from-teal-400 to-green-500'}`}>
                  {room.type === 'general' ? '🌐' : room.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-sm font-medium truncate ${activeRoom?.id === room.id ? 'text-sky-700' : 'text-gray-900'}`}>
                      {room.name}
                    </span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtTime(room.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <p className="text-xs text-gray-400 truncate">
                      {room.last_message
                        ? <span><span className="font-medium">{room.last_sender_id === user.id ? 'You' : room.last_sender_name?.split(' ')[0]}: </span>{room.last_message}</span>
                        : <span className="italic">No messages yet</span>
                      }
                    </p>
                    {room.unread_count > 0 && (
                      <span className="flex-shrink-0 bg-sky-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {room.unread_count > 9 ? '9+' : room.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-300 mt-0.5">{room.member_count} members</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Message Panel (Right) ── */}
      <div className={`flex-1 flex flex-col min-w-0 ${!mobileShowRooms ? 'flex' : 'hidden md:flex'}`}>

        {activeRoom ? (
          <>
            {/* Room header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 bg-white flex-shrink-0">
              {/* Mobile back */}
              <button className="md:hidden text-gray-400 hover:text-gray-600 mr-1" onClick={() => setMobileShowRooms(true)}>
                <BackIcon className="w-5 h-5" />
              </button>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0
                ${activeRoom.type === 'general' ? 'bg-gradient-to-br from-sky-400 to-violet-500' : 'bg-gradient-to-br from-teal-400 to-green-500'}`}>
                {activeRoom.type === 'general' ? '🌐' : activeRoom.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 text-sm">{activeRoom.name}</h3>
                <p className="text-xs text-gray-400">{activeRoom.member_count} members</p>
              </div>
              <button
                onClick={() => setShowMembers(v => !v)}
                className={`p-1.5 rounded-lg transition-colors text-xs font-medium flex items-center gap-1
                  ${showMembers ? 'bg-sky-100 text-sky-700' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                <TeamIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 flex min-h-0">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 flex flex-col">
                {msgLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="text-4xl mb-2">💬</div>
                    <p className="text-gray-400 text-sm">No messages yet. Say hello!</p>
                  </div>
                ) : (
                  <>
                    {groupMessagesByDate(messages).map((item, idx) => {
                      if (item.type === 'date') {
                        return (
                          <div key={`date-${idx}`} className="flex items-center gap-3 my-3">
                            <div className="h-px flex-1 bg-gray-100" />
                            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full whitespace-nowrap">{item.label}</span>
                            <div className="h-px flex-1 bg-gray-100" />
                          </div>
                        );
                      }

                      const isMe = item.sender_id === user.id;
                      const prevItem = idx > 0 ? groupMessagesByDate(messages)[idx - 1] : null;
                      const sameAuthor = prevItem?.type === 'message' && prevItem.sender_id === item.sender_id;

                      return (
                        <div key={item.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${sameAuthor ? 'mt-0.5' : 'mt-3'}`}>
                          {/* Avatar */}
                          {!isMe && (
                            <div className={`w-7 h-7 rounded-full ${avatarColor(item.sender_id)} flex-shrink-0 flex items-center justify-center text-white text-xs font-bold
                              ${sameAuthor ? 'opacity-0' : ''}`}>
                              {item.sender_name?.[0]?.toUpperCase()}
                            </div>
                          )}

                          <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                            {!isMe && !sameAuthor && (
                              <span className="text-xs font-medium text-gray-500 mb-1 ml-1">{item.sender_name}</span>
                            )}
                            <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words
                              ${isMe
                                ? 'bg-sky-500 text-white rounded-br-sm'
                                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                              }`}>
                              {item.message}
                            </div>
                            <span className={`text-[10px] text-gray-300 mt-0.5 ${isMe ? 'mr-1' : 'ml-1'}`}>
                              {fmtMsgTime(item.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Members panel */}
              {showMembers && (
                <div className="w-48 border-l border-gray-100 bg-gray-50 flex flex-col flex-shrink-0">
                  <div className="px-3 py-2.5 border-b border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Members ({members.length})</h4>
                  </div>
                  <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
                    {members.map(m => (
                      <div key={m.id} className="px-3 py-1.5 flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full ${avatarColor(m.id)} flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold`}>
                          {m.name[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-gray-800 truncate">{m.id === user.id ? 'You' : m.name}</div>
                          <div className="text-[10px] text-gray-400 capitalize">{m.role.replace('_', ' ')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="px-4 py-3 border-t border-gray-100 bg-white flex items-center gap-2 flex-shrink-0">
              <input
                ref={inputRef}
                className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-300 transition-all placeholder-gray-400"
                placeholder={`Message ${activeRoom.name}...`}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
                autoFocus
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-9 h-9 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors flex-shrink-0"
              >
                <SendIcon className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="text-5xl mb-3">💬</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">FitMorphs Team Chat</h3>
            <p className="text-sm text-gray-400 max-w-xs">
              Select a room from the left to start chatting with your team.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-5 btn-primary text-sm flex items-center gap-1.5"
            >
              <PlusIcon className="w-4 h-4" /> Create Group
            </button>
          </div>
        )}
      </div>

      {/* ── Create Group Modal ── */}
      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(room) => {
            socket.emit('join_room', { room_id: room.id });
            loadRooms();
            openRoom({ ...room, member_count: 1, unread_count: 0 });
            setShowCreateModal(false);
          }}
          currentUserId={user.id}
        />
      )}
    </div>
  );
}

// ── Create Group Modal ───────────────────────────────────────────────────────
function CreateGroupModal({ onClose, onCreated, currentUserId }) {
  const [name, setName] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/users').then(r => {
      setUsers(r.data.users.filter(u => u.id !== currentUserId && u.is_active));
    }).catch(() => {});
  }, [currentUserId]);

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/chat/rooms', { name: name.trim(), member_ids: selected });
      onCreated(res.data.room);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create group');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Create Group</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
          <div className="p-5 space-y-4 flex-1 overflow-y-auto">
            <div>
              <label className="label">Group Name *</label>
              <input
                className="input"
                placeholder="e.g. Sales Team, Dietitians..."
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="label">Add Members</label>
              <div className="space-y-1.5 max-h-52 overflow-y-auto border border-gray-100 rounded-xl p-2">
                {users.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">No other users</p>
                ) : users.map(u => (
                  <label key={u.id} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors
                    ${selected.includes(u.id) ? 'bg-sky-50 border border-sky-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                    <input
                      type="checkbox"
                      className="rounded text-sky-500"
                      checked={selected.includes(u.id)}
                      onChange={() => toggle(u.id)}
                    />
                    <div className={`w-7 h-7 rounded-full ${avatarColor(u.id)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {u.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">{u.name}</div>
                      <div className="text-xs text-gray-400 capitalize">{u.role.replace('_', ' ')}</div>
                    </div>
                  </label>
                ))}
              </div>
              {selected.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">{selected.length} member{selected.length !== 1 ? 's' : ''} selected (+ you)</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
              {saving ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────
function PlusIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
}
function SendIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>;
}
function TeamIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function BackIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>;
}
