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

        this._lastTick = 0;
        this._syncRate = 0;
        this._logicRate = 0;

        this._randomSeed = 0;
        this._randomState = 0;

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
            that.clientMessage(BISON.decode(msg.data));
        };

        this.socket.onclose = function() {
            that.stop();
            that.clientClose();
        };

    },

    clientConnect: function() {
        this.join(1);
    },

    clientMessage: function(msg) {

        msg.type = msg.type !== undefined ? msg.type : msg[0];

        // Set re-connect hash
        if (msg.type === network.Client.HASH) {

            try {
                localStorage.setItem(this.key, msg.hash);

            } catch(e) {
            }

        } else if (!this._isConnected && msg.type === network.Client.CONNECT) {
            this._isConnected = true;
            this.clientConnect();

        // Server settings for clients
        } else if (msg.type === network.Server.SETTINGS) {
            console.log('client settings: ', msg);

        // List of games
        } else if (msg.type === network.Server.Game.LIST) {
            console.log('running games: ', msg);

        // Game joined
        } else if (msg.type === network.Client.Game.JOINED) {

            console.log('game joined: ', msg);
            this._tickRate = msg.tickRate;
            this._logicRate = msg.logicRate;
            this._syncRate = msg.syncRate;
            this._randomSeed = msg.randomSeed;

            if (!this.isRunning()) {
                this._isPlaying = true;
                this._lastTick = this._tickCount;
                this.start();
                this.onGameJoin(msg.id);
            }

        // Game left
        } else if (msg.type === network.Client.Game.LEFT) {
            this.stop();
            this.onGameLeave(msg.id);

        // Sync game ticks
        } else if (msg.type === network.Game.TICK) {
            this._tickSyncTime = Date.now();
            this._tickCount = msg[1];

        } else {
            return msg;
        }

    },

    clientClose: function() {
        console.log('Closed');
    },

    onGameJoin: function(id) {
        console.log('Joined game #' + id);
    },

    onGameLeave: function(id) {
        console.log('Left game #' + id);
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

    send: function(type, msg) {

        msg = msg || [];
        if (msg instanceof Array) {
            msg.unshift(type);

        } else {
            msg.type = type;
        }

        this.socket.send(BISON.encode(msg));

    },


    // Helpers ----------------------------------------------------------------
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

    }

});

