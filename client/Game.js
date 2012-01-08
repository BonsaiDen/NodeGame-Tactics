/**
  * Basic Game class.
  */
var Game = Class(Client, {

    constructor: function(updateFps, renderFps) {
        Super(updateFps, renderFps);
    },

    start: function() {
        Super.start();
    },

    draw: function(t, tick) {

    },

    tick: function(t, tick) {
        console.log(t, tick, this.getRandom());
    }

});

