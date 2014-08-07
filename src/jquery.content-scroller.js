// 依存解決とエクスポート
// ----------------------------------------------------------------------------
(function(global, factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define(['jquery', 'exports'], function($, exports) {
            return factory(global, exports, $);
        });
    } else {
        global.Scroll = factory(global, {}, (global.jQuery || global.$));
    }

}(window, function(global, Scroll, $, undefined) {
    'use strict';

    // 環境情報やら定数やら
    // ----------------------------------------------------------------------------
    var __isMobile = 'ontouchstart' in global;
    var document = global.document;
    var __supportTransform = (function(prop) {
        var div = document.createElement('div');
        var i = 0, l = prop.length;
        for (; i < l; i++) {
            var p = prop[i];
            if (div.style[p] !== undefined) {
                return p;
            }
        }
    }(['transform', 'webkitTransform', 'mozTransform', 'oTransform', 'msTransform']));


    // クラス定義
    // ----------------------------------------------------------------------------
    Scroll = function(options) {
        this.initialize(options);
    };

    Scroll.prototype = {
        constructor: Scroll,
        /**
         * いわゆるイニシャライザ
         *
         * @name initialize
         * @param {Object} options
         *     初期設定
         * @param {Object} options.scrollWrap
         *     親コンテナ(overflow: hiddenを期待する方)
         * @param {Object} options.scrollArea
         *     スクロールさせたいコンテナ
         * @param {Object} options.scrollBar
         *     スクロールバーに使う要素
         * @param {Boolean} options.disableScrollbar
         *     スクロールバー見せない or NOT(デフォルトでは見せる)
         */
        initialize: function(options) {
            options = options || {};
            console.log('Scroll: initialize', options);

            this._ui = $.extend({
                scrollWrap: $('#js-scroll-wrap'),
                scrollArea: $('#js-scroll-area'),
                scrollBar:  $('#js-scroll-bar')
            }, options);

            // 要素ちゃんとある？
            this._ensureElm();

            // スクロールバー出すかどうか
            this._disableScrollBar = options.disableScrollBar || false;

            // 触ってるかどうかフラグ(さわってたらタイマー止めるとか)
            this._isTouching = false;
            // 使いまわす用タイマー(慣性スクロール用)
            this._timer = null;

            // スクロールさせるコンテナのデータ保存用
            this._startAreaY  = null;
            this._startTouchY = null;
            this._preAreaY    = null;
            this._newAreaY    = null;
            this._limitAreaY  = null;
            this._speedY      = null;

            // スクロールバー用
            this._newBarY    = null;
            this._distScroll = null;
            this._distBar    = null;

            return this;
        },

        /**
         * そもそも要素がちゃんとあるかチェックする
         *
         * @name ensureElm
         */
        _ensureElm: function() {
            var isWrapMiss = (this._ui.scrollWrap.length === 0);
            var isAreaMiss = (this._ui.scrollArea.length === 0);

            if (isWrapMiss || isAreaMiss) {
              throw new Error('#scrollWrap or #scrollArea is not exist!');
            }
        },

        /**
         * スクロールできるようにする！
         *
         * この関数を実行してはじめてスクロールできるようになる
         * 逆にいうと、それまではいくら要素が長くなっても良い
         * 逆の逆にいうと、それまでに要素の高さが取れるようにしておく必要がある
         *
         * @name start
         */
        start: function() {
            console.log('Scroll: start');
            var containerHeight = this._ui.scrollWrap.height();
            var scrollAreaHeight = this._ui.scrollArea.height();
            var displayHeight = (scrollAreaHeight < containerHeight) ? containerHeight : scrollAreaHeight;

            // 中の高さ足りなくてそもそもスクロールいらない場合
            var notNeedScrollBar = (scrollAreaHeight < containerHeight);
            if (notNeedScrollBar) {
                this._disableScrollBar = true;
                return;
            }

            this._setScrollBar(containerHeight, displayHeight);

            this._clearTimer()._setTimer();
            this._removeEventLitener()._addEventLitener();

            this._limitAreaY = displayHeight - containerHeight;
            // 最初にstyle当てておかないと、次取れない
            this._setScrollAreaY(0);
        },

        /**
         * いわゆるデストラクタ
         *
         * もういらなくなったらコレを呼ぶ
         *
         * @name dispose
         */
        dispose: function() {
            console.log('Scroll: dispose');
            if (!this._disableScrollBar) {
                this._ui.scrollBar.css({
                    height: 0
                });
            }
            this._removeEventLitener();
            this._clearTimer();
        },

        /**
         * スクロールバーに高さをセットする
         * それと同時に、バーの現在の情報をセットしておく
         *
         * @name setScrollBar
         * @param {Number} containerHeight
         *     親コンテナの高さ
         * @param {Number} displayHeight
         *     親コンテナ - 中身 の差分の見えてる範囲の高さ
         */
        _setScrollBar: function(containerHeight, displayHeight) {
            if (this._disableScrollBar) { return; }
            console.log('Scroll: setScrollBar');
            var height = ~~(containerHeight * containerHeight / displayHeight);
            this._ui.scrollBar.css({
                height: height + 'px'
            });
            this._distScroll = displayHeight - containerHeight;
            this._distBar = containerHeight - height;
        },

        /**
         * スクロールするためのイベントを貼る
         *
         * @name addEventListener
         */
        _addEventLitener: function() {
            console.log('Scroll: addEventListener');
            this._ui.scrollArea.on('touchstart', $.proxy(this._onStart, this))
                .on('touchend', $.proxy(this._onEnd, this));
            return this;
        },

        /**
         * スクロールするためのイベントをはがす
         *
         * @name removeEventListener
         */
        _removeEventLitener: function() {
            console.log('Scroll: removeEventListener');
            this._ui.scrollArea.off('touchstart')
                .off('touchend')
                .off('touchmove');
            return this;
        },

        /**
         * スクロールしようとタップした瞬間のハンドラ
         *
         * @name onStart
         * @param {Object} ev
         *     jQueryEventを想定してる(ので、originalEvent確保する)
         */
        _onStart: function(ev) {
            console.log('Scroll: onStart');
            ev = ev.originalEvent;

            this._clearTimer();
            this._isTouching = true;
            this._preAreaY = 0;
            this._speedY = 0;

            this._startTouchY = __isMobile ? ev.changedTouches[0].pageY : ev.pageY;
            this._startAreaY = this._getScrollAreaY();
            this._ui.scrollArea.on('touchmove', $.proxy(this._onMove, this));
        },

        /**
         * スクロールしおわり、またはタップしただけのハンドラ
         *
         * @name onEnd
         * @param {Object} ev
         *     jQueryEventを想定してる(ので、originalEvent確保する)
         */
        _onEnd: function(ev) {
            console.log('Scroll: onEnd');
            ev = ev.originalEvent;

            var tempTouch = __isMobile ? ev.changedTouches[0].pageY : ev.pageY;
            if ((this._startTouchY - tempTouch) < 5 && (this._startTouchY - tempTouch) > -5) {
                this._speedY = 0;
            }
            if ((this._startTouchY - tempTouch) < 0 && this._speedY < 0) {
                this._speedY *= -1;
            }

            this._isTouching = false;
            this._ui.scrollArea.off('touchmove');

            this._setTimer();
        },

        /**
         * スクロール中のハンドラ
         *
         * @name onMove
         * @param {Object} ev
         *     jQueryEventを想定してる(ので、originalEvent確保する)
         */
        _onMove: function(ev) {
            console.log('Scroll: onMove');
            ev = ev.originalEvent;
            ev.preventDefault();

            var tempTouchY = __isMobile ? ev.changedTouches[0].pageY : ev.pageY;
            var tempAreaY = this._getScrollAreaY();

            this._newAreaY = tempTouchY - this._startTouchY + this._startAreaY;
            this._setScrollAreaY(this._newAreaY);

            this._speedY = tempAreaY - this._preAreaY;
            if (this._speedY < -20) {
                this._speedY = -20 + this._speedY * 0.1;
            }
            if (this._speedY > 20) {
                this._speedY = 20 + this._speedY * 0.1;
            }
            this._preAreaY = tempAreaY;

            // バー
            this._newBarY = this._newAreaY * this._distBar / this._distScroll;
            this._followScrollBar();
        },

        /**
         * スクロールできる領域の現在位置を取得する
         *
         * @name getScrollAreaY
         * @return {Number}
         *     translateYの値
         */
        _getScrollAreaY: function() {
            var translate3d = __getTranslate3d(this._ui.scrollArea[0]);
            var y = translate3d.split(',')[1] || 0;
            y = parseInt(y, 10);
            console.log('Scroll: getScrollAreaY', y);
            return y;
        },

        /**
         * スクロールできる領域を動かす
         *
         * @name setScrollAreaY
         * @param {Number} y
         *     translateYの値
         */
        _setScrollAreaY: function(y) {
            y = parseInt(y, 10);
            console.log('Scroll: setScrollAreaY', y);
            __setTranslate3d(this._ui.scrollArea[0], 0, y);
        },

        /**
         * スクロールバーを追随させる
         *
         * @name followScrollBar
         */
        _followScrollBar: function() {
            if (this._disableScrollBar) { return; }
            console.log('Scroll: followScrollBar');
            this._newBarY = this._newAreaY * this._distBar / this._distScroll;
            __setTranslate3d(this._ui.scrollBar[0], 0, -this._newBarY);
        },

        /**
         * 慣性スクロール用のタイマーをセットする
         *
         * @name setTimer
         */
        _setTimer: function() {
            console.log('Scroll: setTimer');
            this._timer = setInterval($.proxy(this._loop, this), 15);
            return this;
        },

        /**
         * タイマーをリセットする
         *
         * @name clearTimer
         */
        _clearTimer: function() {
            console.log('Scroll: clearTimer');
            clearInterval(this._timer);
            this._timer = null;
            return this;
        },

        /**
         * 慣性スクロールのキモ
         * CSSのtransitionでもよかったかも？
         *
         * @name loop
         */
        _loop: function() {
            if (this._isTouching) { return; }

            var y = this._getScrollAreaY();
            // 上方向にひっぱりきった時
            if (y > 0) {
                console.log('Scroll: loop@ y > 0');
                this._newAreaY = y - y / 12;
                this._speedY = 0;
                this._setScrollAreaY(this._newAreaY);

                if (y < 2) {
                    this._setScrollAreaY(0);
                }
            }
            // 下方向にひっぱりきった時
            else if (y < -this._limitAreaY) {
                console.log('Scroll: loop@ y < limitArea');
                this._newAreaY = y + (-this._limitAreaY - y) / 12;
                this._speedY = 0;
                this._setScrollAreaY(this._newAreaY);

                if (y > -this._limitAreaY - 1) {
                    this._setScrollAreaY(this._limitAreaY);
                }
            }
            else {
                console.log('Scroll: loop');
                this._newAreaY = y + this._speedY;
                this._speedY *= 0.9;
                this._setScrollAreaY(this._newAreaY);

                if (Math.abs(this._speedY) < 0.1) {
                    this._speedY = 0;
                }
                if (this._speedY === 0) {
                    this._clearTimer();
                }
            }

            // バーは適当に扱う
            this._followScrollBar();
        }
    };

    return Scroll;

    // プライベート関数たち
    // ----------------------------------------------------------------------------
    /**
     * いまの環境で使えるtranslate3dの値をセット
     *
     * @param {HTMLElement} elm
     *     対象の要素
     * @param {Number} x
     *     translateX
     * @param {Number} y
     *     translateY
     * @param {Number} z
     *     translateZ
     */
    function __setTranslate3d(elm, x, y, z) {
        var val = [
            'translate3d(',
                (x || 0), 'px,',
                (y || 0), 'px,',
                (z || 0), 'px',
            ')'
        ].join('');
        elm.style[__supportTransform] = val;
    }

    /**
     * いまの環境で使えるtranslate3dの値を取得
     *
     * @param {HTMLElement} elm
     *     対象の要素
     * @return {String}
     *     translate3dの値
     */
    function __getTranslate3d(elm) {
        return elm.style[__supportTransform];
    }

}));
