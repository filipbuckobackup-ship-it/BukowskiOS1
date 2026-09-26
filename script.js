/* ==========================================================
   BukowskiOS — desktop logic
   No frameworks, no build step. Open index.html and go.
   ========================================================== */

(function () {
  'use strict';

  // ---------- Element refs ----------
  const desktop = document.getElementById('desktop');
  const iconsLayer = document.getElementById('desktopIcons');
  const windowsLayer = document.getElementById('windowsLayer');
  const taskbarWindows = document.getElementById('taskbarWindows');
  const startBtn = document.getElementById('startBtn');
  const startMenu = document.getElementById('startMenu');
  const startMenuList = document.getElementById('startMenuList');
  const clockEl = document.getElementById('clock');

  const TASKBAR_H = 50;
  let zTop = 20;
  let openCount = 0;
  const openWindows = {}; // appId -> { el, minimized, maximized, prevRect }

  // ---------- Icons (small stroke-based SVGs, no emoji/images) ----------
  function iconDoc() {
    return '<svg viewBox="0 0 24 24"><path d="M6 2h9l4 4v16H6z"/><path d="M15 2v4h4"/><line x1="8.5" y1="12" x2="15.5" y2="12"/><line x1="8.5" y1="15.5" x2="15.5" y2="15.5"/><line x1="8.5" y1="19" x2="12.5" y2="19"/></svg>';
  }
  function iconTerminal() {
    return '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="1.5"/><path d="M6 9l4 3-4 3"/><line x1="12" y1="15" x2="17" y2="15"/></svg>';
  }
  function iconNotepad() {
    return '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="1.5"/><circle cx="8" cy="3" r="1"/><circle cx="12" cy="3" r="1"/><circle cx="16" cy="3" r="1"/><line x1="7" y1="10" x2="17" y2="10"/><line x1="7" y1="13.5" x2="17" y2="13.5"/><line x1="7" y1="17" x2="13" y2="17"/></svg>';
  }
  function iconDevlog() {
    return '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 2.5h6v3H9z"/><path d="M8.5 11l2 2 4-4.5"/><line x1="8.5" y1="16.5" x2="15.5" y2="16.5"/></svg>';
  }
  function iconSettings() {
    return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><line x1="12" y1="2.5" x2="12" y2="6.2"/><line x1="12" y1="17.8" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="6.2" y2="12"/><line x1="17.8" y1="12" x2="21.5" y2="12"/><line x1="5.4" y1="5.4" x2="7.9" y2="7.9"/><line x1="16.1" y1="16.1" x2="18.6" y2="18.6"/><line x1="5.4" y1="18.6" x2="7.9" y2="16.1"/><line x1="16.1" y1="7.9" x2="18.6" y2="5.4"/></svg>';
  }

  // ---------- App registry ----------
  // Add a new app by adding one entry here — icon + start menu update themselves.
  const APPS = {
    about: {
      title: 'about.txt',
      icon: iconDoc(),
      width: 380, height: 300,
      render(body) {
        body.innerHTML =
          '<h2 class="app-heading">BukowskiOS</h2>' +
          '<p>A desktop for people who\'d rather make something ugly than make nothing at all.</p>' +
          '<p>Built by <strong>Filip Bucko</strong> in Visual Studio Code. No login, no tracking, no excuses \u2014 just windows you can drag around and a notepad that remembers what you typed.</p>' +
          '<p>Drag a titlebar to move a window. Drag the bottom-right corner to resize it. Double-click a titlebar to fill the screen.</p>';
      }
    },

    terminal: {
      title: 'terminal',
      icon: iconTerminal(),
      width: 420, height: 300,
      render(body) {
        body.innerHTML =
          '<div class="terminal">' +
          '<div class="terminal-output">BukowskiOS terminal \u2014 type \'help\' to see what this thing can do.\n</div>' +
          '<div class="terminal-input-row">' +
          '<span class="terminal-prompt">&gt;</span>' +
          '<input class="terminal-input" autocomplete="off" spellcheck="false" aria-label="Terminal input">' +
          '</div></div>';
      },
      mount(body) {
        const out = body.querySelector('.terminal-output');
        const input = body.querySelector('.terminal-input');
        const history = [];
        let hIndex = -1;
        const fortunes = [
          "Rent's due whether or not the page is good.",
          "Nobody's born a writer. You get dragged into it by rejection.",
          "The blinking cursor doesn't blink first.",
          "A blank page is just a wall you haven't punched through yet.",
          "Everyone's got a novel in them. Most leave it there.",
          "Write it bad first \u2014 you can't fix a page that doesn't exist."
        ];
        function print(text) {
          out.textContent += text + '\n';
          out.scrollTop = out.scrollHeight;
        }
        function run(raw) {
          const cmd = raw.trim();
          if (!cmd) return;
          print('> ' + cmd);
          const parts = cmd.split(' ');
          const name = parts[0].toLowerCase();
          const arg = parts.slice(1).join(' ');
          switch (name) {
            case 'help':
              print('help, about, whoami, date, apps, echo <text>, fortune, clear'); break;
            case 'about':
              print('BukowskiOS \u2014 a desktop that runs in a browser tab and nowhere else.'); break;
            case 'whoami':
              print("you're the one testing this thing. hi."); break;
            case 'date':
              print(new Date().toString()); break;
            case 'apps':
              print(Object.keys(openWindows).length ? Object.keys(openWindows).join(', ') : 'nothing else is open'); break;
            case 'echo':
              print(arg); break;
            case 'fortune':
              print(fortunes[Math.floor(Math.random() * fortunes.length)]); break;
            case 'clear':
              out.textContent = ''; break;
            default:
              print("command not found: " + name + " \u2014 type 'help'");
          }
        }
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            run(input.value);
            if (input.value.trim()) history.push(input.value);
            hIndex = history.length;
            input.value = '';
          } else if (e.key === 'ArrowUp') {
            if (hIndex > 0) { hIndex--; input.value = history[hIndex]; }
            e.preventDefault();
          } else if (e.key === 'ArrowDown') {
            if (hIndex < history.length - 1) { hIndex++; input.value = history[hIndex]; }
            else { hIndex = history.length; input.value = ''; }
            e.preventDefault();
          }
        });
      }
    },

    notepad: {
      title: 'notepad.txt',
      icon: iconNotepad(),
      width: 380, height: 320,
      render(body) {
        body.innerHTML =
          '<textarea class="notepad-textarea" placeholder="Type something. It will still be here when you reload." spellcheck="false"></textarea>' +
          '<div class="notepad-status">Autosaves to this browser.</div>';
      },
      mount(body) {
        const ta = body.querySelector('.notepad-textarea');
        const status = body.querySelector('.notepad-status');
        ta.value = localStorage.getItem('bukowskios-notepad') || '';
        let saveTimer;
        ta.addEventListener('input', () => {
          clearTimeout(saveTimer);
          status.textContent = 'Saving\u2026';
          saveTimer = setTimeout(() => {
            localStorage.setItem('bukowskios-notepad', ta.value);
            status.textContent = 'Saved to this browser.';
          }, 300);
        });
      }
    },

    devlog: {
      title: 'devlog.txt',
      icon: iconDevlog(),
      width: 380, height: 360,
      render(body) {
        body.innerHTML =
          '<h2 class="app-heading">Devlog</h2>' +
          '<p class="app-hint">Replace these with your own entries \u2014 real dates, what you built, what broke, what you fixed.</p>' +
          '<div class="devlog-entry"><b>[Date] \u2014 Entry 1</b>What did you get working first?</div>' +
          '<div class="devlog-entry"><b>[Date] \u2014 Entry 2</b>What broke, and how did you fix it?</div>' +
          '<div class="devlog-entry"><b>[Date] \u2014 Entry 3</b>What is the new feature you added that was not in the guide?</div>';
      }
    },

    settings: {
      title: 'settings',
      icon: iconSettings(),
      width: 340, height: 260,
      render(body) {
        body.innerHTML =
          '<h2 class="app-heading">Wallpaper</h2>' +
          '<p class="app-hint">Pick a mood. It sticks around next time you open this.</p>' +
          '<div class="wallpaper-swatches">' +
          '<button class="swatch swatch-barroom" data-wallpaper="wallpaper-barroom" aria-label="Bar Room wallpaper"></button>' +
          '<button class="swatch swatch-ash" data-wallpaper="wallpaper-ash" aria-label="Ash wallpaper"></button>' +
          '<button class="swatch swatch-rust" data-wallpaper="wallpaper-rust" aria-label="Rust wallpaper"></button>' +
          '<button class="swatch swatch-midnight" data-wallpaper="wallpaper-midnight" aria-label="Midnight wallpaper"></button>' +
          '</div>';
      },
      mount(body) {
        const current = localStorage.getItem('bukowskios-wallpaper') || 'wallpaper-barroom';
        const swatches = body.querySelectorAll('.swatch');
        swatches.forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.wallpaper === current);
          btn.addEventListener('click', () => {
            desktop.classList.remove('wallpaper-barroom', 'wallpaper-ash', 'wallpaper-rust', 'wallpaper-midnight');
            desktop.classList.add(btn.dataset.wallpaper);
            localStorage.setItem('bukowskios-wallpaper', btn.dataset.wallpaper);
            swatches.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
          });
        });
      }
    }
  };

  // ---------- Desktop icons & start menu (built once from APPS) ----------
  function buildDesktopIcons() {
    Object.keys(APPS).forEach((id) => {
      const app = APPS[id];
      const btn = document.createElement('button');
      btn.className = 'icon';
      btn.type = 'button';
      btn.dataset.app = id;
      btn.innerHTML = app.icon + '<span>' + app.title + '</span>';
      btn.addEventListener('click', () => openApp(id));
      iconsLayer.appendChild(btn);
    });
  }

  function buildStartMenu() {
    Object.keys(APPS).forEach((id) => {
      const app = APPS[id];
      const btn = document.createElement('button');
      btn.className = 'start-menu-item';
      btn.type = 'button';
      btn.innerHTML = app.icon + '<span>' + app.title + '</span>';
      btn.addEventListener('click', () => { openApp(id); closeStartMenu(); });
      startMenuList.appendChild(btn);
    });
  }

  // ---------- Window lifecycle ----------
  function openApp(id) {
    const existing = openWindows[id];
    if (existing) {
      existing.minimized = false;
      existing.el.classList.remove('minimized');
      focusWindow(existing.el);
      return;
    }

    const app = APPS[id];
    const el = document.createElement('div');
    el.className = 'window';
    el.dataset.app = id;

    const w = Math.min(app.width, window.innerWidth - 40);
    const h = Math.min(app.height, window.innerHeight - TASKBAR_H - 60);
    const offset = (openCount % 6) * 26;
    const left = Math.max(8, Math.min(110 + offset, window.innerWidth - w - 12));
    const top = Math.max(8, Math.min(70 + offset, window.innerHeight - h - TASKBAR_H - 20));
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    openCount++;

    el.innerHTML =
      '<div class="window-titlebar">' +
      '<span class="title-text">' + app.title + '</span>' +
      '<div class="window-controls">' +
      '<button class="win-btn min" type="button" aria-label="Minimize">\u2013</button>' +
      '<button class="win-btn max" type="button" aria-label="Maximize">\u25A2</button>' +
      '<button class="win-btn close" type="button" aria-label="Close">\u00D7</button>' +
      '</div></div>' +
      '<div class="window-body"></div>' +
      '<div class="resize-handle"></div>';

    windowsLayer.appendChild(el);
    const body = el.querySelector('.window-body');
    app.render(body);
    if (app.mount) app.mount(body);

    openWindows[id] = { el, minimized: false, maximized: false, prevRect: null };

    makeDraggable(el, el.querySelector('.window-titlebar'));
    makeResizable(el, el.querySelector('.resize-handle'));

    el.querySelector('.win-btn.close').addEventListener('click', () => closeApp(id));
    el.querySelector('.win-btn.min').addEventListener('click', () => minimizeApp(id));
    el.querySelector('.win-btn.max').addEventListener('click', () => toggleMaximize(id));
    el.querySelector('.window-titlebar').addEventListener('dblclick', (e) => {
      if (e.target.closest('.window-controls')) return;
      toggleMaximize(id);
    });
    el.addEventListener('mousedown', () => focusWindow(el));

    focusWindow(el);
  }

  function closeApp(id) {
    const win = openWindows[id];
    if (!win) return;
    win.el.remove();
    delete openWindows[id];
    updateTaskbar();
  }

  function minimizeApp(id) {
    const win = openWindows[id];
    if (!win) return;
    win.minimized = true;
    win.el.classList.remove('active');
    win.el.classList.add('minimized');
    updateTaskbar();
  }

  function toggleMaximize(id) {
    const win = openWindows[id];
    if (!win) return;
    const el = win.el;
    if (!win.maximized) {
      win.prevRect = { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
      el.classList.add('maximized');
      el.style.left = '0px';
      el.style.top = '0px';
      el.style.width = '100vw';
      el.style.height = 'calc(100vh - ' + TASKBAR_H + 'px)';
      win.maximized = true;
    } else {
      el.classList.remove('maximized');
      if (win.prevRect) {
        el.style.left = win.prevRect.left;
        el.style.top = win.prevRect.top;
        el.style.width = win.prevRect.width;
        el.style.height = win.prevRect.height;
      }
      win.maximized = false;
    }
    focusWindow(el);
  }

  function focusWindow(el) {
    zTop++;
    el.style.zIndex = zTop;
    document.querySelectorAll('.window').forEach((w) => w.classList.remove('active'));
    el.classList.add('active');
    const win = openWindows[el.dataset.app];
    if (win) win.minimized = false;
    el.classList.remove('minimized');
    updateTaskbar();
  }

  function updateTaskbar() {
    taskbarWindows.innerHTML = '';
    Object.keys(openWindows).forEach((id) => {
      const win = openWindows[id];
      const btn = document.createElement('button');
      btn.className = 'taskbar-item';
      btn.type = 'button';
      if (win.el.classList.contains('active') && !win.minimized) btn.classList.add('active');
      if (win.minimized) btn.classList.add('minimized');
      btn.textContent = APPS[id].title;
      btn.addEventListener('click', () => {
        if (win.minimized) {
          win.minimized = false;
          win.el.classList.remove('minimized');
          focusWindow(win.el);
        } else if (win.el.classList.contains('active')) {
          minimizeApp(id);
        } else {
          focusWindow(win.el);
        }
      });
      taskbarWindows.appendChild(btn);
    });
  }

  // ---------- Drag & resize (mouse + touch) ----------
  function makeDraggable(win, handle) {
    handle.addEventListener('mousedown', (e) => startDrag(e, false));
    handle.addEventListener('touchstart', (e) => startDrag(e, true), { passive: false });

    function startDrag(e, isTouch) {
      if (win.classList.contains('maximized')) return;
      if (e.target.closest('.window-controls')) return;
      focusWindow(win);
      const point = isTouch ? e.touches[0] : e;
      const rect = win.getBoundingClientRect();
      const offsetX = point.clientX - rect.left;
      const offsetY = point.clientY - rect.top;

      function onMove(ev) {
        const p = isTouch ? ev.touches[0] : ev;
        let newLeft = p.clientX - offsetX;
        let newTop = p.clientY - offsetY;
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - win.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - win.offsetHeight - TASKBAR_H));
        win.style.left = newLeft + 'px';
        win.style.top = newTop + 'px';
        if (isTouch) ev.preventDefault();
      }
      function onEnd() {
        document.removeEventListener(isTouch ? 'touchmove' : 'mousemove', onMove);
        document.removeEventListener(isTouch ? 'touchend' : 'mouseup', onEnd);
      }
      document.addEventListener(isTouch ? 'touchmove' : 'mousemove', onMove, { passive: false });
      document.addEventListener(isTouch ? 'touchend' : 'mouseup', onEnd);
    }
  }

  function makeResizable(win, handle) {
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (win.classList.contains('maximized')) return;
      focusWindow(win);
      const startX = e.clientX, startY = e.clientY;
      const startW = win.offsetWidth, startH = win.offsetHeight;

      function onMove(ev) {
        const newW = Math.max(260, startW + (ev.clientX - startX));
        const newH = Math.max(180, startH + (ev.clientY - startY));
        win.style.width = newW + 'px';
        win.style.height = newH + 'px';
      }
      function onEnd() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
    });
  }

  // ---------- Start menu ----------
  function openStartMenu() { startMenu.hidden = false; startBtn.setAttribute('aria-expanded', 'true'); }
  function closeStartMenu() { startMenu.hidden = true; startBtn.setAttribute('aria-expanded', 'false'); }
  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (startMenu.hidden) openStartMenu(); else closeStartMenu();
  });
  document.addEventListener('click', (e) => {
    if (!startMenu.hidden && !startMenu.contains(e.target) && e.target !== startBtn) closeStartMenu();
  });

  // ---------- Clock ----------
  function updateClock() {
    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    clockEl.textContent = h + ':' + m + ' ' + ampm + ' \u00B7 ' + days[now.getDay()];
  }
  setInterval(updateClock, 1000);

  // ---------- Init ----------
  (function initWallpaper() {
    const saved = localStorage.getItem('bukowskios-wallpaper');
    if (saved) {
      desktop.classList.remove('wallpaper-barroom');
      desktop.classList.add(saved);
    }
  })();

  buildDesktopIcons();
  buildStartMenu();
  updateClock();
  openApp('about'); // greet whoever's testing this
})();
