import { useState, useEffect } from 'react';
import { profilesApi } from '@/api/client';
import { useProfiles } from '@/contexts/ProfileContext';
import type { Profile } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PRESET_COLOURS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
  '#14B8A6', '#F59E0B', '#6366F1', '#84CC16',
];

const PRESET_EMOJIS = ['👤', '🧑', '👩', '👨', '🧒', '👦', '👧', '🐕', '🐈', '🐾', '⭐', '🌟'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ProfileFormProps {
  profile?: Profile;
  onClose: () => void;
}

export default function ProfileForm({ profile, onClose }: ProfileFormProps) {
  const { refetch } = useProfiles();
  const isEditing = !!profile;

  const [name, setName] = useState(profile?.name ?? '');
  const [colour, setColour] = useState(profile?.colour ?? PRESET_COLOURS[5]);
  const [avatarEmoji, setAvatarEmoji] = useState(profile?.avatar_emoji ?? '👤');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync fields when editing a different profile
  useEffect(() => {
    setName(profile?.name ?? '');
    setColour(profile?.colour ?? PRESET_COLOURS[5]);
    setAvatarEmoji(profile?.avatar_emoji ?? '👤');
  }, [profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = { name: name.trim(), colour, avatar_emoji: avatarEmoji };
      if (isEditing) {
        await profilesApi.update(profile.id, payload);
      } else {
        await profilesApi.create(payload);
      }
      await refetch();
      onClose();
    } catch (err) {
      console.error('Failed to save profile:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal panel */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            {isEditing ? 'Edit Profile' : 'Add Family Member'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Preview */}
          <div className="flex justify-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-inner"
              style={{ backgroundColor: colour }}
            >
              {avatarEmoji}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="profile-name">
              Name
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Colour picker */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Colour</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColour(c)}
                  className={`w-8 h-8 rounded-full transition-all focus:outline-none ${
                    colour === c
                      ? 'ring-2 ring-offset-2 ring-slate-600 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select colour ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Emoji picker */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Avatar</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatarEmoji(emoji)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all focus:outline-none ${
                    avatarEmoji === emoji
                      ? 'bg-primary-100 ring-2 ring-primary-400 scale-110'
                      : 'bg-gray-50 hover:bg-gray-100 hover:scale-105'
                  }`}
                  aria-label={`Select emoji ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-primary-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
