// ==UserScript==
// @name         CresScript
// @description  various utils for thoita, including force focus
// @namespace    http://tampermonkey.net/
// @author       cres
// @version      2026-11-11
// @match        https://world.thoita.com/
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    /*     force focus     */

    // override vis (works alone when tab in same window)
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    // document.hasFocus = function() { return true; }; forces true output, but tested and not needed
    // block events likely to be the cause of the evil
    ['visibilitychange', 'blur', 'focus'].forEach(eventType => {
        window.addEventListener(eventType, e => e.stopImmediatePropagation(), true);
        document.addEventListener(eventType, e => e.stopImmediatePropagation(), true);
    });

    /*     menu     */

    window.addEventListener('DOMContentLoaded', () => {
        let playtime = Date.now();
        let lastInputTime = Date.now();

        // last input
        ['keydown', 'mousedown'].forEach(eventType => { window.addEventListener(eventType, () => lastInputTime = Date.now(), true); }); // mousedown broken

        // init gui
        const gui = document.createElement('div');
        gui.id = 'CS-gui';
        gui.style.cssText = 'position:fixed;top:20px;right:20px;background:#000;color:#FFF;padding:10px;z-index:999999;display:none;user-select:none;';
        gui.innerHTML = 'CresScript<br>Session time: <span id="CS-playtime">00:00:00</span><br>Time since last input: <span id="CS-lastInput">00:00:00</span>';

        document.body.appendChild(gui);

        // open menu, (default key being backslash)
        window.addEventListener('keydown', e => { if (e.key === '\\') gui.style.display = gui.style.display === 'none' ? 'block' : 'none'; });

        // time formatting
        function formatTime(ms) {
            let s = Math.floor(ms / 1000);
            return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60]
                .map(n => String(n).padStart(2, '0')).join(':');
        }

        // update timer
        setInterval(() => {
            let now = Date.now();
            document.getElementById('CS-playtime').textContent = formatTime(now - playtime);
            document.getElementById('CS-lastInput').textContent = formatTime(now - lastInputTime);
        }, 1000);
    });
})();
