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

/*global Emitter, Class, assert, ticked */


// Basic client side player ---------------------------------------------------
// ----------------------------------------------------------------------------
ticked.Client.Player = Class(function(game, id, isNeutral, isLocal) {

    this.id = id;
    this._game = game;
    this._isNeutral = isNeutral;
    this._isLocal = isLocal;
    this._client = null;

    Emitter.init(this, 'player', game);

}, Emitter, {

    join: function(reconnect) {
        this.emit('join', reconnect);
    },

    leave: function() {
        this.emit('leave');
    },

    // Getter / Setter --------------------------------------------------------
    setClient: function(client) {

        this._client = client;

        if (client !== null) {
            assert(this._client.player === null);
            this._client.player = this;
        }

    },

    getClient: function() {
        return this._client;
    },

    isNeutral: function() {
        return this._isNeutral;
    },

    isLocal: function() {
        return this._isLocal;
    },

    isRemote: function() {
        return !this._isLocal;
    }

});

