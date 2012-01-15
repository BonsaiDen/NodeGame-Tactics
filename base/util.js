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
module.exports = {

    size: function(bytes) {

        var t = 0;
        while(bytes >= 1024 && t < 2) {
            bytes = bytes / 1024;
            t++;
        }

        return Math.round(bytes * 100) / 100 + [' bytes', ' kib', ' mib'][t];

    },

    time: function(now, start) {

        if (start !== undefined) {

            var t = Math.round((now - start) / 1000),
                m = Math.floor(t / 60),
                s = t % 60;

            return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + ' ';

        } else {
            return new Date(now).toString();
        }

    },

    log: function(obj, items) {

        var msg = Array.prototype.slice.call(arguments, 1);
        msg.unshift('[' + obj + ']:');
        console.log.apply(console, msg);

    }

};

