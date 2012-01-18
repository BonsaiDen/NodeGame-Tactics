// Imports
if (typeof window === 'undefined') {
    var Class = require('./Class');
}


/**
  * {Logger} Minimal logging interface.
  */
var Logger = Class(function(name) {
    this._logName = name;

}, {

    log: function() {

        var msg = Array.prototype.slice.call(arguments, 0);
        msg.unshift('[' + this._logName + ' ' + this + ']:');
        console.log.apply(console, msg);

    }

});

// Exports
if (typeof window === 'undefined') {
    module.exports = Logger;
}

