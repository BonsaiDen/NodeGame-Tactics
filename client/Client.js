/**
  * Copyright (c) 2011 Ivo Wetzel.
  *
  * Permission is hereby granted, free of charge, to any person obtaining a copy
  * of this software and associated documentation files (the "Software"), to deal
  * in the Software without restriction, including without limitation the rights
  * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  * copies of the Software, and to permit persons to whom the Software is
  * furnished to do so, subject to the following conditions:
  *
  * The above copyright notice and this permission notice shall be included in
  * all copies or substantial portions of the Software.
  *
  * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  * THE SOFTWARE.
  */


// Client Networking Handling -------------------------------------------------
// ----------------------------------------------------------------------------
var Client = Class(Twist, {

    constructor: function(updateFps, renderFps) {

        Super(updateFps, renderFps);

        this._isConnected = false;
        this._isPlaying = false;

        this._tickRate = 0;
        this._tickCount = -1;
        this._tickSyncTime = -1;

        this._players = new HashList();
        this._clients = new HashList();

        this._lastTick = 0;
        this._syncRate = 0;
        this._logicRate = 0;

        this._randomSeed = 0;
        this._randomState = 0;

        this._messageQueue = [];

        this._messageUid = 0;

    },

    /**
      * Handle update of time and tick count and trigger game logic.
      */
    update: function() {

        var t = this.getTime(),
            tick = this.getTick();

        var ct = 0,
            diff = tick - this._lastTick,
            lt = this._lastTick || 0;

        while(ct < diff) {

            var tick = lt + ct;
            if (tick > this._lastTick && tick % this._logicRate === 0) {

                this.onMessageQueue();
                this._randomState = tick;
                this.tick((tick * this._tickRate) - this._tickRate, tick);
                this._lastTick = tick;

            }

            ct++;

        }

    },

    render: function() {
        this.draw(this.getTime(), this.getTick());
    },

    // Network stuff
    connect: function(host, port, name) {

        var ws = typeof WebSocket !== 'undefined' ? WebSocket : MozWebSocket;
        this.socket = new ws('ws://' + host + ':' + port);
        this.key = 'clientHash-' + host + '-' + port;

        var that = this;
        this.socket.onopen = function() {

            var hash = '';
            try {
                hash = (localStorage.getItem(that.key) || '') + '';

            } catch(e) {
            }

            hash = hash || '--------------------------------';

            that.send(network.Client.CONNECT, {
                hash: hash,
                name: name
            });

        };

        this.socket.onmessage = function(msg) {
            that.onMessage(BISON.decode(msg.data), true);
        };

        this.socket.onclose = function() {
            that.stop();
            that.onClose();
        };

    },

    onConnect: function() {
        this.join(1);
    },

    onError: function(error) {
        console.log('ERROR:', error);
    },

    // TODO validate against tick count to ensure synced state
    onMessage: function(msg, initial, flush) {

        msg.type = msg.type !== undefined ? msg.type : msg[0];
        msg.tick = (msg.tick !== undefined ? msg.tick : msg[1]) || 0;

        // Set re-connect hash
        if (msg.type === network.Client.HASH) {

            try {
                localStorage.setItem(this.key, msg.hash);

            } catch(e) {
            }
            return true;

        } else if (!this._isConnected && msg.type === network.Client.CONNECT) {
            this._isConnected = true;
            this.onConnect();
            return true;

        // Server settings for clients
        } else if (msg.type === network.Server.SETTINGS) {
            console.log('client settings: ', msg);
            return true;

        // Game settings
        } else if (msg.type === network.Game.SETTINGS) {

            console.log('game settings: ', msg);
            this._tickRate = msg.tickRate;
            this._logicRate = msg.logicRate;
            this._syncRate = msg.syncRate;
            this._randomSeed = msg.randomSeed;

            return true;

        // Game ended
        } else if (msg.type === network.Game.ENDED) {

            this.onMessageQueue(true);
            this.onGameEnd(msg);
            console.log('game ended')
            this.stop();
            return true;

        // List of games
        } else if (msg.type === network.Server.Game.LIST) {
            console.log('running games: ', msg);
            return true;

        // Game started
        } else if (msg.type === network.Client.Game.JOINED) {
            this.onGameJoin(msg.id);

        // Game started
        } else if (msg.type === network.Game.STARTED) {

            console.log('game started');
            if (!this.isRunning()) {
                this._isPlaying = true;
                this._lastTick = this._tickCount;
                this.start();
            }

            this.onGameStart(msg);

            return true;

        // Sync game ticks
        } else if (msg.type === network.Game.TICK) {
            this._tickSyncTime = Date.now();
            this._tickCount = msg[1];
            return true;

        // Errors
        } else if (msg.type == network.ERROR) {
            this.onError(msg);
            return true;
        }


        // Messages which need to be in sync with the tick count
        // these will be processed right before the next gam tick
        // -----------------------------------------------------
        if (!flush && msg.tick > 0 && msg.tick > this._lastTick) {

            if (initial) {
                msg._uid = ++this._messageUid;
                this._messageQueue.push(msg);
            }

            return false;

        }

        delete msg._uid;

        // Game left
        if (msg.type === network.Client.Game.LEFT) {

            this.stop();
            this._players.clear();
            this._clients.clear();
            this.onGameLeave(msg.id);

        // Client list
        } else if (msg.type == network.Game.Client.LIST) {

            this._clients.clear();

            var list = msg.slice(2);
            for(var i = 0, l = list.length; i < l; i++) {
                this._clients.add(list[i]);
            }

            this.onClientList(this._clients);

        // Client joined
        } else if (msg.type == network.Game.Client.JOINED) {

            delete msg.type;
            if (!this._clients.has(msg)) {
                this._clients.add(msg);
            }

            this.onClientList(this._clients);

        // Client left
        } else if (msg.type == network.Game.Client.LEFT) {

            if (this._clients.has(msg)) {
                this._clients.remove(msg);
            }

            this.onClientList(this._clients);

        // Player list
        } else if (msg.type == network.Game.Player.LIST) {

            this._players.clear();

            var list = msg.slice(2);
            for(var i = 0, l = list.length; i < l; i++) {
                this._players.add(list[i]);
            }

            this.onPlayerList(this._players);

        // Player joined
        } else if (msg.type == network.Game.Player.JOINED) {

            delete msg.type;
            if (!this._players.has(msg)) {
                this._players.add(msg);
                this.onPlayerJoin(msg);
            }

            this.onPlayerList(this._players);

        // Player left
        } else if (msg.type == network.Game.Player.LEFT) {

            if (this._players.has(msg)) {
                this._players.remove(msg);
                this.onPlayerLeave(msg);
            }

            this.onPlayerList(this._players);

        } else {
            console.log('other', msg);
        }

        return true;

    },

    onMessageQueue: function(flush) {

        // Sort messaged based on UID to ensure correct order
        this._messageQueue.sort(function(a, b) {
            return a._uid - b._uid;
        });

        for(var i = 0; i < this._messageQueue.length; i++) {

            if (this.onMessage(this._messageQueue[i], false, flush)) {
                this._messageQueue.splice(i, 1);
                i--;
            }

        }

    },

    onClose: function() {
        console.log('Closed');
    },

    onGameJoin: function(id) {
        console.log('Joined game #' + id);
    },

    onGameLeave: function(id) {
        console.log('Left game #' + id);
    },


    onGameStart: function() {

    },

    onGameEnd: function() {

    },

    onGameEnd: function() {

    },

    onPlayerList: function(players) {
        console.log(players.toString());
    },

    onPlayerJoin: function(player) {
        console.log('player joined', player);
    },

    onPlayerLeave: function(player) {
        console.log('player left', player);
    },

    onClientList: function(clients) {

    },

    // Interactions -----------------------------------------------------------
    join: function(id) {

        this.send(network.Client.Game.JOIN, {
            game: 1
        });

    },

    leave: function() {
        this.send(network.Client.Game.LEAVE);
    },

    send: function(type, msg, ping) {

        msg = msg || {};
        if (msg instanceof Array) {
            msg.unshift(type);

        } else {
            msg.type = type;
        }

        if (ping && this.isRunning()) {
            msg.tick = this.getTick();
        }

        this.socket.send(BISON.encode(msg));

    },

    ping: function() {
        this.send(1000, {}, true);
    },


    // Getter / Setter --------------------------------------------------------
    // ------------------------------------------------------------------------
    getRandom: function() {
        this._randomState = (1103515245 * (this._randomState + this._randomSeed) + 12345) % 0x100000000;
        return this._randomState / 0x100000000;
    },

    getTime: function() {
        return this._tickCount * this._tickRate + (Date.now() - this._tickSyncTime);
    },

    getTick: function() {

        var dt = (Date.now() - this._tickSyncTime),
            tick = this._tickCount + Math.round(dt / this._tickRate) || 0;

        return tick;

    },

    getClients: function() {
        return this._clients;
    },

    getPlayer: function() {
        return this._players;
    }

});

