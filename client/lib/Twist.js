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

    constructor: function(updateFps, renderFps) {

        this.__currentFps = {};
        this.__currentLoad = {};
        this.__renderInterpolation = false;

        this.__reset();
        this.setFps(updateFps || 30, renderFps || 60);

        this.__intervalId = -1;
        this.__useAverage = true;

    },

    /**
      *  Set the desired maximum frame rate for the update and render loop.
      *
      *  @param {Number} updateFps The desired logic updates per second.
      *  @param {Number} rendeerFps The desired renderings per second.
      */
    setFps: function(updateFps, renderFps) {

        this.__updateFps = updateFps;
        this.__renderFps = renderFps;

        // We floor here so that we ensure the desired framerate (we're capping)
        this.__updateDuration = Math.ceil(1000 / updateFps);
        this.__renderDuration = Math.floor(1000 / renderFps);
        this.__tickDuration = Math.max(this.__updateDuration, this.__renderDuration);

    },

    /**
      *  Returns the Fps within the last second.
      *
      *  @returns {Object} { update: {Number}, render: {Number} }
      */
    getFps: function() {
        return this.__currentFps;
    },


    /**
      *  Enable or disable the render interpolation
      */
    setRenderInterpolation: function(mode) {
        this.__renderInterpolation = mode;
    },

    /**
      *  Returns the load factor within the last second.
      *
      *  @returns {Object} { update: {Number}, render: {Number} }
      */
    getLoad: function() {
        return this.__currentLoad;
    },

    /**
      *  Returns current update time in milliseconds.
      *
      *  Resolution is dependent on the frame rate unless smooth is set to true.
      *
      *  @param {Boolean} smooth If true, the time has a higher resolution but it
      *                          does not necessarily coresspond to the time passed
      *                          into the "update" function.
      *
      *  @returns {Number} The current update time in milliseconds.
      */
    getTime: function(smooth) {
        return smooth ? this.__passedUpdateTime : this.__updateTime;
    },

    /**
      *  Starts the loop.
      *
      *  In case the loop is already running, you'll have to stop it first.
      *
      *  @param {HTMLElement} element An optional element used for the
      *                               internal window.requestAnimationFrame
      *                               ticker. Default to 'document.body'.
      *
      *  @returns {Boolean} True in case the loop was started.
      */
    start: function(element) {

        if (this.__isRunning) {
            return false;
        }

        var that = this;
        element = element || document.body;

        // High resolution ticker based on requestAnimationFrame
        function frameTick() {

            // Drop out in case we're not running anymore
            if (!that.__isRunning) {
                return;
            }

            that.__lastFrameTime = Date.now();
            that.__tick(true);
            window.requestAnimFrame(frameTick, element);

        }

        // Handle the low resolution ticker which makes
        // sure that we don't loose to much game state in cases
        // where the browser throttles requestAnimationFrame
        var tickIndex = 0;
        function intervalTick() {

            // Drop out in case we're not running anymore
            if (!that.__isRunning) {
                return;
            }
            // Ensure that the updates keep being performed in cases where requestAnimationFrame is throttled
            if (Date.now() - that.__lastFrameTime > that.__tickDuration) {
                that.__tick(tickIndex === 1);
            }

            // Used for ticking updates:render with a 2:1 ratio
//            tickIndex++;
//            if (tickIndex > 1) {

                // Save the current fps
                that.__currentFps.update = that.__average(that.__averages.fps.update, that.__updateCount * 2);
                that.__currentFps.render = that.__average(that.__averages.fps.render, that.__renderCount * 2);
                that.__updateCount = 0;
                that.__renderCount = 0;

                tickIndex = 0;
//            }

        }

        // Reset
        this.__reset();
        this.__isRunning = true;

        var now = Date.now();
        this.__lastTickTime = now;
        this.__lastFrameTime = now;

        // Init ticking
        frameTick();
        intervalTick();
        this.__intervalId = setInterval(intervalTick, 500);

        return false;

    },

    /**
      *  Increases the pause counter.
      *
      *  When the pause counter is greater than 0, the time is
      *  paused and only render will be performed per second.
      *
      *  @returns {Boolean} True in case the called paused the loop.
      */
    pause: function() {
        this.__pauseCount++;
    },

    /**
      *  Decreases the pause counter.
      *
      *  When the pause counter is greater than 0, the time is
      *  paused and only render will be performed per second.
      *
      *  @returns {Boolean} True in case the called unpaused the loop.
      */
    resume: function() {
        this.__pauseCount = Math.max(this.__pauseCount - 1, 0);
    },

    /**
      *  Returns whether or not the time is currently freezed.
      *
      *  @returns {Boolean} True in case the time is standing still.
      */
    isPaused: function() {
        return this.__pauseCount > 0;
    },

    /**
      *  Stops the loop in case it is running.
      *
      *  @returns {Boolean} True in case this call stopped the loop.
      */
    stop: function() {

        if (!this.__isRunning) {
            return false;
        }

        this.__reset();
        clearInterval(this.__intervalId);
        this.__intervalId = -1;

        return true;

    },

    isRunning: function() {
        return this.__isRunning;
    },

    // Private API
    __reset: function() {

        this.__lastFrameTime = 0;
        this.__lastTickTime = 0;
        this.__tickDuration = 0;

        this.__isRunning = false;
        this.__pauseCount = 0;

        this.__updateCount = 0,
        this.__updateTime = 0;
        this.__passedUpdateTime = 0;
        this.__updateError = 0;

        this.__renderCount = 0;
        this.__renderTime = 0;
        this.__passedRenderTime = 0;

        this.__currentFps.update = 0;
        this.__currentFps.render = 0;

        this.__averages = {

            load: {
                update: [],
                render: []
            },

            fps: {
                update: [],
                render: []
            }

        };

        this.__averageTick = 0;
        this.__averageScale = 5;

        this.__currentLoad.update = 0;
        this.__currentLoad.render = 0;

    },

    __average: function(average, value) {

        average[this.__averageTick % this.__averageScale] = value;

        var a = 0;
        for(var i = 0; i < this.__averageScale; i++) {
            a += average[i] !== undefined ? average[i] : 0;
        }

        return Math.round((a / this.__averageScale) * 100) / 100;

    },

    __tick: function(doRender) {

        var beforeTick = Date.now(),
            diff = beforeTick - this.__lastTickTime,
            usedUpdate;

        // Increase game time, but limit it to 2000ms at once
        // this prevents hard freezes due to many many frames being
        // updates at once
        if (this.__pauseCount === 0) {
            this.__passedUpdateTime += Math.min(diff, 2000);
            this.__passedRenderTime += Math.min(diff, 2000);
        }

        while(this.__updateTime < this.__passedUpdateTime) {

//            TODO limiting hard here brings jumps in the updates with it
//            this shows lag when simulating with Box2D
//            if (this.__updateCount < this.__updateFps) {
                this.update(this.__updateTime, this.__updateDuration);
                this.__updateCount++;
//            }

            this.__updateTime += this.__updateDuration;

        }

        usedUpdate = Date.now() - beforeTick;

        // Render Fps handling
        var oldRenderTime = this.__renderTime,
            beforeRender,
            usedRender;

        while(this.__renderTime < this.__passedRenderTime) {
            this.__renderTime += this.__renderDuration;
        }

        // Only render in case its actually necessary
        beforeRender = Date.now();
        if (doRender && (this.__renderTime > oldRenderTime || this.__pauseCount !== 0) && this.__renderCount < this.__renderFps) {

            var rdt = this.__renderTime - this.__updateTime;
            this.render(this.__renderTime, rdt, rdt / this.__updateDuration);
            this.__renderCount++;

        }

        usedRender = Date.now() - beforeRender;

        // Calculate the load
        this.__currentLoad.update = this.__average(this.__averages.load.update, usedUpdate <= 0 ? 0 : usedUpdate / this.__updateDuration);
        this.__currentLoad.render = this.__average(this.__averages.load.render, usedRender <= 0 ? 0 : usedRender / this.__renderDuration);

        if (this.__averageTick++ > this.__averageScale) {
            this.__averageTick = 0;
        }

        // Make sure the interval is somewhat stable
        var used = Date.now() - beforeTick;
        this.__lastTickTime = beforeTick - used;

    },

    // Abstract methods -------------------------------------------------------
    // ------------------------------------------------------------------------

    /**
      *  The update callback.
      *
      *  @param {Number} t The current update time.
      */
    update: function(t) {
    },

    /**
      *  The render callback.
      *
      *  @param {Number} t The current render time.
      */
    render: function(t) {
    }

});


window.requestAnimFrame = (function() {

    return window.requestAnimationFrame || window.webkitRequestAnimationFrame ||
           window.mozRequestAnimationFrame || window.oRequestAnimationFrame ||
           window.msRequestAnimationFrame || function(callback, element) {
               window.setTimeout(callback, 1000 / 60);
           };

})();

