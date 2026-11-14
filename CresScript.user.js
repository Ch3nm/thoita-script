// ==UserScript==
// @name         CresScript
// @description  various utils for thoita, including force focus
// @namespace    http://tampermonkey.net/
// @author       cres
// @version      2026-11-13
// @match        https://world.thoita.com/
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_VERSION = 3;
    const VERSION_URL = 'https://raw.githubusercontent.com/Ch3nm/thoita-script/main/version.txt';
    const ALERT_URL = 'https://raw.githubusercontent.com/Ch3nm/thoita-script/main/red-siren-alert.mp3';
    const CHAT_URL = 'wss://hack.chat/chat-ws';

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

    //////////////////////
    //   force focus    //
    //////////////////////

    // override vis (works alone when tab in same window)
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    // document.hasFocus = function() { return true; }; forces true output, but tested and not needed
    // block events likely to be the cause of the evil
    ['visibilitychange', 'blur', 'focus'].forEach(eventType => {
        window.addEventListener(eventType, e => e.stopImmediatePropagation(), true);
        document.addEventListener(eventType, e => e.stopImmediatePropagation(), true);
    });

    //////////////////////
    //   main menu      //
    //////////////////////

    window.addEventListener('DOMContentLoaded', () => {
        let playtime = Date.now();
        let lastInputTime = Date.now();
        let alarmActive = false;
        let alarmEnabled = true;

        let roomCode = '';
        let username = 'user' + Math.floor(Math.random() * 10000);
        let chatSocket = null;
        let chatTyping = false;
        let chatDraft = '';
        let chatMessages = [];

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
            Time since last input: <span id="CS-lastInput">00:00</span><br><br>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                <span id="CS-alarm" style="width:12px;height:12px;border:1px solid white;display:inline-block;text-align:center;line-height:12px;font-size:11px;"></span>
                AFK kick warning
            </label>
            <div style="margin-top:10px;">
                Room: <span id="CS-room" style="cursor:pointer;">not set</span><br>
                Username: <span id="CS-username" style="cursor:pointer;">user</span><br>
                <span id="CS-connect" style="cursor:pointer;text-decoration:underline;">Connect chat (p to open)</span>
            </div>
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

        // alarm fixes
        const alarm = gui.querySelector('#CS-alarm');

        function updateAlarmCheckbox() {
            alarm.textContent = alarmEnabled ? '✓' : '';
        }

        // toggle alarm
        alarm.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            alarmEnabled = !alarmEnabled;
            updateAlarmCheckbox();

            if (!alarmEnabled) {
                warning.style.display = 'none';
                alarmActive = false;
                alert.pause();
                alert.currentTime = 0;
            }
        });

        updateAlarmCheckbox();

        // drag gui
        function makeDraggable(panel, handle) {
            let dragging = false;
            let dragX = 0;
            let dragY = 0;

            handle.addEventListener('pointerdown', e => {
                dragging = true;
                const rect = panel.getBoundingClientRect();
                dragX = e.clientX - rect.left;
                dragY = e.clientY - rect.top;
                panel.style.left = rect.left + 'px';
                panel.style.top = rect.top + 'px';
                panel.style.right = 'auto';
                handle.setPointerCapture(e.pointerId);
                e.preventDefault();
            });

            handle.addEventListener('pointermove', e => {
                if (!dragging) return;
                panel.style.left = Math.max(0, Math.min(innerWidth - panel.offsetWidth, e.clientX - dragX)) + 'px';
                panel.style.top = Math.max(0, Math.min(innerHeight - panel.offsetHeight, e.clientY - dragY)) + 'px';
            });

            handle.addEventListener('pointerup', () => dragging = false);
            handle.addEventListener('pointercancel', () => dragging = false);
        }

        makeDraggable(gui, header);

        // open menu, (default key being backslash)
        window.addEventListener('keydown', e => {
            if (e.key === '\\') {
                gui.style.display = gui.style.display === 'none' ? 'block' : 'none';
            }
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

            if (alarmEnabled && idle >= 870000) {
                warning.style.display = 'block';

                if (!alarmActive) {
                    alarmActive = true;
                    alert.play().catch(console.warn);
                }
            }
        }

        setInterval(updateTimers, 350);

        //////////////////////
        //   chat menu      //
        //////////////////////

        const chatMenu = document.createElement('div');
        chatMenu.id = 'CS-chat';
        chatMenu.style.cssText = 'position:fixed;top:100px;left:100px;width:300px;background:transparent;color:white;padding:10px;z-index:999998;display:none;font:13px Comfortaa,sans-serif;text-shadow:0 1px 3px black;user-select:none;';

        chatMenu.innerHTML = `
            <div id="CS-chat-header" style="cursor:move;font-weight:bold;margin-bottom:8px;">Chat</div>
            <div id="CS-chat-status" style="font-size:11px;margin-bottom:6px;">Not connected</div>
            <div id="CS-chat-messages" style="height:200px;overflow-y:auto;overflow-wrap:anywhere;white-space:pre-wrap;"></div>
            <div id="CS-chat-composer" style="margin-top:8px;cursor:pointer;">Click here to send a message...</div>
        `;

        document.body.appendChild(chatMenu);

        const chatHeader = chatMenu.querySelector('#CS-chat-header');
        const chatStatus = chatMenu.querySelector('#CS-chat-status');
        const chatDisplay = chatMenu.querySelector('#CS-chat-messages');
        const chatComposer = chatMenu.querySelector('#CS-chat-composer');

        makeDraggable(chatMenu, chatHeader);

        // chat history
        function addChatMessage(name, message) {
            chatMessages.push({ name, message });
            if (chatMessages.length > 10) chatMessages.shift();

            chatDisplay.replaceChildren();

            chatMessages.forEach(item => {
                const line = document.createElement('div');
                const nick = document.createElement('b');
                nick.textContent = item.name + ': ';
                line.append(nick, document.createTextNode(item.message));
                chatDisplay.appendChild(line);
            });

            chatDisplay.scrollTop = chatDisplay.scrollHeight;
        }

        // connect to hack.chat
        function connectChat() {
            if (!roomCode || !username) {
                chatStatus.textContent = 'Set a room & username in main menu.';
                return;
            }

            if (!/^[a-zA-Z0-9_-]{1,32}$/.test(roomCode)) {
                chatStatus.textContent = 'Invalid roomcode.';
                return;
            }

            if (!/^[a-zA-Z0-9_]{1,24}$/.test(username)) {
                chatStatus.textContent = 'Invalid username.';
                return;
            }

            if (chatSocket) {
                chatSocket.close();
                chatSocket = null;
            }

            chatMessages = [];
            chatDisplay.replaceChildren();
            chatStatus.textContent = 'Connecting...';

            const socket = new WebSocket(CHAT_URL);
            chatSocket = socket;

            socket.addEventListener('open', () => {
                if (chatSocket !== socket) return;
                socket.send(JSON.stringify({
                    cmd: 'join',
                    channel: roomCode,
                    nick: username
                }));
            });

            socket.addEventListener('message', event => {
                if (chatSocket !== socket) return;

                let data;
                try {
                    data = JSON.parse(event.data);
                } catch {
                    return;
                }

                if (data.cmd === 'chat') {
                    addChatMessage(data.nick || 'Unknown', data.text || '');
                } else if (data.cmd === 'onlineSet') {
                    chatStatus.textContent = `Connected to #${roomCode} (${data.nicks?.length || 0} users)`;
                    addChatMessage('System', 'Connected to room.');
                } else if (data.cmd === 'onlineAdd') {
                    addChatMessage('System', `${data.nick} joined.`);
                } else if (data.cmd === 'onlineRemove') {
                    addChatMessage('System', `${data.nick} left.`);
                } else if (data.cmd === 'info' || data.cmd === 'warn' || data.cmd === 'error') {
                    addChatMessage('System', data.text || data.message || data.cmd);
                }
            });

            socket.addEventListener('close', () => {
                if (chatSocket === socket) {
                    chatStatus.textContent = 'Disconnected.';
                    chatSocket = null;
                }
            });

            socket.addEventListener('error', () => {
                if (chatSocket === socket) chatStatus.textContent = 'Connection error.';
            });
        }

        // main menu chat settings
        const roomSetting = gui.querySelector('#CS-room');
        const usernameSetting = gui.querySelector('#CS-username');
        const connectSetting = gui.querySelector('#CS-connect');

        roomSetting.addEventListener('click', () => {
            const value = prompt('Enter roomcode:', roomCode);
            if (value !== null) {
                roomCode = value.trim();
                roomSetting.textContent = roomCode || 'not set';
            }
        });

        usernameSetting.addEventListener('click', () => {
            const value = prompt('Enter chat username:', username);
            if (value !== null) {
                username = value.trim();
                usernameSetting.textContent = username || 'not set';
            }
        });

        connectSetting.addEventListener('click', connectChat);


        // chat messages
        chatComposer.addEventListener('click', () => {
            if (chatSocket?.readyState !== WebSocket.OPEN) {
                chatStatus.textContent = 'not connected.';
                return;
            }

            const message = prompt('Enter chat message:');
            if (message?.trim()) {
                chatSocket.send(JSON.stringify({
                    cmd: 'chat',
                    text: message.trim()
                }));
            }
        });

        // open chat menu
        window.addEventListener('keydown', e => {
            if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                e.stopImmediatePropagation();
                chatMenu.style.display = chatMenu.style.display === 'none' ? 'block' : 'none';
            }
        }, true);
    });
})();
