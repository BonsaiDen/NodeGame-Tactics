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
var Class = require('../base/lib/Class'),
    ServerGame = require('../base/ServerGame'),
    network = require('../base/network'),
    util = require('../base/util');


// Game Class -----------------------------------------------------------------
// ----------------------------------------------------------------------------
var Game = Class(function(server, id, maxPlayers, playerTimeout) {

    ServerGame.init(this, server, id, maxPlayers, playerTimeout);

    this.on('game.start', this.start);
    this.on('game.tick', this.tick);
    this.on('game.end', this.end);

    this.on('client.message', this.clientMessage);

}, {

    start: function() {
        ServerGame.start(this);
        util.log(this, 'Started at', util.time(this._startTime), 'tick rate is '
                      + this._tickRate + 'ms');
    },

    tick: function(t, tick) {
        console.log(t, tick, this.getRandom());
    },

    end: function() {
        util.log(this, 'Ended at', util.time(Date.now()), ' was running for '
                      + util.time(Date.now() - this._startTime)
                      + 'ms (' + this._tickCount + ' ticks)');
    },

    clientMessage: function(client, msg) {
        util.log(this, 'Client message', msg);
    },

    toString: function() {
        return 'Tactics #' + this.id + ' @ ' + this.getTick();
    }

}, ServerGame);

module.exports = Game;

