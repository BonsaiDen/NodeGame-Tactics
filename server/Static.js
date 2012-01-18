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
var paperboy = require('./lib/paperboy'),
    Class = require('../base/lib/Class'),
    Logger = require('../base/lib/Logger'),
    path = require('path');


// Static file Server ---------------------------------------------------------
// ----------------------------------------------------------------------------
var Static = Class(function(base, root) {

    Logger.init(this, 'Static');
    this.webroot = path.join(path.dirname(base), root);

}, Logger, {

    request: function(req, res) {

        req.url = req.url.replace(/\.\./g, '');

        // Do some rewriting
        var start = req.url.split('/')[1],
            root = this.webroot;

        if (start === 'server') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Error 404: File not found');
            return;
        }

        paperboy.deliver(root, req, res)
            .addHeader('Expires', 3000)
            .addHeader('Cache-Control', 'max-age=300')

            .after(function(statCode) {

            }).error(function(statCode, msg) {
                res.writeHead(statCode, { 'Content-Type': 'text/plain' });
                res.end('Error ' + statCode);

            }).otherwise(function(err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Error 404: File not found');
            });

    }

});

module.exports = Static;

