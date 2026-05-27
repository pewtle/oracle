import { useState } from 'react';
import { profilesApi } from '@/api/client';
import { useProfiles } from '@/contexts/ProfileContext';
import type { Profile } from '@/types';
import ProfileCard from './ProfileCard';
import ProfileForm from './ProfileForm';

export default function ProfilesPanel() {
  const { profiles, loading, refetch } = useProfiles();
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | undefined>(undefined);

  function openCreateForm() {
    setEditingProfile(undefined);
    setShowForm(true);
  }

  function openEditForm(profile: Profile) {
    setEditingProfile(profile);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingProfile(undefined);
  }

  async function handleDelete(profile: Profile) {
    try {
      await profilesApi.remove(profile.id);
      await refetch();
    } catch (err) {
      console.error('Failed to delete profile:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Grid of cards */}
        {profiles.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onEdit={() => openEditForm(profile)}
                onDelete={() => handleDelete(profile)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-slate-400">
            <p className="text-3xl mb-2">👨‍👩‍👧‍👦</p>
            <p className="text-sm">No family members yet. Add one to get started.</p>
          </div>
        )}

        {/* Add button */}
        <div>
          <button
            onClick={openCreateForm}
            className="bg-primary-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            + Add Profile
          </button>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <ProfileForm
          profile={editingProfile}
          onClose={closeForm}
        />
      )}
    </>
  );
}
