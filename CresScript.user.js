// ==UserScript==
// @name         CresScript
// @description  various utils for thoita, including force focus
// @namespace    http://tampermonkey.net/
// @author       cres
// @version      2026-11-12
// @match        https://world.thoita.com/
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_VERSION = 2;
    const VERSION_URL = 'https://raw.githubusercontent.com/Ch3nm/thoita-script/main/version.txt';
    const ALERT_URL = 'https://raw.githubusercontent.com/Ch3nm/thoita-script/main/red-siren-alert.mp3';

    // version check
    fetch(VERSION_URL, { cache: 'no-store' })
        .then(r => {
            if (!r.ok) throw new Error('Version check failed');
            return r.text();
        })
        .then(v => {
            const latest = Number(v.trim());
            if (Number.isInteger(latest) && latest !== SCRIPT_VERSION)
                alert(`A new version is available (${latest})! \nPlease update:\nhttps://github.com/Ch3nm/thoita-script`);
        })
        .catch(console.warn);

    /*
         force focus
    */

    // override vis (works alone when tab in same window)
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    // document.hasFocus = function() { return true; }; forces true output, but tested and not needed
    // block events likely to be the cause of the evil
    ['visibilitychange', 'blur', 'focus'].forEach(eventType => {
        window.addEventListener(eventType, e => e.stopImmediatePropagation(), true);
        document.addEventListener(eventType, e => e.stopImmediatePropagation(), true);
    });

    /*
         menu
    */

    window.addEventListener('DOMContentLoaded', () => {
        let playtime = Date.now();
        let lastInputTime = Date.now();
        let dragging = false;
        let dragX = 0;
        let dragY = 0;
        let alarmActive = false;

        const alert = new Audio(ALERT_URL);
        alert.loop = true;

        // last input
        // mousedown broken so use pointerdown instead
        function registerInput() {
            lastInputTime = Date.now();
            warning.style.display = 'none';

            if (alarmActive) {
                alarmActive = false;
                alert.pause();
                alert.currentTime = 0;
            }
        }

        ['keydown', 'pointerdown'].forEach(eventType => {
            window.addEventListener(eventType, registerInput, true);
        });

        // init gui
        const gui = document.createElement('div');
        gui.id = 'CS-gui';
        gui.style.cssText = 'position:fixed;top:20px;right:20px;background:transparent;color:white;padding:10px;z-index:999999;display:none;user-select:none;font-family:Comfortaa,sans-serif;text-shadow:0 1px 3px black;';

        gui.innerHTML = `
            <div id="CS-header" style="cursor:move;font-weight:bold;margin-bottom:8px;">CresScript</div>
            Session time: <span id="CS-playtime">00:00:00</span><br>
            Time since last input: <span id="CS-lastInput">00:00:00</span><br><br>
            <label><input id="CS-alarm" type="checkbox" checked> AFK kick warning</label>
        `;

        document.body.appendChild(gui);

        // afk warning
        const warning = document.createElement('div');
        warning.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);display:none;color:red;font:bold 16px Comfortaa,sans-serif;text-shadow:0 1px 3px black;z-index:1000000;pointer-events:none;';
        warning.textContent = '[CresScript] WARNING, AFK KICK SOON!';
        document.body.appendChild(warning);

        // comfortaa font
        const font = document.createElement('link');
        font.rel = 'stylesheet';
        font.href = 'https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;700&display=swap';
        document.head.appendChild(font);

        const header = gui.querySelector('#CS-header');
        const alarm = gui.querySelector('#CS-alarm');

        // drag gui
        header.addEventListener('pointerdown', e => {
            dragging = true;
            const rect = gui.getBoundingClientRect();
            dragX = e.clientX - rect.left;
            dragY = e.clientY - rect.top;
            gui.style.left = rect.left + 'px';
            gui.style.top = rect.top + 'px';
            gui.style.right = 'auto';
            header.setPointerCapture(e.pointerId);
        });

        header.addEventListener('pointermove', e => {
            if (!dragging) return;
            gui.style.left = Math.max(0, Math.min(innerWidth - gui.offsetWidth, e.clientX - dragX)) + 'px';
            gui.style.top = Math.max(0, Math.min(innerHeight - gui.offsetHeight, e.clientY - dragY)) + 'px';
        });

        header.addEventListener('pointerup', () => dragging = false);
        header.addEventListener('pointercancel', () => dragging = false);

        // open menu, (default key being backslash)
        window.addEventListener('keydown', e => {
            if (e.key === '\\') gui.style.display = gui.style.display === 'none' ? 'block' : 'none';
        });

        // time formatting
        function formatTime(ms, short = false) {
            let s = Math.floor(ms / 1000);
            let parts = short
                ? [Math.floor(s / 60), s % 60]
                : [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60];

            return parts.map(n => String(n).padStart(2, '0')).join(':');
        }

        // update timer
        function updateTimers() {
            const now = Date.now();
            const idle = now - lastInputTime;

            gui.querySelector('#CS-playtime').textContent = formatTime(now - playtime);
            gui.querySelector('#CS-lastInput').textContent = formatTime(idle, true);

            if (alarm.checked && idle >= 870000) {
                warning.style.display = 'block';

                if (!alarmActive) {
                    alarmActive = true;
                    alert.play().catch(console.warn);
                }
            }
        }

        setInterval(updateTimers, 350);

        // toggle alarm
        alarm.addEventListener('change', () => {
            if (!alarm.checked) {
                warning.style.display = 'none';
                alarmActive = false;
                alert.pause();
                alert.currentTime = 0;
            }
        });
    });
})();
