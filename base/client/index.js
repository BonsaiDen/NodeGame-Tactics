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


/*global Emitter, Twist, HashList, BISON,
         network, Class, MozWebSocket, ClientGame, assert
*/


// Client ---------------------------------------------------------------------
// ----------------------------------------------------------------------------
var Client = Class(function(updateFps, renderFps, gameClass) {

    Twist.init(this, updateFps, renderFps);
    Emitter.init(this);

    this._isConnected = false;

    this._tickRate = 0;
    this._tickCount = 0;
    this._tickSyncTime = -1;

    this._gameClass = gameClass || ClientGame;
    this._game = null;

    this._baseTick = 0; // base tick
    this._serverTick = 0;
    this._lastTick = 0;
    this._syncRate = 0;
    this._logicRate = 0;

    this._randomSeed = 0;
    this._randomState = 0;

    this._messageQueue = [];
    this._messageUid = 0;

}, Twist, Emitter, {

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

            tick = lt + ct;
            if (tick > this._lastTick && tick % this._logicRate === 0) {

                this._processMessageQueue();
                this._randomState = tick;
                this._game.tick((tick * this._tickRate) - this._tickRate, tick);
                this._lastTick = tick;

            }

            ct++;

        }

    },

    render: function() {
        this._game.render(this.getTime(), this.getTick());
    },

    end: function(msg) {

        if (this.isRunning()) {

            Twist.stop(this);
            this._game.end(msg);
            this._game = null;

        }

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
            that.end();
            that.emit('disconnect', !msg.wasClean);
        };

    },

    // Interactions -----------------------------------------------------------
    joinGame: function(id) {

        this.send(network.Client.Game.JOIN, {
            game: 1
        });

    },

    leaveGame: function() {
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
                ret = this._handleMessage(type, tick, this._stripMessage(msg));
            }

        }

        return ret;

    },

    // Handle basic messages that don't need tick syncing
    _handleMessageBase: function(type, tick, msg) {

        var strip = this._stripMessage;

        switch(type) {

        case network.Client.HASH:

            try {
                localStorage.setItem(this.key, msg.hash);

            } catch(e) {
            }

            break;

        case network.Client.CONNECT:
            this._isConnected = true;
            this.emit('connect');
            break;

        case network.Server.SETTINGS:
            this.emit('settings', strip(msg, true));
            break;

        case network.Client.Game.JOINED:
            assert(this._game === null);
            this._game = new this._gameClass(this);
            this._game.emit('join', strip(msg));
            break;

        case network.Game.SETTINGS:
            this._tickRate = msg.tickRate;
            this._logicRate = msg.logicRate;
            this._syncRate = msg.syncRate;
            this._randomSeed = msg.randomSeed;
            this._game.emit('settings', strip(msg, true));
            break;

        case network.Server.Game.LIST:
            this.emit('gameList', strip(msg, true));
            break;

        case network.Game.STARTED:

            assert(this.isRunning() === false);

            this._serverTick = 0;
            this._baseTick = Math.floor(tick / 250);

            this._tickSyncTime = Date.now();
            this._tickCount = tick;
            this._lastTick = this._tickCount;

            this._game.start(strip(msg, true));
            Twist.start(this);

            break;

        case network.Game.ENDED:
            this._processMessageQueue(true);
            this.end(strip(msg));
            break;

        case network.ERROR:
            this.emit('error', strip(msg, true));
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
            this._game.emit('leave', msg);
            this.end();
            break;


        // Clients ------------------------------------------------------------
        case network.Game.Client.LIST:
            for(var c = 0, cl = msg.length; c < cl; c++) {
                this._game.addClient(msg[c].id, msg[c].name, msg[c].local);
            }
            break;

        case network.Game.Client.JOINED:
            this._game.addClient(msg.id, msg.name, msg.local);
            break;

        case network.Game.Client.LEFT:
            this._game.removeClient(msg.id);
            break;


        // Players ------------------------------------------------------------
        case network.Game.Player.LIST:
            for(var p = 0, pl = msg.length; p < pl; p++) {
                var m = msg[p];
                this._game.addPlayer(m.id, m.cid, m.neutral, m.local, false);
            }
            break;

        case network.Game.Player.JOINED:
            this._game.addPlayer(msg.id, msg.cid, msg.neutral, msg.local, false);
            break;

        case network.Game.Player.REJOINED:

            var player = this._game.getPlayer(msg.id);
            assert(player);

            player.setClient(this._game.getClient(msg.cid));
            player.join(true);

            //this._game.addPlayer(msg.id, msg.cid, msg.neutral, msg.local, true);
            break;

        case network.Game.Player.LEFT:
            this._game.removePlayer(msg.id);
            break;

        default:
            this._game.emit('message', type, msg);
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

    _stripMessage: function(msg, tickless) {

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

