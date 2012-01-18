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

/*global Emitter, Class, HashList, Client, assert */


// Client Game ----------------------------------------------------------------
// ----------------------------------------------------------------------------
Client.Game = Class(function(client, playerClass) {

    Emitter.init(this, 'game', client);

    this._client = client;
    this._playerClass = playerClass || Client.Player;

    this._players = new HashList();
    this._clients = new HashList();

}, Emitter, {

    // Basic setup / teardown methods -----------------------------------------
    // ------------------------------------------------------------------------
    start: function(msg) {
        this.emit('start', msg);
    },

    tick: function(t, tick) {

    },

    render: function(t, tick) {

    },

    end: function(msg) {
        this.emit('end', msg);
        this._players.clear();
        this._clients.clear();
    },


    // Setters ----------------------------------------------------------------
    addClient: function(id, name, local) {

        var client = {
            id: id,
            name: name,
            player: null,
            local: local
        };

        assert(this._clients.add(client));
        this.emit('client.join', client);

    },

    removeClient: function(id) {

        var client = this._clients.get(id);
        assert(this._clients.remove(client));

        if (client.player) {
            client.player.setClient(null);
        }

        this.emit('client.leave', client);

    },

    addPlayer: function(id, clientId, isNeutral, isLocal, reconnect) {

        var player = new this._playerClass(this, id, isNeutral, isLocal);
        assert(this._players.add(player));
        player.setClient(this._clients.get(clientId));
        player.join(reconnect);

    },

    removePlayer: function(id) {

        var player = this._players.get(id);
        assert(this._players.remove(player));
        player.setClient(null);
        player.leave();

    },


    // Getters ----------------------------------------------------------------
    getRandom: function() {
        return this._client.getRandom();
    },

    getTime: function() {
        return this._client.getTime();
    },

    getTick: function() {
        return this._client.getTick();
    },

    getClient: function(id) {
        return this._clients.get(id);
    },

    getClients: function() {
        return this._client.getClients();
    },

    getPlayer: function(id) {
        return this._players.get(id);
    },

    getPlayers: function() {
        return this._client.getPlayers();
    }

});

