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
var HashList = need('shared.lib.HashList'),
    Player = need('server.Player'),
    network = need('shared.network');


// Server Game Class ----------------------------------------------------------
// ----------------------------------------------------------------------------
var Game = Class({

    constructor: function(server, id, maxPlayers, timeout) {

        this.id = id;
        this._server = server;

        // Players
        this._maxPlayers = maxPlayers || 6;
        this._players = new HashList(maxPlayers);
        this._clients = new HashList();
        this._timeout = timeout || 1000;

        // Ticking
        this._tickTime = 0;
        this._tickRate = 66;
        this._tickCount = 1;
        this._tickInterval = null;

        // Game Time
        this._startTime = -1;
        this._realTime = 0;
        this._frameTime = Date.now();

        this._randomSeed = 500000 + Math.floor((Math.random() * 1000000));
        this._randomState = 0;
        this._logicRate = 15;
        this._syncRate = 30;

        // Start game loop
        var that = this;
        this._tickInterval = setInterval(function() {
            that._tick();

        }, this._tickRate);

        log(this, 'Created');

    },


    // Main Game loop ---------------------------------------------------------
    _tick: function() {

        var now = Date.now();

        this._realTime += (now - this._frameTime);
        while(this._tickTime < this._realTime) {

            if (this._startTime === -1) {
                this._startTime = Date.now();
                this.start();
            }

            // Sync clients
            if (this._tickCount % this._syncRate === 0) {
                this.broadcast(network.Game.TICK, [this._tickCount]);
            }

            // Check for players who timed out
            this._players.each(function(player) {

                if (!player.isNeutral() && !player.getClient()) {

                    var idle = Date.now() - player._disconnectTime;
                    if (idle > this._timeout) {

                        player.onLeave(true);
                        this._players.remove(player);

                    }

                }

            }, this);

            // Check whether to stop this game

            // Tick logic!
            if (this._tickCount % this._logicRate === 0) {

                if (this.tick(this._tickTime, this._tickCount) === true) {
                    this._stop();
                    break;
                }

            }

            this._tickCount++;
            this._randomState = this._tickCount;
            this._tickTime += this._tickRate;

        }

        if (this._players.length === 0) {
            this._stop();
        }

        this._frameTime = now;

    },

    _stop: function() {

        this.stop();

        clearInterval(this._tickInterval);

        this._players.each(function(player) {
            player.onLeave();
        });

        this._players.clear();

        this._clients.each(function(client) {
            client.onLeave();
        });

        this._clients.clear();

        this._server.removeGame(this);
        log(this, 'Ended');

    },


    // Game Logic -------------------------------------------------------------
    // ------------------------------------------------------------------------
    start: function() {
        log(this, 'Started at', time(this._startTime), 'tick rate is '
                   + this._tickRate + 'ms');
    },

    tick: function(t, tick) {
        log(this, t, tick, this.getRandom());
    },

    stop: function() {
        log(this, 'Stopped at', time(Date.now()), ' was running for '
                   + time(Date.now() - this._startTime)
                   + 'ms (' + this._tickCount + ' ticks)');
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


    // Client -----------------------------------------------------------------
    // ------------------------------------------------------------------------
    clientJoin: function(client, watching) {

        log(this, 'Client joined', watching);
        this._clients.add(client);

        // Notify others
        this.broadcast(network.Game.Client.JOINED, client.toMessage(), [client]);

        // Send list of clients to new one
        client.send(network.Game.Client.LIST, this._clients.map(function(cl) {
            return cl.toMessage(client === cl);
        }));

        // Sync all clients game ticker (so random is "synced" too)
        this.broadcast(network.Game.TICK, [this._tickCount]);

        // Send game settings down to the new client
        client.send(network.Client.Game.JOINED, {
            id: this.id,
            tickRate: this._tickRate,
            logicRate: this._logicRate,
            syncRate: this._syncRate,
            randomSeed: this._randomSeed
        });

        // Add player or re-connect client to one
        if (!watching) {

            // Figure out if we can/should reconnect the player
            function reconnect(player) {

                console.log('recon', player.getHash(), client.getHash())
                if (!player.getClient() && player.getHash() === client.getHash()) {
                    player.connect(client, true);
                    client.updateHash();
                    return true;
                }

            }

            if (!this._players.each(reconnect)) {

                if (!this._players.full()) {

                    var player = new Player(this, client.uid, false);
                    this._players.add(player);
                    player.connect(client);

                } else {
                    client.error(network.Game.FULL, this._maxPlayers);
                }

            }

        }

        client.send(network.Game.Player.LIST, this._players.map(function(player) {
            return player.toMessage(client.player === player);
        }));

    },

    clientMessage: function(client, msg) {

        log(this, 'Client message:', msg);

        if (client.player) {
            client.player.message(msg);
        }

    },

    clientLeave: function(client, disconnect) {

        // Mark the player as disconnected
        if (disconnect && client.player) {
            log(this, 'Client disconnected');
            client.player.onDisconnect();

        // Send out leave message to other clients
        // Leaving the actual game is done by the player
        } else {

            log(this, 'Client left');
            this.broadcast(network.Game.Client.LEFT, client.toMessage(), [client]);

            // TODO break up relationship and use something else. A Map?
            client.player.onLeave();
        }

        this._clients.remove(client);

        if (this._players.length === 0) {
            this._stop();
        }

    },

    /**
      * {String} Returns a string based represenation of the object.
      */
    toString: function() {
        return 'Game #' + this.id;
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

        if (exclude) {
            this._server.broadcast(type, msg, exclude, true);

        } else {
            this._server.broadcast(type, msg, this._clients);
        }

    },

    /**
      * {Number} Returns the current game tick.
      */
    getTick: function() {
        return this._tickCount;
    }

});

exports.Game = Game;

