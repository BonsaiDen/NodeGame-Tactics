// Imports
if (typeof window === 'undefined') {
    var Class = require('./Class');
}

/**
  * {Emitter} Minimal event emitter interface, with parents.
  */
var Emitter = Class(function(group, parent) {

    this.__events = {};
    this.__eventGroup = group;
    this.__eventParent = parent;

}, {

    /**
      * {Function} Bind a @callback {Function} for any event with the @name {String}
      * in the optional @scope {Object?} and return the @callback.
      *
      * In case @once {Boolean} is set, the callback will be unbound after it has
      * been fired once.
      */
    on: function(name, callback, scope, once) {

        var events = null;
        if (!(events = this.__events[name])) {
            events = this.__events[name] = [];
        }

        events.push({
            callback: callback,
            scope: scope || this,
            once: once,
            fired: false
        });

        return callback;

    },

    /**
      * Like {Emitter#on} but will only fire once and then get removed.
      */
    once: function(name, callback, scope) {
        return this.on(name, callback, scope, true);
    },

    /**
      * Emits the event @name {String} with the params @arguments {Arguments}
      */
    emit: function(name) {

        var id = name;

        // Go up to parent
        if (this.__eventParent) {

            // Add in this object to the arguments list
            var args = Array.prototype.slice.call(arguments);
            args[0] = this;
            args.unshift(this.__eventGroup + '.' + id);

            if (this.__eventParent.emit.apply(this.__eventParent, args)) {
                return true;
            }

        }

        var events = this.__events[id],
            stopped = false;

        if (events) {

            var call = Function.prototype.call;

            // Create a shallow copy to protect against unbinds
            // from within the callbacks
            var sliced = events.slice();
            for(var i = 0, l = sliced.length; i < l; i++) {

                var event = events[i];
                if (!event.once || !event.fired) {

                    event.fired = true;

                    // Doing this trick so we don't need to slice anything
                    arguments[0] = event.scope || this;
                    stopped = call.apply(event.callback, arguments) || stopped;

                }

                if (event.once) {
                    events.splice(i, 1);
                    i--;
                    l--;
                }

            }

        }

        return stopped;

    },

    /**
      * {Integer} If the first argument is a {Function} all events for the given function
      * will be unbound. If only @name {String} is set, all callbacks for the
      * given event will be removed. If both parameters are set, they'll act
      * as a filter.
      *
      * Returns the number of unbound callbacks.
      */
    unbind: function(name, func) {

        if (typeof name === 'function') {
            name = null;
            func = name;
        }

        var count = 0;
        if (name) {

            if (func) {

                var events = this.__events[name];
                if (events) {

                    for(var i = 0, l = events.length; i < l; i++) {

                        if (events[i].callback === func) {
                            events.splice(i, 1);
                            i--;
                            l--;
                        }

                    }

                }

            } else {
                count = this.__events[name];
                delete this.__events[name];
            }

        } else {

            for(var e in this.__events) {
                if (this.__events.hasOwnProperty(e)) {
                    this.unbind(e, func);
                }
            }

        }

    }

});

// Exports
if (typeof window === 'undefined') {
    module.exports = Emitter;
}

