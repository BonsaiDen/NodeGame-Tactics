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
var Game = Class(function(client) {

    ClientGame.init(this, client);
    //this.on('start', this.start);
    //this.on('draw', this.draw);
    //this.on('tick', this.tick);
    //this.on('end', this.end);

    this.on('join', function() {
        console.log('joined game');
    });

    this.on('player.join', function(player, re) {
        console.log('player ', player, 'joined game', re);
    });

    this.on('player.leave', function(player) {
        console.log('player ', player, 'left game');
    });

    this.on('client.join', function(client) {
        console.log('client ', client, 'joined game');
    });

    this.on('client.leave', function(client) {
        console.log('client ', client, 'left game');
    });

}, ClientGame, {

    events: [

        'network.open',
        'network.close',
        'network.error',

        'server.settings',
        'server.game.list',

        'game.settings',
        'game.start',
        'game.end',
        'game.join',
        'game.leave'

    ],

    start: function(msg) {
        ClientGame.start(this, msg);
        console.log('Started');
    },

    render: function(t, tick) {

    },

    tick: function(t, tick) {
        //console.log('Ended');
    },

    end: function() {
        ClientGame.end(this);
        console.log('ended')
    }

});

