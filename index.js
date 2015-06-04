var juicer = require('juicer');
var fs = require('fs');
var path = require('path');

// disabled auto strip
juicer.set('strip', false);

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
                    var _tplPath = path.resolve(path.dirname(tplPath), tpl);
                    tpl = fs.readFileSync(_tplPath, 'utf8');
                    data === '_' ? data = options : data = deep(options, data);
                    return juicer(includeFileDetect(_tplPath, tpl, opts), data, opts);
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
                    tpl = fs.readFileSync(_tplPath, 'utf8');
                    return includeFileDetect(_tplPath, tpl, opts);
                }

                return $;
            } catch(e) {
                console.error('includeFileDetect Error: %s', e.message);
            }
        });

        return str;
    };

    fs.readFile(tplPath, 'utf8', function(err, str) {
        if (err) return fn(err);
        // PreDetect For Helper Register
        includeFileDetect(tplPath, str, { cache: false });
        str = juicer(str, options);
        str = includeFileDetect(tplPath, str);
        fn(null, str);
    });
};
