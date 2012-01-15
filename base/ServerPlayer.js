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
    network = require('./network'),
    Logger = require('./lib/Logger');

/**
  * {ServerPlayer} Create a new player for the given @game {Game}.
  *
  * @id {Integer} The ID this player should use for identification
  * @neutral {Boolean?} is special flag
  */
var ServerPlayer = Class(function(game, neutral) {

    Logger.init(this, 'ServerPlayer');

    this.id = +ServerPlayer.$id;
    this._game = game;
    this._client = null;
    this._clientHash = null;
    this._isNeutral = neutral || false;

}, Logger, {

    $id: 0,

    setClient: function(client) {

        if (!client) {
            this._clientHash = this._client.getHash();
            this._client.setPlayer(null);
            this._client = null;
            this._clientDisconnectTime = Date.now();

            this.log('Unbound from client');

        } else {
            this._client = client;
            this._client.setPlayer(this);

            this._clientHash = null;
            this._clientDisconnectTime = -1;

            this.log('Bound to ', client.toString());

        }


    },

    join: function(reconnect) {

        var type = reconnect ? network.Game.Player.REJOINED
                             : network.Game.Player.JOINED;

        this._game.broadcast(type, this.toMessage(), [this._client]);
        this._game.getPlayers().add(this);

        this.log(reconnect ? 'Re-Joined game' : 'Joined Game');

    },

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

        this.log('Left');

    },


    // Getter -----------------------------------------------------------------
    // ------------------------------------------------------------------------
    getClientHash: function() {
        return this._clientHash;
    },

    setClientHash: function(hash) {
        this._clientHash = hash;
    },

    getClient: function() {
        return this._client;
    },

    isNeutral: function() {
        return this._isNeutral;
    },

    getDisconnectedTime: function() {

        // If we're not neutral and don't have a client
        // we'll time out soon
        if (!this.isNeutral() && !this.getClient()) {
            return Date.now() - this._clientDisconnectTime;

        } else {
            return 0;
        }

    },

    /**
      * {Object} Returns a network represenstation of the object.
      *
      * If @own {Boolean} is `true`, additional data will be included which
      * should only be seen by the player which this object belongs to.
      */
    toMessage: function(own) {

        var msg = {
            id: this.id,
            cid: this._client ? this._client.uid : null,
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
        return '#' + this.id + ' | ' + this._game;
    }

});

module.exports = ServerPlayer;

