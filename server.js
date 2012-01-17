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


// Startup --------------------------------------------------------------------
var Game = require('./server/Game'),
    Server = require('./base/Server'),
    Class = require('./base/lib/Class'),
    Static = require('./base/Static'),
    Logger = require('./base/lib/Logger'),
    OAuth = require('oauth').OAuth,
    fs = require('fs'),
    network = require('./base/network');


var AuthHandler = Class(function(options) {

    Logger.init(this, 'OAuth');

    this._oAuth = new OAuth(
        'https://api.twitter.com/oauth/request_token',
        'https://api.twitter.com/oauth/access_token',
        options.consumerKey,
        options.consumerSecret,
        '1.0',
        options.callbackUrl,
        'HMAC-SHA1'
    );


}, Logger, {

    request: function(req, res) {

        if (req.pathname === '/auth/callback') {

            function verified(result, error) {

                if (error) {
                   res.writeHead(302, { 'Content-Type': 'text/html', 'Location': '/auth' });
                   res.end('Token expired.');

                } else {
                   res.writeHead(302, { 'Content-Type': 'text/html', 'Location': '/' });
                   res.end();
                }

            }

            if (!this.validate(req, res, verified)) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('No session found, please allow cookies.');
            }

            return true;

        } else if (req.pathname === '/auth') {

            function auth(token, error) {

                if (error) {
                    res.end('Could not create oauth tokens.');
                    res.writeHead(503, { 'Content-Type': 'text/plain' });

                } else {

                    res.writeHead(302, {
                        'Content-Type': 'text/html',
                        'Location': 'https://twitter.com/oauth/authenticate?oauth_token=' + token
                    });

                    res.end();

                }

            }

            this.get(req, res, auth);
            return true;

        }

    },

    get: function(req, res, callback) {

        var that = this;
        this._oAuth.getOAuthRequestToken(function(error, token, secret, results){

            if (error) {
                that.log('Failed to create tokens.');

            } else {

                req.session.oauth = {
                    token: token,
                    secret: secret
                };

                that.log('Authenticating...');

            }

            callback.call(that, token, error);

        });

    },

    validate: function(req, res, callback) {

        if (req.session.oauth) {

            var oauth = req.session.oauth,
                that = this;

            oauth.verifier = req.query.oauth_verifier;

            function result(error, token, secret, results) {

                if (error) {
                    that.log('Token expired:', error);

                } else {
                    //oauth.access_token = access_token;
                    //oauth.access_token_secret = access_token_secret;

                    req.session.user = {
                        name: results.screen_name,
                        id: results.user_id
                    };

                    that.log('Logged in as:', req.session.user.name);

                }

                callback.call(that, results, error);

            }

            this.log('Verfifying...');
            this._oAuth.getOAuthAccessToken(oauth.token, oauth.secret,
                                            oauth.verifier, result);

            return true;

        } else {

            this.log('No valid session');
            return false;

        }

    },

    toString: function() {
        return '';
    }

});


new Server({
    gameClass: Game,
    httpHandler: new Static(__filename, './'),
    authHandler: new AuthHandler(JSON.parse(fs.readFileSync('auth.json')))

}).listen(network.PORT);

