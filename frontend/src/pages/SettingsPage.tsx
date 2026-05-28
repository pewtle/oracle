import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import ProfilesPanel from '@/components/Profiles/ProfilesPanel';
import { useProfiles } from '@/contexts/ProfileContext';
import { googleCalendarApi } from '@/api/client';
import type { Profile } from '@/types';

// ---------------------------------------------------------------------------
// Per-profile Google Calendar status + connect/disconnect controls
// ---------------------------------------------------------------------------

interface GCalStatus {
  connected: boolean;
  calendar_id: string | null;
}

function GoogleProfileRow({ profile }: { profile: Profile }) {
  const [status, setStatus] = useState<GCalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await googleCalendarApi.getStatus(profile.id);
      setStatus(s);
    } catch {
      setStatus({ connected: false, calendar_id: null });
    } finally {
      setLoading(false);
    }
  }, [profile.id]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  async function handleConnect() {
    setError(null);
    try {
      const { auth_url } = await googleCalendarApi.getAuthUrl(profile.id);
      window.location.href = auth_url;
    } catch {
      setError('Google Calendar is not configured on the server. Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in backend/.env');
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const result = await googleCalendarApi.sync(profile.id);
      setSyncResult(`Synced ${result.synced_events} events from Google, pushed ${result.pushed_events} local events.`);
      setTimeout(() => setSyncResult(null), 5000);
    } catch {
      setError('Sync failed. Check the server logs for details.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      setTimeout(() => setConfirmDisconnect(false), 4000);
      return;
    }
    setDisconnecting(true);
    setError(null);
    try {
      await googleCalendarApi.disconnect(profile.id);
      setStatus({ connected: false, calendar_id: null });
      setConfirmDisconnect(false);
    } catch {
      setError('Failed to disconnect. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="flex items-start gap-4 py-4 border-b border-gray-100 last:border-0">
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
        style={{ backgroundColor: profile.colour }}
      >
        {profile.avatar_emoji}
      </div>

      {/* Info + controls */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800">{profile.name}</p>

        {loading ? (
          <p className="text-xs text-gray-400 mt-0.5">Checking status…</p>
        ) : status?.connected ? (
          <p className="text-xs text-green-600 mt-0.5">
            ✓ Connected{status.calendar_id ? ` — ${status.calendar_id}` : ''}
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-0.5">Not connected</p>
        )}

        {syncResult && (
          <p className="text-xs text-blue-600 mt-1">{syncResult}</p>
        )}
        {error && (
          <p className="text-xs text-red-600 mt-1">{error}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {!loading && status?.connected ? (
          <>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              {syncing ? 'Syncing…' : '↻ Sync now'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                confirmDisconnect
                  ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
                  : 'border-red-200 text-red-500 hover:bg-red-50'
              } disabled:opacity-50`}
            >
              {disconnecting ? 'Disconnecting…' : confirmDisconnect ? 'Confirm disconnect?' : 'Disconnect'}
            </button>
          </>
        ) : !loading ? (
          <button
            onClick={handleConnect}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-primary-400 hover:text-primary-700 text-gray-600 transition-colors font-medium"
          >
            <GoogleIcon />
            Connect
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { profiles } = useProfiles();

  // Read ?google_auth= from URL if redirected back from OAuth callback
  const location = useLocation();
  const [oauthBanner, setOauthBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const result = params.get('google_auth');
    if (!result) return;

    if (result === 'success') {
      setOauthBanner({ type: 'success', message: 'Google Calendar connected successfully!' });
    } else {
      const reason = params.get('reason') ?? 'unknown';
      const messages: Record<string, string> = {
        invalid_state: 'Invalid OAuth state — please try again.',
        profile_not_found: 'Profile not found — please try again.',
        not_configured: 'Google Calendar credentials are not configured in backend/.env.',
        token_exchange_failed: 'Failed to exchange auth code — please try again.',
      };
      setOauthBanner({ type: 'error', message: messages[reason] ?? 'Google Calendar connection failed.' });
    }

    // Clean up query params without triggering a navigation
    window.history.replaceState({}, '', location.pathname);
    setTimeout(() => setOauthBanner(null), 6000);
  }, [location.search, location.pathname]);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* OAuth result banner */}
      {oauthBanner && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium ${
          oauthBanner.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <span>{oauthBanner.type === 'success' ? '✓ ' : '✕ '}{oauthBanner.message}</span>
          <button onClick={() => setOauthBanner(null)} className="ml-4 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Page header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-5">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Manage family profiles, Google Calendar connections, and app preferences.
        </p>
      </div>

      {/* Family Members */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Family Members</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Add and manage family members. Each member gets a colour and emoji avatar.
          </p>
        </div>
        <ProfilesPanel />
      </div>

      {/* Google Calendar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-5">
        <div className="mb-2">
          <h2 className="text-lg font-semibold text-slate-800">Google Calendar</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Connect a Google account per family member to sync their calendar events automatically.
            Events sync every 10 minutes in the background.
          </p>
        </div>

        {profiles.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">Add a family member above first.</p>
        ) : (
          <div className="mt-4">
            {profiles.map(profile => (
              <GoogleProfileRow key={profile.id} profile={profile} />
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700 space-y-1">
          <p className="font-medium">Setup required before connecting</p>
          <p>You need a Google Cloud project with the Calendar API enabled and OAuth credentials configured in <code className="bg-amber-100 px-1 rounded">backend/.env</code>.</p>
          <p>The <strong>Authorised redirect URI</strong> in Google Cloud Console must be set to: <code className="bg-amber-100 px-1 rounded">{window.location.origin}/api/google-calendar/callback</code></p>
          <p>And <code className="bg-amber-100 px-1 rounded">APP_URL={window.location.origin}</code> must be set in <code className="bg-amber-100 px-1 rounded">backend/.env</code>.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Google "G" logo icon
// ---------------------------------------------------------------------------
function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
