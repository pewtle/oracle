import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { photosApi } from '@/api/client';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function formatClock(d: Date) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function ScreensaverPage() {
  const navigate = useNavigate();
  const now = useClock();

  const [photos, setPhotos] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  // Load photo list once
  useEffect(() => {
    photosApi.list().then((names) => {
      if (names.length > 0) setPhotos(names);
    }).catch(() => {});
  }, []);

  // Cycle through photos every 8 seconds with crossfade
  useEffect(() => {
    if (photos.length < 2) return;
    const t = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setCurrentIdx((i) => (i + 1) % photos.length);
        setFadeIn(true);
      }, 600);
    }, 8000);
    return () => clearInterval(t);
  }, [photos]);

  const exit = useCallback(() => navigate('/'), [navigate]);

  // Tap/click/keydown exits
  useEffect(() => {
    const handle = (e: Event) => {
      e.preventDefault();
      exit();
    };
    window.addEventListener('click', handle);
    window.addEventListener('touchstart', handle);
    window.addEventListener('keydown', handle);
    return () => {
      window.removeEventListener('click', handle);
      window.removeEventListener('touchstart', handle);
      window.removeEventListener('keydown', handle);
    };
  }, [exit]);

  const currentPhoto = photos.length > 0 ? photosApi.url(photos[currentIdx]) : null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden select-none cursor-none"
      style={{ backgroundColor: '#000' }}
    >
      {/* Photo background */}
      {currentPhoto ? (
        <img
          key={currentPhoto}
          src={currentPhoto}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-600"
          style={{ opacity: fadeIn ? 1 : 0 }}
          draggable={false}
        />
      ) : (
        // No photos — show a gradient background
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-800" />
      )}

      {/* Overlay gradient so text is legible */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

      {/* Clock */}
      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-2">
        <p className="text-white/90 font-light tracking-widest text-lg uppercase">
          {formatDate(now)}
        </p>
        <p
          className="text-white font-thin tabular-nums"
          style={{ fontSize: 'clamp(5rem, 18vw, 14rem)', lineHeight: 1 }}
        >
          {formatClock(now)}
        </p>
        <p className="text-white/50 text-sm mt-4">Tap anywhere to return</p>
      </div>

      {/* Photo counter dots */}
      {photos.length > 1 && (
        <div className="absolute top-6 left-0 right-0 flex justify-center gap-1.5">
          {photos.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === currentIdx ? 'bg-white/80 w-3' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
