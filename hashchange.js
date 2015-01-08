/*
 * @ignore
 * hashchange event
 * @author yiminghe@gmail.com, xiaomacji@gmail.com, weichuan.chen@hotmail.com
 * 
 * 此文件必须放置在<head> 里
 */
;(function(win){

var doc = win.document,
    docMode = doc && doc['documentMode'],
    ie = docMode || _getIEVersion(win),
    replaceHistory = 0,
    getHash = function () {
        // 不能 location.hash
        // 1.
        // http://xx.com/#yy?z=1
        // ie6 => location.hash = #yy
        // 其他浏览器 => location.hash = #yy?z=1
        // 2.
        // #!/home/q={%22thedate%22:%2220121010~20121010%22}
        // firefox 15 => #!/home/q={"thedate":"20121010~20121010"}
        // !! :(
        var href = location.href;
        // 若没有# 返回一个#
        return -1 === href.indexOf( "#" ) ? "#" : ( "#" + href.split( "#" )[1] );
    },
    isHashChangeSupported = function() {
        // ie8 支持 hashchange
        // 但 ie8 以上切换浏览器模式到 ie7（兼容模式），
        // 会导致 'onhashchange' in window === true，但是不触发事件
        return ('onhashchange' in win) && (!ie || ie > 7);
    },
    queue = [],
    hashchange = {};

// fix for non-standard browser
function hashchangeFix() {

    // 1. 不支持 hashchange 事件，支持 hash 历史导航(opera??)：定时器监控
    // 2. 不支持 hashchange 事件，不支持 hash 历史导航(ie67) : iframe + 定时器

    function getIframeDoc(iframe) {
        return iframe.contentDocument || iframe.contentWindow.document;
    }

    var POLL_INTERVAL = 50,
        IFRAME_TEMPLATE = '<html><head><title>' + (doc && doc.title || '') +
            ' - {hash}</title>{head}</head><body>{hash}</body></html>',

        timer,

        // 用于定时器检测，上次定时器记录的 hash 值
        lastHash,

        // ie8 支持 hash history
        // 但 ie8 以上切换浏览器模式到 ie7（兼容模式），
        // 会导致 'onhashchange' in window === true，且假支持hash history
        // 即前进和后退hash 改变，但没有生效
        // 修复：替换hash
        poll =  ("onhashchange" in win) && ie && ie < 8 ? function () {
            var hash = getHash();
            if (hash !== lastHash) {
                //console.log('poll success :' + hash + ' :' + lastHash);
                // 修正hash history
                location.hash = hash;
                //console.log("fix hash history :" + getHash());
                // 通知完调用者 hashchange 事件前设置 lastHash
                lastHash = hash;
                // ie<8 同步 : hashChange -> onIframeLoad
                hashChange(hash);
            }
            timer = setTimeout(poll, POLL_INTERVAL);
        } : function() {
            var hash = getHash();
            if (hash !== lastHash) {
                //console.log('poll success :' + hash + ' :' + lastHash);
                // 通知完调用者 hashchange 事件前设置 lastHash
                lastHash = hash;
                // ie<8 同步 : hashChange -> onIframeLoad
                hashChange(hash);
            }
            timer = setTimeout(poll, POLL_INTERVAL);
        },

        hashChange = ie && ie < 8 ? function (hash) {
            //console.log('set iframe html :' + hash);
            var html = _substitute(IFRAME_TEMPLATE, {
                    // 防止 hash 里有代码造成 xss
                    // 后面通过 nodeValue，相当于 unEscapeHTML
                    hash: _escapeHTML(hash),
                    // 一定要加哦
                    head: _isCustomDomain() ? ("<script>" +
                        "document." +
                        "domain = '" +
                        doc.domain
                        + "';</script>") : ''
                }),
                iframeDoc = getIframeDoc(iframe);
            try {
                //console.log("replace history :" + replaceHistory);
                // 非前进和后退，hash 才写入历史
                replaceHistory ? iframeDoc.open("text/html", "replace") : iframeDoc.open();
                replaceHistory = 0;
                // 取时要用 nodeValue !!
                // 否则取 innerHtml 会因为 escapeHtml 导置 body.innerHTMl != hash
                iframeDoc.write(html);
                iframeDoc.close();
                // 立刻同步调用 onIframeLoad !!!!
            } catch (e) {
                //console.log('doc write error : ', 'error');
                //console.log(e, 'error');
            }
            //console.log('iframe html has changed :' + (iframeDoc.body.firstChild && iframeDoc.body.firstChild.nodeValue || ""));
        } : function () {
            notifyHashChange();
        },

        notifyHashChange = function() {
            //console.log('hash changed : ' + getHash());
            // does not need bubbling
            hashchange.fireEvent();
        },
        setup = function () {
            if (!timer) {
                //console.log('poll start');
                poll();
            }
        },
        tearDown = function () {
            timer && clearTimeout(timer);
            timer = 0;
        },
        iframe;

    // ie6, 7, 覆盖一些function
    if (ie && ie < 8) {

        /*
         前进后退 : start -> notifyHashChange
         直接输入 : poll -> hashChange -> start
         iframe 内容和 url 同步
         */
        setup = function () {
            if (!iframe) {
                //console.log("build iframe");
                //http://www.paciellogroup.com/blog/?p=604
                iframe = doc.createElement("iframe");
                iframe.src = _getEmptyIframeSrc();
                iframe.style.display = "none";
                iframe.setAttribute("height", "0");
                iframe.setAttribute("width", "0");
                iframe.setAttribute("tabindex", "-1");
                iframe.setAttribute("title", "empty");

                // Append the iframe to the documentElement rather than the body.
                // Keeping it outside the body prevents scrolling on the initial
                // page load
                doc.documentElement.insertBefore(iframe, doc.getElementsByTagName("head")[0]);
                // doc.documentElement.appendChild(iframe);

                // init，第一次触发，以后都是 onIframeLoad
                var initLoad = function() {
                    _removeEvent(iframe, 'load', initLoad);
                    // 初始化时进行历史替换，防止刷新时也产生新历史
                    replaceHistory = 1;
                    // Update the iframe with the initial location hash, if any. This
                    // will create an initial history entry that the user can return to
                    // after the state has changed.
                    hashChange(getHash());
                    _addEvent(iframe, 'load', onIframeLoad);
                    //console.log('poll start');
                    poll();
                };
                _addEvent(iframe, 'load', initLoad);

                // Whenever `document.title` changes, update the Iframe's title to
                // prettify the back/next history menu entries. Since IE sometimes
                // errors with 'Unspecified error' the very first time this is set
                // (yes, very useful) wrap this with a try/catch block.
                doc.onpropertychange = function (e) {
                    e = e || win.event;
                    try {
                        if (e.propertyName === 'title') {
                            getIframeDoc(iframe).title =
                                doc.title + ' - ' + getHash();
                        }
                    } catch (e) {
                    }
                };

                /*
                 前进后退 ： onIframeLoad -> 触发
                 直接输入 : timer -> hashChange -> onIframeLoad -> 触发
                 触发统一在 start(load)
                 iframe 内容和 url 同步
                 */
                function onIframeLoad() {
                    //console.log('iframe start load..');

                    // 2011.11.02 note: 不能用 innerHtml 会自动转义！！
                    // 2013.03.25 note: 用nodeValue 也不好，因为蛋疼的迅雷等的插件可能会append 标签进去~
                    // #/x?z=1&y=2 => #/x?z=1&amp;y=2
                    var d = getIframeDoc(iframe),
                        b = d.body,
                        c = (b.firstChild && b.firstChild.nodeValue || "").replace(/^[\s\xa0]+|[\s\xa0]+$/g, '');
                        ch = getHash();

                    // 后退时不等
                    // 定时器调用 hashChange() 修改 iframe 同步调用过来的(手动改变 location)则相等
                    if (c != ch) {
                        //console.log('set loc hash :' + c);
                        location.hash = c;
                        // 更新定时器记录的上个 hash 值
                        lastHash = c;
                    }
                    notifyHashChange();
                }
            }
        };

        tearDown = function () {
            timer && clearTimeout(timer);
            timer = 0;
            doc.removeChild(iframe);
            iframe = 0;
        };
    }

    return {
        setup: function () {
            if (this !== win) {
                return;
            }
            // 第一次启动 hashchange 时取一下，不能类库载入后立即取
            // 防止类库嵌入后，手动修改过 hash，
            lastHash = getHash();
            // 不用注册 dom 事件
            setup();
        },
        tearDown: function () {
            if (this !== win) {
                return;
            }
            tearDown();
        }
    };
};

// 添加事件
hashchange.addEvent = function( fn ) {
    queue.push(fn);
    return this;
};

// 触发事件
hashchange.fireEvent = function() {
    var q = queue,
        hash = getHash();
    for (var i = 0, l = q.length; i < l; i ++) {
        q[i].call(win, hash);
    }
};

// 获取hash
hashchange.getHash = getHash;

// 初始化onhashchange 监听
if ( isHashChangeSupported() ) {
    _addEvent(win, "hashchange", function(e) {
        hashchange.fireEvent();
    }, false);
} else {
    hashchangeFix().setup.apply(win);
}

// 页面加载后执行一次event
if ( document.addEventListener ) {
    // Use the handy event callback
    document.addEventListener( "DOMContentLoaded", hashchange.fireEvent, false );
// If IE event model is used
} else if ( document.attachEvent ) {
    // maybe late but safe also for iframes
    document.attachEvent( "onreadystatechange", hashchange.fireEvent );
}

win.hashchange = hashchange;

/* 辅助的方法 */
function _now() {
    var date = new Date();
    return date.getTime();
}

function _getIEVersion( win )
{
    var ieVersionM = ( win || window ).navigator.userAgent.toLowerCase().match(/msie ([\d.]+)/),
        ieVersion = ieVersionM && parseInt( ieVersionM[1] );
    return ieVersion;
}

/**
 * Whether has been set a custom domain.
 * Note not perfect: localhost:8888, domain='localhost'
 * @param {window} [win] Test window. Default current window.
 * @return {Boolean}
 */
function _isCustomDomain(win) {
    win = win || window;
    var domain = win.document.domain,
        hostname = win.location.hostname;
    return domain != hostname &&
        domain != ( '[' + hostname + ']' ); // IPv6 IP support
}
/**
 * Substitutes keywords in a string using an object/array.
 * Removes undefined keywords and ignores escaped keywords.
 * @param {String} str template string
 * @param {Object} o json data
 * @member KISSY
 * @param {RegExp} [regexp] to match a piece of template string
 */
function _substitute(str, o, regexp) {
    if (typeof str != 'string' || !o) {
        return str;
    }

    return str.replace(regexp || /\\?\{([^{}]+)\}/g, function (match, name) {
        if (match.charAt(0) === '\\') {
            return match.slice(1);
        }
        return (o[name] === undefined) ? '' : o[name];
    });
}

/**
 * get escaped string from html.
 * only escape
 *      & > < ` / " '
 * refer:
 *
 * [http://yiminghe.javaeye.com/blog/788929](http://yiminghe.javaeye.com/blog/788929)
 *
 * [http://wonko.com/post/html-escaping](http://wonko.com/post/html-escaping)
 * @param str {string} text2html show
 * @member KISSY
 * @return {String} escaped html
 */
var htmlEntities = {
    '&amp;': '&',
    '&gt;': '>',
    '&lt;': '<',
    '&#x60;': '`',
    '&#x2F;': '/',
    '&quot;': '"',
    '&#x27;': "'"
},
reverseEntities = {},
escapeReg = (function() {
    var str = "";
    for (var k in htmlEntities) {
        str += htmlEntities[k] + '|';
    }
    str = str.slice(0, -1);
    return new RegExp(str, 'g');
})();
(function () {
    for (var k in htmlEntities) {
        reverseEntities[htmlEntities[k]] = k;
    }
})();
function _escapeHTML(str) {
    return (str + '').replace(escapeReg, function (m) {
        return reverseEntities[m];
    });
}

/**
 * Get appropriate src for new empty iframe.
 * Consider custom domain.
 * @param {window} [win] Window new iframe will be inserted into.
 * @return {String} Src for iframe.
 */
function _getEmptyIframeSrc(win) {
    win = win || window;
    if (ie && _isCustomDomain(win)) {
        return  'javascript:void(function(){' + encodeURIComponent(
            'document.open();' +
                "document.domain='" +
                win.document.domain
                + "';" +
                'document.close();') + '}())';
    }
    return '';
}

function _addEvent(elem, type, fn, useCapture) {
    if(elem.addEventListener) { //DOM2.0
        elem.addEventListener(type, fn, useCapture);
    } else if(elem.attachEvent) { //IE5+
        elem.attachEvent('on' + type, fn);
    } else { //DOM 0
        elem['on' + type] = fn;
    }
}

function _removeEvent(elem, type, fn, useCapture) {
    if(elem.removeEventListener) {
        elem.removeEventListener(type, fn, useCapture);
    } else if(elem.detachEvent) {
        elem.detachEvent('on' + type, fn);
    } else {
        elem['on' + type] = null;
    }
};

})(window);
