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
var HashList = need('shared.lib.HashList'),
    WebSocket = need('server.lib.WebSocket'),
    Client = need('server.Client');


// Game Server ----------------------------------------------------------------
// ----------------------------------------------------------------------------
var Server = Class({

    constructor: function(port, gameClass, maxClients, maxGames) {

        // Clients
        this._clients = new HashList();
        this._maxClients = maxClients || 60;

        // Game stuff
        this._games = new HashList();
        this._maxGames = maxGames || 12;
        this._gameClass = gameClass;

        // Networking
        this._socket = new WebSocket();
        this._bytesSend = 0;
        this._port = port || 4400;

        var that = this;
        this._socket.on('connection', function(conn) {
            that.onConnection(conn);
        });

        this._socket.on('data', function(conn, data, binary) {
            that.onMessage(conn, bison.decode(data));
        });

        this._socket.on('end', function(conn) {
            that.onClose(conn);
        });

        this._socket.listen(this._port);

        log(this, 'Started on port', this._port,
                  '| Max clients:', this._maxClients,
                  '| Max games:', this._maxGames);

    },


    // Network Events ---------------------------------------------------------
    // ------------------------------------------------------------------------
    onConnection: function(conn) {

        if (this._clients.length >= this._maxClients) {

            conn.send(bison.encode({
                type: network.ERROR,
                code: network.Error.SERVER_FULL,
                detail: this._maxClients
            }));

            conn.close();

        } else {
            conn.send(bison.encode({
                type: network.Client.SETTINGS
            }));
        }

    },

    onMessage: function(conn, msg) {

        if (this._clients.has(conn)) {
            this._clients.get(conn).onMessage(msg);

        } else {

            // Check if the login is valid
            var valid = false,
                name = (msg.name || '').trim();

            // Check basic message
            if (msg instanceof Array || msg.type !== network.Client.CONNECT) {
                value = 'connect message required first';

            // Check game hash
            } else if (typeof msg.hash !== 'string'
                       || msg.hash.trim().length != 32) {

                value = 'invalid client hash';

            // Check name
            } else if (name.length < 2 || name.length > 16) {
                value = 'Name length must be between 2 and 16 chars';

            } else {
                valid = true;
            }

            // Add client
            if (valid === true) {
                var client = new Client(this, conn, msg);
                this._clients.add(client);

            } else {

                log(this, 'Invalid connect: ' + valid);
                conn.send(bison.encode({
                    type: network.ERROR,
                    code: network.Error.INVALID_CONNECT,
                    detail: valid
                }));

                conn.close();

            }

        }

    },

    onClose: function(conn) {

        if (this._clients.has(conn)) {
            this._clients.get(conn).close();
            this._clients.remove(conn);
        }

    },


    // Networking -------------------------------------------------------------
    broadcast: function(type, msg, clients, exclude) {

        // Add the type to the message
        if (msg instanceof Array) {
            msg.unshift(type);

        } else {
            msg.type = type;
        }

        if (!clients || clients.length === 0) {
            this._bytesSend += this._socket.broadcast(bison.encode(msg));

        } else if (exclude) {
            this._clients.eachNot(clients, function(client) {
                this._bytesSend += client.sendPlain(bison.encode(msg));

            }, this);

        } else {
            this._clients.eachIn(clients, function(client) {
                this._bytesSend += client.sendPlain(bison.encode(msg));

            }, this);
        }

    },


    // Game Methods -----------------------------------------------------------
    getGame: function(gid) {

        if (typeof gid === 'number' && gid > 0 && gid < this._maxGames) {

            // Create the game if it does not exists yet
            if (!this._games.has(gid)) {
                this._games.add(new this._gameClass(this, gid));
            }

            return this._games.get(gid);

        } else {
            return 'Invalid game id: ' + gid;
        }

    },

    getSocket: function() {
        return this._socket;
    },

    getGames: function() {
        return this._games;
    },

    // TODO
    removeGame: function(gid) {

        var game = this._games.get(gid);
        if (game) {
            this._games.remove(game);
        }

    },

    /**
      * {String} Returns a string based represenation of the object.
      */
    toString: function() {
        return 'Server';
    }

});

exports.Server = Server;

