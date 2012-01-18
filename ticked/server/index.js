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
var lib = require('../lib'),
    Client = require('./Client'),
    Game = require('./Game'),
    Player = require('./Player'),
    network = require('../network'),
    crypto = require('crypto'),
    url  = require('url'),
    fs = require('fs');


// Game Server ----------------------------------------------------------------
// ----------------------------------------------------------------------------
var Server = lib.Class(function(options) {

    lib.Logger.init(this, 'Server');

    // Clients
    this._clients = new lib.HashList();
    this._maxClients = options.maxClients || 60;

    // Game stuff
    this._games = new lib.HashList();
    this._maxGames = options.maxGames || 12;
    this._gameClass = options.gameClass;

    // Low level networking
    this._socket = new lib.WebSocket();
    this._bytesSend = 0;
    this._port = null;

    // Web Sockets
    var that = this;
    this._socket.on('connection', function(conn, req) {
        that.onConnection(conn, req);
    });

    this._socket.on('data', function(conn, data, binary) {
        that.onMessage(conn, lib.BISON.decode(data));
    });

    this._socket.on('end', function(conn) {
        that.onClose(conn);
    });

    // Auth
    this._sessionFile = options.sessionFile || 'storedSessions.json';
    this._authHandler = options.authHandler;

    // HTTP
    this._httpHandler = options.httpHandler;
    this._socket.on('request', function(req, res) {
        that.onHTTPRequest(req, res);
    });

}, lib.Logger, {

    // Let's stick to the common NodeJS interace
    listen: function(port) {

        // Sessions
        this.readSessions();

        this._port = port;

        // Get it started
        this._socket.listen(this._port);

        process.on('SIGINT', function() {
            process.exit();
        });

        var that = this;
        process.on('exit', function() {
            that.onExit();
        });

        this.log('Started on port', this._port,
                    '| Max clients:', this._maxClients,
                    '| Max games:', this._maxGames);

    },

    // Network Events ---------------------------------------------------------
    // ------------------------------------------------------------------------
    onConnection: function(conn, req) {

        this.getSession(req);

        console.log('User: ', req.session.user);

        if (this._clients.length >= this._maxClients) {

            conn.send(lib.BISON.encode({
                type: network.ERROR,
                code: network.Error.SERVER_FULL,
                detail: this._maxClients
            }));

            conn.close();

        } else {
            conn.send(lib.BISON.encode({
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
                valid = 'connect message required first';

            // Check game hash
            } else if (typeof msg.hash !== 'string'
                       || msg.hash.trim().length !== 32) {

                valid = 'invalid client hash';

            // Check name
            } else if (name.length < 2 || name.length > 16) {
                valid = 'Name length must be between 2 and 16 chars';

            } else {
                valid = true;
            }

            // Add client
            if (valid === true) {
                var client = new Client(this, conn, msg);
                this._clients.add(client);

            } else {

                this.log('Invalid connect: ' + valid);
                conn.send(lib.BISON.encode({
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

    onExit: function() {
        this.writeSessions();
        this.log('Shutting down...');
    },

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
            this._bytesSend += this._socket.broadcast(lib.BISON.encode(msg));

        } else if (exclude) {
            clients.eachNot(exclude, function(client) {
                this._bytesSend += client.sendPlain(lib.BISON.encode(msg));

            }, this);

        } else {
            clients.each(function(client) {
                this._bytesSend += client.sendPlain(lib.BISON.encode(msg));

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

    sendGameList: function(client) {

        var list = this._games.map(function(game) {
            return game.toMessage();
        });

        if (client) {
            client.send(network.Server.Game.LIST, 0, list);

        } else {
            this.log('Game list to all');
            this.broadcast(network.Server.Game.LIST, list);
        }

    },

    /**
      * {String} Returns a string based represenation of the object.
      */
    toString: function() {
        return 'Server';
    },


    // HTTP, Session and Auth Handling ----------------------------------------
    // ------------------------------------------------------------------------
    onHTTPRequest: function(req, res) {

        var data = url.parse(req.url, true);
        req.query = data.query;
        req.pathname = data.pathname;

        this.getSession(req, res);

        if (this._authHandler ? this._authHandler.request(req, res) : null) {
            return;

        } else {
            return this._httpHandler ? this._httpHandler.request(req, res) : null;
        }

    },


    // Session Management -----------------------------------------------------
    // ------------------------------------------------------------------------
    getSession: function(req, res) {

        var cookie = req.headers.cookie || '',
            pos = cookie.indexOf('session='),
            session = null,
            key = null;

        if (pos !== -1) {

            // Really bad cookie handling...
            key = cookie.substr(pos + 8, 32);
            if (this._sessions[key]) {
                session = this._sessions[key];

            } else {
                session = this._sessions[key] = {
                    user: null
                };
            }

        }

        this.log('[SESSION] Key:', key);

        if (res) {

            // Create new session
            if (session === null) {

                var hash = crypto.createHash('md5');
                hash.update(Date.now() + '-' + req.remoteAdress + '-' + req.remotePort);
                hash.update('' + Math.random());

                key = hash.digest('hex');
                session = this._sessions[key] = {};

                res.setHeader('Set-Cookie', 'session=' + key + '; ');

            }

            session._lastVisit = Date.now();
            session._key = key;

        }

        req.session = session;

    },

    readSessions: function() {

        try {

            this._sessions = JSON.parse(fs.readFileSync(this._sessionFile));
            this.log('Read session data from disk');

            for(var i in this._sessions) {

                if (Date.now() - this._sessions[i]._lastVisit > 1000 * 60 * 60 * 24) {
                    this.log('Session was dropped:', i);
                    delete this._sessions[i];
                }

            }

        } catch(e) {
            this.log('No session data found: ', e.message);
            this._sessions = {};
        }

    },

    writeSessions: function() {

        try {
            fs.writeFileSync(this._sessionFile, JSON.stringify(this._sessions));
            this.log('Wrote session data to disk.');

        } catch(e) {
            this.log('Session data could not be saved: ', e);
        }

    }

});

Server.Client = Client;
Server.Player = Player;
Server.Game = Game;

module.exports = Server;

