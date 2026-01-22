// Simple Audio Manager for startup and theme music
// Plays startup.wav on each load, and theme.wav loops during gameplay

(function () {
  let startupAudio = null;
  let themeAudio = null;
  let playingStartup = false;
  let startupStarted = false;
  let themeRequested = false;
  let themeStarted = false;

  const SFX_SOURCES = {
    enemydeath: 'sfx/enemydeath.wav',
    rangedenemydeath: 'sfx/rangedenemydeath.wav',
    playerdeath: 'sfx/playerdeath.wav',
    blast: 'sfx/blast.wav',
    hurt: 'sfx/hurt.wav'
  };


  function ensureThemeAudio() {
    if (!themeAudio) {
      themeAudio = new Audio('music/theme.wav');
      themeAudio.loop = true;
      themeAudio.volume = 0.35; // comfortable default
    }
    return themeAudio;
  }

  function ensureStartupAudio() {
    if (!startupAudio) {
      startupAudio = new Audio('music/startup.wav');
      startupAudio.loop = false;
      startupAudio.volume = 0.7; // slightly louder intro
    }
    return startupAudio;
  }

  function tryStartThemeNow() {
    if (playingStartup) return; // wait until startup finishes
    if (themeStarted) return;
    const a = ensureThemeAudio();
    themeStarted = true;
    a.play().catch(() => {
      // Playback can fail if not in a user gesture; will retry on next gesture
      themeStarted = false;
    });
  }

  const AudioManager = {
    // Play startup now and resolve when finished
    playStartup() {
      return new Promise((resolve, reject) => {
        if (startupStarted || playingStartup) { resolve(false); return; }
        const a = ensureStartupAudio();
        startupStarted = true;
        playingStartup = true;
        a.onended = () => {
          playingStartup = false;
          if (themeRequested) {
            tryStartThemeNow();
          }
          resolve(true);
        };
        a.play().catch((err) => {
          // Should not happen when called from a user gesture
          playingStartup = false;
          startupStarted = false;
          reject(err);
        });
      });
    },

    // Request the theme to start looping (typically after game init)
    startThemeLoop() {
      themeRequested = true;
      if (!playingStartup) {
        // No startup playing; start theme now
        tryStartThemeNow();
      }
    },

    // Play a short sound effect by key (non-blocking)
    playSfx(key, volume = 1.0) {
      const src = SFX_SOURCES[key];
      if (!src) return;
      try {
        const a = new Audio(src);
        a.volume = Math.max(0, Math.min(1, volume));
        a.play();
      } catch (_) {}
    },

    // Optional: stop/pause theme (not required now, but handy)
    stopTheme() {
      if (themeAudio) {
        themeAudio.pause();
        themeAudio.currentTime = 0;
        themeStarted = false;
      }
    }
  };

  window.AudioManager = AudioManager;
  // No automatic playback; call playStartup() from a user gesture
})();
