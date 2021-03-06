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
var lib = require('../lib'),
    HashList = require('../lib/HashList'),
    Class = require('../lib/Class'),
    BISON = require('../lib/bison'),
    Logger = require('../lib/Logger'),
    network = require('../network'),
    assert = require('../lib/assert'),
    crypto = require('crypto');


// Game Server Client ---------------------------------------------------------
// ----------------------------------------------------------------------------
var Client = Class(function(server, conn, hash) {

    Logger.init(this, 'Client');

    this._server = server;
    this._conn = conn;
    this._session = conn.session;

    // IDs
    this.id = this._conn.id;
    this.uid = ++Client.$id;

    // State
    this._hash = hash;
    this._name = this._session.user.name;
    this._game = null;
    this._player = null;

    // Send intitial hash
    if (this._hash === '') {
        this.updateHash();
    }

    this.log('Connected');

    // Send intitial network data and game list
    this.send(network.Client.CONNECT, 0, {});
    this._server.sendGameList(this);

}, Logger, {

    $id: 0,

    updateHash: function() {

        var hash = crypto.createHash('md5');
        hash.update(Date.now() + '-' + this.id + '-' + this.uid);
        this._hash = hash.digest('hex');

        this.send(network.Client.HASH, 0, {
            hash: this._hash
        });

    },

    close: function() {

        if (this._game) {
            this.leaveGame(true);
        }

        this._conn.close();
        this.log('Disconnected');

    },

    /**
      * Makes the client join the game with the id @gid {Number}.
      *
      * In case @watching {Boolean} is `true` he will not be actively playing.
      */
    joinGame: function(gid, watching) {

        // Already in this game?
        if (this._game && gid === this._game.id) {
            this.error(network.Error.SAME_GAME, gid);
            return;

        // In case we're in another game, leave that one first
        } else if (this._game) {
            this.leaveGame();
        }

        // Did we find the requested game?
        var game = this._server.getGame(gid);
        if (typeof game !== 'string' && game !== undefined) {

            assert(this._game === null);
            this._game = game;
            this._game.addClient(this, watching);

            this.log('Joined game #' + gid + (watching ? ' (watching)' : ''));

        } else {
            this.error(network.Error.INVALID_GAME, game);
        }

    },

    /**
      * Makes the client leave his current game.
      */
    leaveGame: function(remote) {
        this._game.removeClient(this, remote || false);
        this.log('Left game #' + this._game.id);
        this._game = null;
    },

    /**
      * {Integer} Sends the given @msg {Object|Array} with the @type {Integer}
      * to the client via bison encoding.
      *
      * Returns the number of bytes send over the network for the message.
      */
    send: function(type, tick, msg) {

        if (msg instanceof Array) {
            msg.unshift(tick);
            msg.unshift(type);

        } else {
            msg.type = type;
            msg.tick = tick;
        }

        return this._conn.send(BISON.encode(msg));

    },

    /**
      * {Integer} Sends the given plain @msg {String} to this client.
      *
      * Returns the number of bytes send over the network for the message.
      */
    sendPlain: function(msg) {
        return this._conn.send(msg);
    },

    error: function(type, detail) {

        this._conn.send(BISON.encode({
            type: network.ERROR,
            error: type,
            detail: detail
        }));

    },

    // Handler ----------------------------------------------------------------
    onMessage: function(msg) {

        msg.type = msg.type !== undefined ? msg.type : msg[0];

        if (msg.type === network.Client.Game.JOIN) {

            // TODO do not allow joining of running games with canBeJoined()
            this.joinGame(msg.game || 0, msg.watch || false);

        } else if (msg.type === network.Client.Game.LEAVE) {

            if (this._game) {
                this.leaveGame();
            }

        } else if (this._game) {

            if (this._game.emit('client.message', this, msg) !== true) {

                if (this.getPlayer()) {
                    this.getPlayer().emit('message', msg);
                }

            }

        }

    },


    // Getter -----------------------------------------------------------------
    // ------------------------------------------------------------------------
    getHash: function() {
        return this._hash;
    },

    getPlayer: function() {
        return this._player;
    },

    setPlayer: function(player) {

        if (player !== null) {
            assert(this._player === null);

        } else {
            assert(this._player !== null);
        }

        this._player = player;

    },

    getSession: function() {
        return this._session;
    },

    /**
      * {Object} Returns a network represenstation of the object.
      *
      * If @local {Boolean} is `true`, additional data will be included which
      * should only be seen by the player which this object belongs to.
      */
    toMessage: function(local) {

        var msg = {
            id: this.uid,
            name: this._name,
            local: local
        };

        return msg;

    },

    /**
      * {String} Returns a string based represenation of the object.
      */
    toString: function() {
        return this.id + ':' + this.uid + ' (' + this._name
                + ') | #' + (this._game ? this._game.id : '-');
    }

});

module.exports = Client;

