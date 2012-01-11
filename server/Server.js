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
    Client = need('server.Client'),
    crypto = require('crypto');


// Game Server ----------------------------------------------------------------
// ----------------------------------------------------------------------------
var Server = Class({

    constructor: function(options) {

        // Clients
        this._clients = new HashList();
        this._maxClients = options.maxClients || 60;

        // Game stuff
        this._games = new HashList();
        this._maxGames = options.maxGames || 12;
        this._gameClass = options.gameClass;

        // Networking
        this._socket = new WebSocket();
        this._bytesSend = 0;
        this._port = options.port || 4400;


        // Web Sockets
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

        // Authentication
        this._authSessions = {};


        // HTTP
        this._httpHandler = options.httpHandler;
        this._socket.on('request', function(req, res) {
            that.onHTTPRequest(req, res);
        });

        this._socket.listen(this._port);

        log(this, 'Started on port', this._port,
                  '| Max clients:', this._maxClients,
                  '| Max games:', this._maxGames);

    },

    /**
      * Handle HTTP requests and authentication via Twitter
      */
    onHTTPRequest: function(req, res) {

        var session = this.getSession(req, res);
        this._httpHandler ? this._httpHandler(req, res) : null;

    },

    /**
      * Simple http session via cookie.
      */
    getSession: function(req, res) {

        var cookie = req.headers.cookie || '',
            pos = cookie.indexOf('session='),
            session = null,
            key;

        if (pos !== -1) {

            key = cookie.substr(pos + 8, 32);
            if (this._authSessions[key]) {
                session = this._authSessions[key];

            } else {
                session = this._authSessions[key] = {};
            }

        }

        if (session === null) {

            var hash = crypto.createHash('md5');
            hash.update(Date.now() + '-' + req.remoteAdress + '-' + req.remotePort);
            hash.update(req.headers['user-agent'] || 'default');

            key = hash.digest('hex');
            session = this._authSessions[key] = {};

            session.secret = Math.floor(Math.random() * 100);

        }

        session.key = key;
        res.setHeader('Set-Cookie', 'session=' + session.key + '; ');

        return session;

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
                type: network.Server.SETTINGS
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
        if (type !== null) {

            if (msg instanceof Array) {
                msg.unshift(type);

            } else {
                msg.type = type;
            }

        }

        if (!clients || clients.length === 0) {
            this._bytesSend += this._socket.broadcast(bison.encode(msg));

        } else if (exclude) {
            clients.eachNot(exclude, function(client) {
                this._bytesSend += client.sendPlain(bison.encode(msg));

            }, this);

        } else {
            clients.each(function(client) {
                this._bytesSend += client.sendPlain(bison.encode(msg));

            }, this);
        }

    },


    // Game Methods -----------------------------------------------------------
    // ------------------------------------------------------------------------
    createGame: function() {


    },

    getGame: function(gid) {

        if (typeof gid === 'number' && gid > 0 && gid < this._maxGames) {

            // Create the game if it does not exists yet
            if (!this._games.has(gid)) {
                this._games.add(new this._gameClass(this, gid));
                this.sendGameList();
            }

            return this._games.get(gid);

        } else {
            return 'Invalid game id: ' + gid;
        }

    },

    // TODO
    removeGame: function(gid) {

        var game = this._games.get(gid);
        if (game) {
            this._games.remove(game);
            this.sendGameList();
        }

    },

    getGames: function() {
        return this._games;
    },

    /**
      * TODO: Add Description
      */
    sendGameList: function(client) {

        var list = this._games.map(function(game) {
            return game.toMessage();
        });

        if (client) {
            client.send(network.Server.Game.LIST, 0, list);

        } else {
            log(this, 'Game list to all');
            this.broadcast(network.Server.Game.LIST, list);
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

