var juicer = require('juicer');
var fs = require('fs');
var path = require('path');

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

    var includeFileDetect = function(str) {
        var includeWithoutRender = juicer.tags.operationOpen + 'include\\s*([^}]*?)\\s*' + juicer.tags.operationClose;
        juicer.settings.includeWithoutRender = new RegExp(includeWithoutRender, 'igm');

        str = str.replace(juicer.settings.include, function($, tpl, data) {
            try {
                if(tpl.match(/^file\:\/\//igm)) {
                    tpl = tpl.substr(7);
                    tpl = path.resolve(path.dirname(tplPath), tpl);
                    tpl = fs.readFileSync(tpl, 'utf8');
                    data === '_' ? data = options : data = deep(options, data);
                    return juicer(includeFileDetect(tpl), data);
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
                    tpl = path.resolve(path.dirname(tplPath), tpl);
                    tpl = fs.readFileSync(tpl, 'utf8');
                    return includeFileDetect(tpl);
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
        includeFileDetect(str);
        str = juicer(str, options);
        str = includeFileDetect(str);
        fn(null, str);
    });
};
