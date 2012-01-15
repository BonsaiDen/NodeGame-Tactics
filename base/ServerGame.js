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


// Imports --------------------------------------------------------------------
var Class = require('./lib/Class'),
    ServerPlayer = require('./ServerPlayer'),
    HashList = require('./lib/HashList'),
    Emitter = require('./lib/Emitter'),
    Logger = require('./lib/Logger'),
    network = require('./network');


// Basic Server Game Class ----------------------------------------------------
// ----------------------------------------------------------------------------
var ServerGame = Class(function(server, id, maxPlayers, playerTimeout) {

    Emitter.init(this);
    Logger.init(this, 'ServerGame');

    this.id = id;
    this._server = server;

    // Players
    this._maxPlayers = maxPlayers || 6;
    this._players = new HashList(maxPlayers);
    this._clients = new HashList();
    this._playerTimeout = playerTimeout || 1000;
    this._playerClass = ServerPlayer;

    // Ticking
    this._tickTime = 0;
    this._tickRate = 66;
    this._tickCount = 0;
    this._tickInterval = null;

    // Game Time
    this._startTime = -1;
    this._realTime = 0;
    this._frameTime = -1;

    // More logic stuff
    this._randomSeed = 500000 + Math.floor((Math.random() * 1000000));
    this._randomState = 0;
    this._logicRate = 10;
    this._syncRate = 30;

    this._isRunning = false;

    var that = this;
    setTimeout(function() {
        ServerGame.start(that);

    }, 2000);

}, Emitter, Logger, {

    // Main Game loop ---------------------------------------------------------
    start: function() {

        this._isRunning = true;

        // Start game loop
        var that = this;
        this._tickInterval = setInterval(function() {
            that._tick();

        }, this._tickRate);

        this._frameTime = Date.now();
        this._tickCount = 1;

    },

    _tick: function() {

        var now = Date.now();

        this._realTime += (now - this._frameTime);
        while(this._tickTime < this._realTime) {

            if (this._startTime === -1) {
                this.broadcast(network.Game.STARTED, []);
                this._startTime = Date.now();
                this.emit('game.start');
            }

            // Sync clients
            if (this._tickCount % this._syncRate === 0) {
                this.broadcast(network.Game.TICK, this._tickCount % 250);
            }

            // Check for players who timed out
            this._players.each(function(player) {

                if (!player.isNeutral() && !player.getClient()) {

                    var idle = Date.now() - player._disconnectTime;
                    if (idle > this._playerTimeout) {
                        player.leave(true);
                    }

                }

            }, this);

            // Tick logic, this is synced with clients so that all
            // messages that leave the server will be processed at the same
            // tick as the events were processed here
            if (this._tickCount % this._logicRate === 0) {
                this.emit('game.tick', this._tickTime, this._tickCount);
            }

            this._tickCount++;
            this._randomState = this._tickCount;
            this._tickTime += this._tickRate;

        }

        if (this._players.length === 0) {
            this.stop();
        }

        this._frameTime = now;

    },

    stop: function() {

        if (!this._isRunning) {
            return;
        }

        this._isRunning = false;
        clearInterval(this._tickInterval);

        this.emit('game.end');

        this._players.each(function(player) {
            player.leave();
        });

        this._players.clear();
        this._clients.clear();

        this.broadcast(network.Game.ENDED, []);
        this._server.removeGame(this);

    },

    // Getters ----------------------------------------------------------------
    // ------------------------------------------------------------------------
    getRandom: function() {
        this._randomState = (1103515245 * (this._randomState + this._randomSeed) + 12345) % 0x100000000;
        return this._randomState / 0x100000000;
    },

    getPlayers: function() {
        return this._players;
    },

    getClients: function() {
        return this._clients;
    },

    /** {Number} Returns the current game tick. */
    getTick: function() {
        return this._tickCount;
    },

    /** {Boolean} True if the game is running */
    isRunning: function() {
        return this._isRunning;
    },

    /** TODO: Add Description */
    canBeJoined: function() {
        return true; // !this.isRunning()
    },

    // Client -----------------------------------------------------------------
    // ------------------------------------------------------------------------
    addClient: function(client, watching) {

        // Notify others
        this.broadcast(network.Game.Client.JOINED, client.toMessage(), [client]);

        // Send list of clients to new one
        var tick = this.getTick();
        client.send(network.Game.Client.LIST, tick, this._clients.map(function(cl) {
            return cl.toMessage(client === cl);
        }));

        // Send game settings down to the new client
        client.send(network.Game.SETTINGS, tick, {

            id: this.id,
            tickRate: this._tickRate,
            logicRate: this._logicRate,
            syncRate: this._syncRate,
            randomSeed: this._randomSeed

        });

        // Do this BEFORE sending out the tick
        if (this.isRunning()) {
            client.send(network.Game.STARTED, tick, []);
        }

        // Sync all clients game ticker (so random is "synced" too)
        this.broadcast(network.Game.TICK, tick % 250);

        client.send(network.Client.Game.JOINED, tick, {
            id: this.id
        });


        // Add player or re-connect client to one
        if (!watching) {

            // Figure out if we can/should reconnect the player
            var that = this;
            function reconnect(player) {

                if (!player.getClient() && player.getHash() === client.getHash()) {

                    that.emit('client.join', client, true);

                    player.connect(client, true);
                    client.updateHash();
                    return true;

                }

            }

            if (!this._players.each(reconnect)) {

                if (!this._players.full()) {

                    this.emit('client.join', client, false);

                    var player = new this._playerClass(this, client.uid, false);
                    this._players.add(player);
                    player.connect(client);
                    this.emit('player.join', client);

                } else {
                    // TODO emit event
                    client.error(network.Game.FULL, this._maxPlayers);
                }

            }

        }

        client.send(network.Game.Player.LIST, tick, this._players.map(function(player) {
            return player.toMessage(client.getPlayer() === player);
        }));

    },

    removeClient: function(client, disconnect) {

        // Mark the player as disconnected
        if (disconnect && client.getPlayer()) {

            this.emit('client.leave', client, true);
            this.emit('player.leave', client.getPlayer(), true);
            client.getPlayer().disconnect();

        // Send out leave message to other clients
        // Leaving the actual game is done by the player
        } else {

            this.emit('client.leave', client, false);

            // TODO break up relationship and use something else. A Map?
            if (client.getPlayer()) {
                this.emit('player.leave', client.getPlayer(), false);
                client.getPlayer().leave();
            }

        }

        this.broadcast(network.Game.Client.LEFT, client.toMessage(), [client]);

        if (this._players.length === 0) {
            this.stop();
        }

    },

    /**
      * {String} Returns a string based represenation of the object.
      */
    toString: function() {
        return '#' + this.id + ' @ ' + this._tickCount;
    },

    /**
      * {Object} Returns a network represenstation of the object.
      */
    toMessage: function() {

        return {
            id: this.id,
            players: this._players.length,
            maxPlayers: this._maxPlayers
        };

    },

    /**
      * Broadcasts the given @msg {Object|Array} with the @type {Integer} to
      * all players except for those in the @exclude {Array}
      */
    broadcast: function(type, msg, exclude) {

        // Add the tick to the message
        if (type !== network.Game.TICK) {

            if (msg instanceof Array) {
                msg.unshift(this._tickCount);

            } else {
                msg.tick = this._tickCount;
            }

            this._server.broadcast(type, msg, this._clients, exclude);

        // Send tick updates
        } else {
            this._server.broadcast(null, msg, this._clients, exclude);
        }

    }

});

module.exports = ServerGame;

