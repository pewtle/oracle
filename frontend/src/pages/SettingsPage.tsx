import ProfilesPanel from '@/components/Profiles/ProfilesPanel';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-5">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Manage family profiles, Google Calendar connections, and app preferences.
        </p>
      </div>

      {/* Family Members section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Family Members</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Add and manage family members. Each member gets a colour and emoji avatar.
          </p>
        </div>
        <ProfilesPanel />
      </div>

      {/* Google Calendar section (placeholder retained) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Google Calendar</h2>
        <p className="text-sm text-slate-500">
          Connect a Google account to sync events automatically.
        </p>
        <button
          disabled
          className="mt-4 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg opacity-50 cursor-not-allowed"
        >
          Connect Google (coming soon)
        </button>
      </div>
    </div>
  );
}
