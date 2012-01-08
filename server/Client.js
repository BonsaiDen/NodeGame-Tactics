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
    crypto = require('crypto');


// Game Server Client ---------------------------------------------------------
// ----------------------------------------------------------------------------
var Client = Class({

    $: {
        id: 0
    },

    constructor: function(server, conn, msg) {

        this._server = server;
        this._conn = conn;

        // IDs
        this.id = this._conn.id;
        this.uid = ++Client.id;

        // State
        this._hash = msg.hash;
        this._name = msg.name;
        this._game = null;

        // Send intitial hash
        if (this._hash === '--------------------------------') {
            this.updateHash();
        }

        log(this, 'Connected');

        // Send intitial network data and game list
        this.send(network.Client.CONNECT, {});
        this.gameList();

    },

    updateHash: function() {

        var hash = crypto.createHash('md5');
        hash.update(Date.now() + '-' + this.id + '-' + this.uid);
        this._hash = hash.digest('hex');

        this.send(network.Client.HASH, {
            hash: this._hash
        });

    },

    gameList: function() {

        this.send(network.Game.LIST, {
            games: this._server.getGames().map(function(game) {
                return game.toMessage();
            })
        });

    },

    close: function() {

        if (this._game) {
            this.leave(true);
        }

        this._conn.close();
        log(this, 'Disconnected');

    },

    /**
      * Makes the client join the game with the id @gid {Number}.
      *
      * In case @watching {Boolean} is `true` he will not be actively playing.
      */
    join: function(gid, watching) {

        log(this, 'Joining game #' + gid)

        // Did we find the requested game?
        var game = this._server.getGame(gid);
        if (typeof game !== 'string' && game !== undefined) {

            this._game = game;
            this._game.clientJoin(this, watching);
            log(this, 'Joined game #' + gid + (watching ? ' (watching)' : ''));

        } else {
            this.error(network.Error.INVALID_GAME, game);
        }

    },

    /**
      * Makes the client leave his current game.
      */
    leave: function(disconnected) {

        log(this, 'Leaving game #' + this._game.id)
        this._game.clientLeave(this, disconnected || false);
        log(this, 'Left game #' + this._game.id);
        this._game = null;

        // Send list of games once again
        this.gameList();

    },

    /**
      * {Integer} Sends the given @msg {Object|Array} with the @type {Integer}
      * to the client via bison encoding.
      *
      * Returns the number of bytes send over the network for the message.
      */
    send: function(type, msg) {

        if (msg instanceof Array) {
            msg.unshift(type);

        } else {
            msg.type = type;
        }

        return this._conn.send(bison.encode(msg));

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

        this._conn.send(bison.encode({
            type: network.ERROR,
            error: type,
            detail: detail
        }));

    },

    // Handler ----------------------------------------------------------------

    onMessage: function(msg) {

        msg.type = msg.type !== undefined ? msg.type : msg[0];

        if (msg.type === network.Client.JOIN_GAME) {

            if (this._game) {
                this.leave();
            }

            this.join(msg.game || 0, msg.watch || false);

        } else if (msg.type === network.Client.LEAVE_GAME) {

            if (this._game) {
                this.leave();
            }

        } else if (this._game) {
            this._game.clientMessage(this, msg);
        }

    },


    // Getter -----------------------------------------------------------------
    // ------------------------------------------------------------------------
    getHash: function() {
        return this._hash;
    },


    // Conversion -------------------------------------------------------------
    // ------------------------------------------------------------------------

    /**
      * {Object} Returns a network represenstation of the object.
      *
      * If @own {Boolean} is `true`, additional data will be included which
      * should only be seen by the player which this object belongs to.
      */
    toMessage: function(own) {

        var msg = {
            id: this.uid,
            name: this._name
        };

        if (own) {
            msg.own = true;
        }

        return msg;

    },

    /**
      * {String} Returns a string based represenation of the object.
      */
    toString: function() {
        return 'Client ' + this.id + ':' + this.uid + ' (' + this._name
                + ') | #' + (this._game ? this._game.id : '-');
    }

});

exports.Client = Client;

