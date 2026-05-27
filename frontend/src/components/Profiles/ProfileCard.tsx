import type { Profile } from '@/types';

interface ProfileCardProps {
  profile: Profile;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ProfileCard({ profile, onEdit, onDelete }: ProfileCardProps) {
  function handleDelete() {
    if (window.confirm(`Remove ${profile.name} from family? This cannot be undone.`)) {
      onDelete();
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col items-center gap-3">
      {/* Avatar circle */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-3xl flex-shrink-0 shadow-inner"
        style={{ backgroundColor: profile.colour }}
      >
        {profile.avatar_emoji}
      </div>

      {/* Name */}
      <p className="text-base font-semibold text-slate-800 text-center">{profile.name}</p>

      {/* Actions */}
      <div className="flex gap-2 mt-1">
        <button
          onClick={onEdit}
          className="border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-gray-50 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          className="bg-red-500 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-red-600 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
