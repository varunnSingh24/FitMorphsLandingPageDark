import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const navItems = [
  { to: '/', label: 'Dashboard', icon: HomeIcon, exact: true },
  { to: '/leads', label: 'Leads', icon: UsersIcon },
  { to: '/clients', label: 'Clients', icon: ClientsIcon },
  { to: '/follow-ups', label: 'Follow-Ups', icon: CalendarIcon },
  { to: '/reports', label: 'Reports', icon: ChartIcon, roles: ['admin', 'manager'] },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, roles: ['admin'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Notification bell state
  const [reminders, setReminders] = useState([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [bellLoading, setBellLoading] = useState(false);
  const bellRef = useRef(null);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Close bell dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch reminders
  const fetchReminders = useCallback(async () => {
    try {
      const res = await api.get('/reminders');
      setReminders(res.data.reminders || []);
      setOverdueCount(res.data.overdueCount || 0);
    } catch {
      // silently fail — reminders are not critical
    }
  }, []);

  // Poll reminders every 60s
  useEffect(() => {
    fetchReminders();
    const interval = setInterval(fetchReminders, 60000);
    return () => clearInterval(interval);
  }, [fetchReminders]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleDone = async (id) => {
    try {
      await api.put(`/reminders/${id}/done`);
      fetchReminders();
    } catch {}
  };

  const handleSnooze = async (id, duration) => {
    try {
      await api.put(`/reminders/${id}/snooze`, { duration });
      fetchReminders();
    } catch {}
  };

  const SidebarContent = ({ mobile = false }) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700">
        <img src="/logo.png" alt="FitMorphs Logo" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
        {(mobile || sidebarOpen) && (
          <div>
            <div className="text-white font-bold text-base leading-tight">FitMorphs</div>
            <div className="text-slate-400 text-xs">CRM</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {navItems.map(item => {
          if (item.roles && !item.roles.includes(user?.role)) return null;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-sky-500 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {(mobile || sidebarOpen) && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-slate-700 p-3">
        {(mobile || sidebarOpen) ? (
          <div className="flex items-center gap-2">
            <Link to="/profile" className="flex items-center gap-2 flex-1 min-w-0 group">
              <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 group-hover:bg-sky-400 transition-colors">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate group-hover:text-sky-300 transition-colors">{user?.name}</div>
                <div className="text-slate-400 text-xs capitalize">{user?.role?.replace('_', ' ')}</div>
              </div>
            </Link>
            <button onClick={handleLogout} className="text-slate-400 hover:text-white p-1 rounded" title="Logout">
              <LogoutIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Link to="/profile" className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-bold hover:bg-sky-400 transition-colors" title={user?.name}>
              {user?.name?.[0]?.toUpperCase()}
            </Link>
            <button onClick={handleLogout} className="w-full flex justify-center text-slate-400 hover:text-white p-1 rounded" title="Logout">
              <LogoutIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-sidebar flex flex-col transition-transform duration-200
        md:hidden
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <SidebarContent mobile={true} />
      </aside>

      {/* Desktop sidebar */}
      <aside className={`hidden md:flex ${sidebarOpen ? 'w-56' : 'w-14'} bg-sidebar flex-col flex-shrink-0 transition-all duration-200`}>
        <SidebarContent mobile={false} />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
          {/* Menu button - hamburger on mobile, collapse on desktop */}
          <button
            onClick={() => { setSidebarOpen(v => !v); setMobileOpen(v => !v); }}
            className="text-gray-500 hover:text-gray-700 p-1 rounded"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Notification Bell */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => { setBellOpen(v => !v); if (!bellOpen) fetchReminders(); }}
                className="relative text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                title="Reminders"
              >
                <BellIcon className="w-5 h-5" />
                {overdueCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {overdueCount > 9 ? '9+' : overdueCount}
                  </span>
                )}
                {overdueCount === 0 && reminders.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-sky-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {reminders.length > 9 ? '9+' : reminders.length}
                  </span>
                )}
              </button>

              {/* Bell Dropdown */}
              {bellOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-[70vh] overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 text-sm">Reminders</h3>
                    {overdueCount > 0 && (
                      <span className="badge bg-red-100 text-red-700 text-xs">{overdueCount} overdue</span>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {reminders.length === 0 ? (
                      <div className="p-6 text-center">
                        <div className="text-3xl mb-2">🔔</div>
                        <p className="text-sm text-gray-400">No pending reminders</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {reminders.map(r => {
                          const isOverdue = parseUTCDate(r.due_at) <= new Date();
                          return (
                            <div key={r.id} className={`p-3 hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50/50' : ''}`}>
                              <div className="flex items-start gap-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
                                  r.reminder_type === 'checkin' ? 'bg-green-100 text-green-600' :
                                  r.reminder_type === 'lead_followup' ? 'bg-sky-100 text-sky-600' :
                                  'bg-purple-100 text-purple-600'
                                }`}>
                                  {r.reminder_type === 'checkin' ? '📋' : r.reminder_type === 'lead_followup' ? '📞' : '🔔'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                                  {r.ref_name && (
                                    <p className="text-xs text-gray-500">
                                      {r.ref_name}
                                      {r.ref_phone && <span className="text-gray-400 ml-1 font-mono">({r.ref_phone})</span>}
                                    </p>
                                  )}
                                  {r.message && <p className="text-xs text-gray-400 mt-0.5 truncate">{r.message}</p>}
                                  <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                                    {isOverdue ? 'Overdue — ' : ''}{formatReminderTime(r.due_at)}
                                  </p>
                                </div>
                              </div>
                              {/* Action buttons */}
                              <div className="flex items-center gap-1.5 mt-2 ml-10">
                                <button
                                  onClick={() => handleDone(r.id)}
                                  className="text-xs px-2.5 py-1 rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition-colors font-medium"
                                >
                                  Done
                                </button>
                                <button
                                  onClick={() => handleSnooze(r.id, '1h')}
                                  className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                >
                                  1h
                                </button>
                                <button
                                  onClick={() => handleSnooze(r.id, '3h')}
                                  className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                >
                                  3h
                                </button>
                                <button
                                  onClick={() => handleSnooze(r.id, 'tomorrow')}
                                  className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                >
                                  Tomorrow
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <NavLink to="/leads/add" className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3">
              <PlusIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Lead</span>
              <span className="sm:hidden">Add</span>
            </NavLink>
            <span className="text-gray-500 text-xs hidden sm:block">
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Parse DB UTC timestamp correctly
function parseUTCDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr.includes('Z') || dateStr.includes('+')) return new Date(dateStr);
  if (dateStr.length === 10) return new Date(dateStr + 'T00:00:00+05:30');
  return new Date(dateStr.replace(' ', 'T') + 'Z');
}

function formatReminderTime(dateStr) {
  if (!dateStr) return '';
  const d = parseUTCDate(dateStr);
  if (!d || isNaN(d)) return '';
  const now = new Date();
  const diffMs = d - now;
  const diffMin = Math.abs(Math.floor(diffMs / 60000));

  if (diffMs < 0) {
    // Overdue
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
    return `${Math.floor(diffMin / 1440)}d ago`;
  }
  // Upcoming
  if (diffMin < 60) return `in ${diffMin}m`;
  if (diffMin < 1440) return `in ${Math.floor(diffMin / 60)}h`;
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function HomeIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
}
function UsersIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function ClientsIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
}
function CalendarIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}
function ChartIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
}
function SettingsIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function LogoutIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
}
function MenuIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>;
}
function PlusIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
}
function BellIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
}
