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
var Twist = Class({

    $: {
        defaultUpdateFps: 30,
        defaultRenderFps: 60
    },

    /**
      * {Twist} A game loop with two distinct timers for decoupled
      * @updateFps {Integer} and @renderFps {Integer} rates.
      */
    constructor: function(updateFps, renderFps) {

        this._currentFps = {};
        this._currentLoad = {};

        this._reset();
        this.setFps(updateFps || Twist.defaultUpdateFps,
                    renderFps || Twist.defaultRenderFps);

        this._frameCap = false;
        this._intervalId = -1;
        this._useAverage = true;

    },

    /**
      * {Boolean} Starts the game loop and returns `true` in case it wasn't
      * already running
      *
      * In case it's desired to sync the drawing with a specific {HTMLElement},
      * supply it via @element {HTMLElement}.
      */
    start: function(element) {

        if (this._isRunning) {
            return false;
        }

        var that = this;
        element = element || document.body;

        // High resolution ticker based on requestAnimationFrame
        function frameTick() {

            // Drop out in case we're not running anymore
            if (!that._isRunning) {
                return;
            }

            that._lastFrameTime = Date.now();
            that._tick(true);
            window.twistAnimationFrame(frameTick, element);

        }

        // Handle the low resolution ticker which makes
        // sure that we don't loose to much game state in cases
        // where the browser throttles requestAnimationFrame
        function intervalTick() {

            // Drop out in case we're not running anymore
            if (!that._isRunning) {
                return;
            }
            // Ensure that the updates keep being performed in cases where requestAnimationFrame is throttled
            if (Date.now() - that._lastFrameTime > that._tickDuration) {
                that._tick();
            }


            // Save the current fps
            that._currentFps.update = that._average(that._averages.fps.update, that._updateCount * 2);
            that._currentFps.render = that._average(that._averages.fps.render, that._renderCount * 2);
            that._updateCount = 0;
            that._renderCount = 0;

        }

        // Reset
        this._reset();
        this._isRunning = true;

        var now = Date.now();
        this._lastTickTime = now;
        this._lastFrameTime = now;

        // Init ticking
        frameTick();
        intervalTick();
        this._intervalId = setInterval(intervalTick, 500);

        return false;

    },

    /**
      * Increases the pause counter.
      *
      * When the pause counter is greater than 0, the time is
      * paused and only render will be performed per second.
      */
    pause: function() {
        this._pauseCount++;
    },

    /**
      * Decreases the pause counter.
      *
      * When the pause counter is greater than 0, the time is
      * paused and only render will be performed per second.
      */
    resume: function() {
        this._pauseCount = Math.max(this._pauseCount - 1, 0);
    },

    /**
      * {Boolean} Stops the loop in case it is running, true is returned
      * in case this call stopped the loop.
      */
    stop: function() {

        if (!this._isRunning) {
            return false;
        }

        this._reset();
        clearInterval(this._intervalId);
        this._intervalId = -1;

        return true;

    },


    // Getter / Setter --------------------------------------------------------


    /** {Boolean} Returns `true` in case the loop is running. */
    isRunning: function() {
        return this._isRunning;
    },

    /** {Boolean} Returns whether or not the time is currently paused. */
    isPaused: function() {
        return this._pauseCount > 0;
    },

    /**
      * Set the desired maximum frame rate for the update and render loop.
      *
      * @updateFps {Number} The desired logic updates per second.
      * @renderFps {Number} The desired renderings per second.
      */
    setFps: function(updateFps, renderFps) {

        this._updateFps = updateFps;
        this._renderFps = renderFps;

        // We ceil / floor here so that we ensure the desired framerate in the
        // case that we're cappping
        this._updateDuration = Math.ceil(1000 / updateFps);
        this._renderDuration = Math.floor(1000 / renderFps);
        this._tickDuration = Math.max(this._updateDuration, this._renderDuration);

    },

    /**
      * {Object} Returns the fps for the last second.
      *
      *     { update: {Number}, render: {Number} }
      *
      */
    getFps: function() {
        return this._currentFps;
    },

    /**
      * {Object} Returns the load factor for the last second.
      *
      *     { update: {Number}, render: {Number} }
      *
      */
    getLoad: function() {
        return this._currentLoad;
    },

    /**
      * {Number} Returns current update time in milliseconds.
      *
      * Resolution is dependent on the frame rate unless @smooth {Boolean}
      * is `true`.
      */
    getTime: function(smooth) {
        return smooth ? this._passedUpdateTime : this._updateTime;
    },


    // Abstract methods -------------------------------------------------------

    /**
      * The update callback.
      *
      * @t {Integer} is the current update time.
      *
      * #abstract
      */
    update: function(t) {

    },

    /**
      * The render callback.
      *
      * @t {Integer} is the current render time,
      * @dt {Integer} the time passed since the last call to {Twist#update}.
      * And @u {Float} is a represensation of @dt in the range of `0...1`
      *
      * #abstract
      */
    render: function(t, dt, u) {

    },

    // Private Methods --------------------------------------------------------
    _reset: function() {

        this._lastFrameTime = 0;
        this._lastTickTime = 0;
        this._tickDuration = 0;

        this._isRunning = false;
        this._pauseCount = 0;

        this._updateCount = 0,
        this._updateTime = 0;
        this._passedUpdateTime = 0;
        this._updateError = 0;

        this._renderCount = 0;
        this._renderTime = 0;
        this._passedRenderTime = 0;

        this._currentFps.update = 0;
        this._currentFps.render = 0;

        this._averages = {

            load: {
                update: [],
                render: []
            },

            fps: {
                update: [],
                render: []
            }

        };

        this._averageTick = 0;
        this._averageScale = 5;

        this._currentLoad.update = 0;
        this._currentLoad.render = 0;

    },

    _average: function(average, value) {

        average[this._averageTick % this._averageScale] = value;

        var a = 0;
        for(var i = 0; i < this._averageScale; i++) {
            a += average[i] !== undefined ? average[i] : 0;
        }

        return Math.round((a / this._averageScale) * 100) / 100;

    },

    _tick: function() {

        var beforeTick = Date.now(),
            diff = beforeTick - this._lastTickTime,
            usedUpdate;

        // Increase game time, but limit it to 2000ms at once
        // this prevents hard freezes due to many many frames being
        // updates at once
        if (this._pauseCount === 0) {
            this._passedUpdateTime += Math.min(diff, 2000);
            this._passedRenderTime += Math.min(diff, 2000);
        }

        while(this._updateTime < this._passedUpdateTime) {

            // Limiting the update rate might be bad in case you're running a
            // physics simulation.
            if (!this._frameCap || this._updateCount < this._updateFps) {
                this.update(this._updateTime, this._updateDuration);
                this._updateCount++;
            }

            this._updateTime += this._updateDuration;

        }

        usedUpdate = Date.now() - beforeTick;

        // Render Fps handling
        var oldRenderTime = this._renderTime,
            beforeRender,
            usedRender;

        while(this._renderTime < this._passedRenderTime) {
            this._renderTime += this._renderDuration;
        }

        // Only render in case its actually necessary
        beforeRender = Date.now();
        if ((this._renderTime > oldRenderTime || this._pauseCount !== 0)
            && this._renderCount < this._renderFps) {

            var rdt = this._renderTime - this._updateTime;
            this.render(this._renderTime, rdt, rdt / this._updateDuration);
            this._renderCount++;

        }

        usedRender = Date.now() - beforeRender;

        // Calculate the load
        this._currentLoad.update = this._average(this._averages.load.update, usedUpdate <= 0 ? 0 : usedUpdate / this._updateDuration);
        this._currentLoad.render = this._average(this._averages.load.render, usedRender <= 0 ? 0 : usedRender / this._renderDuration);

        if (this._averageTick++ > this._averageScale) {
            this._averageTick = 0;
        }

        // Make sure the interval is somewhat stable
        var used = Date.now() - beforeTick;
        this._lastTickTime = beforeTick - used;

    }

});


window.twistAnimationFrame = (function() {

    return window.requestAnimationFrame || window.webkitRequestAnimationFrame ||
           window.mozRequestAnimationFrame || window.oRequestAnimationFrame ||
           window.msRequestAnimationFrame || function(callback, element) {
               window.setTimeout(callback, 1000 / 60);
           };

})();

