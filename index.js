var juicer = require('juicer');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var LRUCache = require('lru-cache');
var cache = LRUCache({
    max: 1000,
    maxAge: 1000 * 60 * 60 * 24 * 30
});

var _cacheset = cache.set;
var _cacheget = cache.get;
var _cachehas = cache.has;

var noop = function () {
    return false;
};

var cacheset = cache.set = function (key, value, maxAge) {
    key = crypto.createHash('md5').update(key).digest('hex');
    return _cacheset.call(cache, key, value, maxAge);
};

var cacheget = cache.get = function (key) {
    key = crypto.createHash('md5').update(key).digest('hex');
    return _cacheget.call(cache, key);
};

var cachehas = cache.has = function (key) {
    key = crypto.createHash('md5').update(key).digest('hex');
    return _cachehas.call(cache, key);
};

var renderHook = {
    before: noop,
    io: noop,
    compile: noop,
    render: noop,
    include: noop,
    after: noop
}

// disabled auto strip
juicer.set('strip', false);
juicer.set('cache', true);
juicer.set('cachestore', cache);

module.exports = function(tplPath, options, fn) {
    var deep = function(data, scope, _tmp) {
        _tmp = data;
        scope = scope.replace(/\[([^\]]+)\]/igm, '.$1');
        scope = scope.split('.');

        for(var i = 0; i < scope.length; i++) {
            scope[i] = scope[i].replace(/["']/igm, '');
            if(scope[i] === '_') {
                continue;
            }

            _tmp = _tmp[scope[i]];
        }
        return _tmp;
    };

    var includeFileDetect = function(tplPath, str, opts) {
        var includeWithoutRender = juicer.tags.operationOpen + 'include\\s*([^}]*?)\\s*' + juicer.tags.operationClose;
        juicer.settings.includeWithoutRender = new RegExp(includeWithoutRender, 'igm');

        str = str.replace(juicer.settings.include, function($, tpl, data) {
            try {
                if(tpl.match(/^file\:\/\//igm)) {
                    tpl = tpl.substr(7);
                    var compile;

                    var _tplPath = path.resolve(path.dirname(tplPath), tpl);
                    data === '_' ? data = options : data = deep(options, data);                    

                    if(!cache.has(_tplPath)) {
                        tpl = fs.readFileSync(_tplPath, 'utf8');
                        compile = juicer.compile(includeFileDetect(_tplPath, tpl, opts));
                        cache.set(_tplPath, compile);
                    } else {
                        compile = cache.get(_tplPath);
                    }

                    return compile.render(data, opts);
                }

                return $;
            } catch(e) {
                console.error('includeFileDetect Error: %s', e.message);
            }
        });

        str = str.replace(juicer.settings.includeWithoutRender, function($, tpl) {
            try {
                if(tpl.match(/^file\:\/\//igm)) {
                    tpl = tpl.substr(7);
                    var _tplPath = path.resolve(path.dirname(tplPath), tpl);
                    if(!cache.has('WithoutRender:' + _tplPath)) {
                        tpl = fs.readFileSync(_tplPath, 'utf8');
                        cache.set('WithoutRender:' + _tplPath, tpl);
                    } else {
                        tpl = cache.get('WithoutRender:' + _tplPath);
                    }
                    return includeFileDetect(_tplPath, tpl, opts);
                }

                return $;
            } catch(e) {
                console.error('includeFileDetect Error: %s', e.message);
            }
        });

        return str;
    };

    // beforeRender
    renderHook.before(tplPath, cache);

    var callback = function(err, compile, tplPath) {
        if (err) {
            renderHook.after(tplPath, cache, err);
            return fn(err);
        }
        // 渲染
        var str = compile.render(options);
        renderHook.render(tplPath, cache);

        // 处理引入
        str = includeFileDetect(tplPath, str);
        renderHook.include(tplPath, cache);

        // 处理回调
        fn(null, str);
        renderHook.after(tplPath, cache);
    };

    if(cache.has(tplPath)) {
        return callback(null, cache.get(tplPath), tplPath);
    }

    fs.readFile(tplPath, 'utf8', function(err, str) {
        // hook io
        renderHook.io(tplPath, cache);

        // 处理模板编译
        var compile = juicer.compile(str);
        renderHook.compile(tplPath, cache);

        if(!err) {
            cache.set(tplPath, compile);
        }
        callback(err, compile, tplPath);
    });
};

// export API for cache
module.exports.cacheOff = function () {
    juicer.set('cache', false);
    cache.set = cache.get = cache.has = noop;
};

module.exports.cacheOn = function () {
    juicer.set('cache', true);
    cache.set = cacheset;
    cache.get = cacheget;
    cache.has = cachehas;
};

// export API to inject render
module.exports.hook = function (hook) {
    for (var i in hook) {
        if (renderHook.hasOwnProperty(i)) {
            renderHook[i] = hook[i];
        }
    }
};
