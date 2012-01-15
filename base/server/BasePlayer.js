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
var Class = require('../lib/Class'),
    network = require('..//network'),
    util = require('../util');

/**
  * {BasePlayer} Create a new player for the given @game {Game}.
  *
  * @id {Integer} The ID this player should use for identification
  * @neutral {Boolean?} is special flag
  *
  * #constructor
  */
var BasePlayer = Class(function(game, id, neutral) {

    this.id = id;
    this._game = game;
    this._isNeutral = neutral || false;

}, {

    /**
      * Conencts the given @client {Client} with this player.
      *
      * If @reconnect {Boolean} is `true` when a disconnected client re-joins
      * a game in time.
      */
    connect: function(client, reconnect) {

        this._client = client;
        this._client.setPlayer(this);
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

        util.log(this, reconnect ? 'Re-Connected' : 'Connected');

    },


    // Handler ----------------------------------------------------------------
    // ------------------------------------------------------------------------

    /**
      * Disconnect this player from the server and it's client.
      */
    disconnect: function() {

        this._hash = this._client.getHash();
        this._client.setPlayer(null);
        this._client = null;
        this._disconnectTime = Date.now();

        util.log(this, 'Disconnected');

    },

    /**
      * Make this player leave his current game.
      *
      * @timeout {Boolean} is `true` in case the player timed out and did not
      * leave the game on purpose.
      */
    leave: function(timeout) {

        if (this._client) {

            // Notify the client itself that he left the game
            this._client.send(network.Client.Game.LEFT, this._game.getTick(), {
                id: this.id
            });

            this._client.setPlayer(null);
            this._game.getClients().remove(this._clients);
            this._client = null;
        }

        // Notify other players about the leave
        this._game.broadcast(network.Game.Player.LEFT, {
            id: this.id

        }, [this._client]);


        // Remove player from game
        this._game.getPlayers().remove(this);
        this._game = null;

        util.log(this, 'Left');

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
        return 'BasePlayer #' + this.id + ' | ' + this._game;
    }

});

module.exports = BasePlayer;

