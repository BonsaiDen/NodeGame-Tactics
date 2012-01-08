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
(function() {

    var network = {

        PORT: 13451,

        // Gloabal 200-299
        Client: {

            HASH: 201,
            CONNECT: 202,

            // Send by / to a single player
            Game: {
                JOIN: 203,
                LEAVE: 204,
                JOINED: 205,
                LEFT: 206
            }

        },

        // Games 300-399
        Game: {

            TICK: 0,
            SETTINGS: 301,

            Client: {
                JOINED: 303,
                LEFT: 304,
                LIST: 307
            },

            Player: {
                LIST: 308,
                REJOINED: 300,
                JOINED: 305,
                LEFT: 306
            }

        },

        Server: {

            Game: {
                LIST: 401
            },

            SETTINGS: 402

        },

        // Errors
        ERROR: 1000,

        // Error codes
        Error: {
            SERVER_FULL: 1,
            INVALID_CONNECT: 2
        }

    };

    // Export
    if (typeof window === 'undefined') {
        exports.network = network;

    } else {
        window.network = network;
    }

})();

