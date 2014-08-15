var juicer = require('juicer');

module.exports = function(tplPath, options, fn) {
    var includeFileDetect = function(str) {
        var includeWithoutRender = juicer.tags.operationOpen + 'include\\s*([^}]*?)\\s*' + juicer.tags.operationClose;
        juicer.settings.includeWithoutRender = new RegExp(includeWithoutRender, 'igm');

        str = str.replace(juicer.settings.include, function($, tpl, data) {
            try {
                if(tpl.match(/^file\:\/\//igm)) {
                    tpl = tpl.substr(7);
                    tpl = path.resolve(path.dirname(tplPath), tpl);
                    tpl = fs.readFileSync(tpl, 'utf8');
                    data === '_' ? data = options : data = options[data];
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
        str = juicer(str, options);
        str = includeFileDetect(str);
        fn(null, str);
    });
};
