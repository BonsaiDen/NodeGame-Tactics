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

(function(undefined) {


    function Class(base, props) {

        if (typeof base !== 'function') {
            props = base;
            base = null;
        }

        props = props || {};

        var level = 0;
        if (base) {

            level = base.__level + 1;

            // Patch in required super calls
            for(var i in props) {

                if (props.hasOwnProperty(i) && typeof props[i] === 'function') {

                    var code = props[i].toString(),
                        superMethod = /\WSuper\./.test(code),
                        superCtor = /\WSuper\(/.test(code);

                    if (superMethod || superCtor) {

                        code = code.replace(/\WSuper\./g, 'this.___super_' + level + '_');
                        code = code.replace(/\WSuper\(/g, 'this.___super_' + level + '_constructor(');

                        props[i] = eval('(' + code +')');

                    }

                }

            }

        }

        // We assign this here so that we don't inherit constructors
        // Which would break alot of stuff
        var ctor;
        if (props.hasOwnProperty('constructor')
            && typeof props.constructor === 'function') {

            ctor = props.constructor;

        } else {
            ctor = function() {};
        }

        ctor.__level = level;

        if (base) {

            // Iterate over the base class and check for "super" methods
            for(var i in base.prototype) {

                if (i.substr(0, 3) !== '___') {

                    if (base.prototype.hasOwnProperty(i)) {
                        props['___super_' + level + '_' + i] = base.prototype[i];
                    }

                }

                if (!props.hasOwnProperty(i)) {
                    props[i] = base.prototype[i];
                }

            }

        }

        ctor.prototype = props;

        // Add statics
        if (props.hasOwnProperty('$')) {

            var statics = props['$'];
            for(var i in statics) {
                if (statics.hasOwnProperty(i)) {
                    ctor[i] = statics[i];
                }
            }

        }

        // Extend prototype
        if (props.hasOwnProperty('prototype')) {

            var protos = props['prototype'];
            if (protos instanceof Array) {

                for(var i = 0, l = protos.length; i < l; i++) {

                    var p = protos[i].prototype;
                    for(var e in p) {
                        if (p.hasOwnProperty(e)) {
                            ctor.prototype[e] = p[e];
                        }
                    }

                }

            }

        }

        ctor.prototype['$'] = undefined;
        delete ctor.prototype['$'];

        return ctor;

    }

    // Exports
    if (typeof window === 'undefined') {
        exports.Class = Class

    } else {
        window['Class'] = Class;
    }

})();

