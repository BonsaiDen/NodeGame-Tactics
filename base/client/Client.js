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

    prototype: [Emitter],

    constructor: function(updateFps, renderFps) {

        Super(updateFps, renderFps);
        Emitter(this);

        this._isConnected = false;
        this._isPlaying = false;

        this._tickRate = 0;
        this._tickCount = 0;
        this._tickSyncTime = -1;

        this._players = new HashList();
        this._clients = new HashList();

        this._baseTick = 0; // base tick
        this._serverTick = 0;
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

                this._processMessageQueue();
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

    draw: function(t, tick) {

    },

    tick: function(t, tick) {
        console.log(t, tick, this.getRandom());
    },


    // Network stuff ----------------------------------------------------------
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
            that._onMessage(BISON.decode(msg.data), true);
        };

        this.socket.onclose = function(msg) {
            that.stop();
            that.emit('network.close', !msg.wasClean);
        };

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


    // Networking -------------------------------------------------------------
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

    getPlayers: function() {
        return this._players;
    },


    // Message Handling -------------------------------------------------------
    // ------------------------------------------------------------------------
    _onMessage: function(msg, initial, flush) {

        // Ticks are just plain numbers in the range of 0-250
        // these wrap around in order to keep the bandwidth for ticking as
        // low as possible
        if (typeof msg === 'number') {

            var diff = msg - this._serverTick;

            if (diff < 0 ) {
                this._baseTick++;
            }

            this._serverTick = msg;
            this._tickSyncTime = Date.now();
            this._tickCount = this._baseTick * 250 + msg;
            return false;

        }

        // Get info from msg object
        var type = msg.type !== undefined ? msg.type : msg[0],
            tick = (msg.tick !== undefined ? msg.tick : msg[1]) || 0;

        // Handle basic message which are not synced with tick counts
        var ret = this._handleMessageBase(type, tick, msg);
        if (ret === false) {

            // Messages which need to be in sync with the tick count
            // these will be processed right before the next gam tick
            // -----------------------------------------------------
            if (!flush && tick > 0 && tick > this._lastTick) {

                if (initial) {
                    msg.uid = ++this._messageUid;
                    this._messageQueue.push(msg);
                }

            } else {
                ret = this._handleMessage(type, tick, this.stripMessage(msg))
            }

        }

        return ret;

    },

    // Handle basic messages that don't need tick syncing
    _handleMessageBase: function(type, tick, msg) {

        var strip = this.stripMessage;

        switch(type) {

        case network.Client.HASH:

            try {
                localStorage.setItem(this.key, msg.hash);

            } catch(e) {
            }

            break;


        case network.Client.CONNECT:
            this._isConnected = true;
            this.emit('network.connect');
            break;


        case network.Server.SETTINGS:
            this.emit('server.settings', strip(msg, true));
            break;


        case network.Game.SETTINGS:
            this._tickRate = msg.tickRate;
            this._logicRate = msg.logicRate;
            this._syncRate = msg.syncRate;
            this._randomSeed = msg.randomSeed;
            this.emit('game.settings', strip(msg, true));
            break;


        case network.Game.ENDED:
            this._processMessageQueue(true);
            this.emit('game.end', strip(msg));
            this.stop();
            break;


        case network.Server.Game.LIST:
            this.emit('server.game.list', strip(msg, true));
            break;


        case network.Client.Game.JOINED:
            this.emit('game.join', strip(msg));
            break;


        case network.Game.STARTED:

            if (!this.isRunning()) {

                // For wrapped tick updating
                this._serverTick = 0;
                this._baseTick = Math.floor(tick / 250);

                this._tickSyncTime = Date.now();
                this._tickCount = tick;
                this._lastTick = this._tickCount;

                this._isPlaying = true;
                this.emit('game.start', strip(msg, true));
                this.start();

            }

            break;


        case network.ERROR:
            this.emit('network.error', strip(msg, true));
            break;


        default:
            return false;

        }

        return true;

    },

    // Handle all messages that do need tick syncing
    _handleMessage: function(type, tick, msg) {

        switch(type) {

        case network.Client.Game.LEFT:

            this.emit('game.leave', msg);
            this.stop();
            this._players.clear();
            this._clients.clear();
            break;


        case network.Game.Client.LIST:

            this._clients.clear();

            for(var i = 0, l = msg.length; i < l; i++) {
                this._clients.add(msg[i]);
            }

            this.emit('game.client.list', this._clients);
            break;


        case network.Game.Client.JOINED:
        case network.Game.Client.REJOINED:

            if (!this._clients.has(msg)) {

                this._clients.add(msg);

                if (type === network.Game.Client.JOINED) {
                    this.emit('game.client.join', msg);
                } else {
                    this.emit('game.client.rejoin', msg);
                }

                this.emit('game.client.list', this._clients);
            }
            break;


        case network.Game.Client.LEFT:

            if (this._clients.has(msg)) {
                this._clients.remove(msg);
                this.emit('game.client.leave', msg);
                this.emit('game.client.list', this._clients);
            }
            break;


        case network.Game.Player.LIST:

            this._players.clear();

            for(var i = 0, l = msg.length; i < l; i++) {
                this._players.add(msg[i]);
            }

            this.emit('game.player.list', this._players);
            break;


        case network.Game.Player.JOINED:

            if (!this._players.has(msg)) {
                this._players.add(msg);
                this.emit('game.player.join', msg);
                this.emit('game.player.list', this._players);
            }
            break;


        case network.Game.Player.LEFT:

            if (this._players.has(msg)) {
                this._players.remove(msg);
                this.emit('game.player.leave', msg);
                this.emit('game.player.list', this._players);
            }
            break;



        default:
            this.emit('message', type, msg);
            break;

        }

        return true;

    },

    _processMessageQueue: function(flush) {

        // Sort messaged based on UID to ensure correct order
        this._messageQueue.sort(function(a, b) {
            return a.uid - b.uid;
        });

        for(var i = 0; i < this._messageQueue.length; i++) {

            if (this._onMessage(this._messageQueue[i], false, flush)) {
                this._messageQueue.splice(i, 1);
                i--;
            }

        }

    },

    stripMessage: function(msg, tickless) {

        delete msg.uid;
        if (msg instanceof Array) {
            msg.shift();
            msg.tick = msg.shift();

        } else {
            delete msg.type;
        }

        if (tickless) {
            delete msg.tick;
        }

        return msg;

    }

});

