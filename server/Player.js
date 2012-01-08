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


// Game Server Player ---------------------------------------------------------
// ----------------------------------------------------------------------------
var Player = Class({

    /**
      * {Player} Create a new player for the given @game {Game}.
      *
      * @id {Integer} The ID this player should use for identification
      * @neutral {Boolean?} is special flag
      *
      * #constructor
      */
    constructor: function(game, id, neutral) {
        this.id = id;
        this._game = game;
        this._isNeutral = neutral || false;
    },

    /**
      * Conencts the given @client {Client} with this player.
      *
      * If @reconnect {Boolean} is `true` when a disconnected client re-joins
      * a game in time.
      */
    connect: function(client, reconnect) {

        this._client = client;
        this._client.player = this;
        this.cid = this._client.uid;

        this._hash = null;
        this._disconnectTime = -1;

        var type = reconnect ? network.Game.Player.REJOINED
                             : network.Game.Player.JOINED;

        this._game.broadcast(type, {
            id: this.id,
            cid: this.cid,
            neutral: this._isNeutral

        }, [this._client]);

        log(this, reconnect ? 'Re-Connected' : 'Connected');

    },


    // Handler ----------------------------------------------------------------
    // ------------------------------------------------------------------------

    /**
      * Handle for when a player's client gets disconnected from the server.
      */
    onDisconnect: function() {

        this._hash = this._client.getHash();
        this._client.player = null;
        this._client = null;
        this._disconnectTime = Date.now();

        log(this, 'Disconnected');

    },

    /**
      * Handler for when a player leaves a game.
      *
      * @timeout {Boolean} is `true` in case the player timed out and did not
      * leave the game on purpose.
      */
    onLeave: function(timeout) {

        if (this._client) {
            this._client.player = null;
            this._client = null;
        }

        this._game.broadcast(network.Game.Player.LEFT, {
            id: this.id

        }, [this._client]);

        log(this, 'Left');

    },

    /**
      * Handles for when a player receives a custom message from its client.
      */
    onMessage: function(msg) {

    },


    // Getter -----------------------------------------------------------------
    // ------------------------------------------------------------------------
    getHash: function() {
        return this._hash;
    },

    setHash: function(hash) {
        this._hash = hash;
    },

    getClient: function() {
        return this._client;
    },

    isNeutral: function() {
        return this._isNeutral;
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
            id: this.id,
            cid: this.cid,
            neutral: this._isNeutral
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
        return 'Player #' + this.id + ' | ' + this._game;
    }

});

exports.Player = Player;

