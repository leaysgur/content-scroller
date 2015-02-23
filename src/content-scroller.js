// 依存解決とエクスポート(何にも依存しなくなったので、こうしなくても良い)
// ----------------------------------------------------------------------------
(function(global, factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define(['exports'], function(exports) {
            return factory(global, exports);
        });
    } else {
        global.Scroll = factory(global, {});
    }

}(window, function(global, Scroll, undefined) {
    'use strict';

    var document = global.document;

    // 環境情報やら定数やら
    // ----------------------------------------------------------------------------
    var document = global.document;
    var q = function(id) { return document.getElementById(id); };
    var __isMobile = 'ontouchstart' in global;
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

    // 誤タップを無視する範囲
    var TOUCH_MISS_GAP = 5;
    // 早すぎる動きを抑制する範囲
    var EXCEED_SWING_GAP = 20;
    // 慣性スクロールのループを実行するタイミング(小さいほどスムーズだが無駄)
    var INERTIA_DURATION = 15;


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
         * @param {HTMLElement} options.scrollWrap
         *     親コンテナ(overflow: hiddenを期待する方)
         * @param {HTMLElement} options.scrollArea
         *     スクロールさせたいコンテナ
         * @param {HTMLElement} options.scrollBar
         *     スクロールバーに使う要素
         * @param {Boolean} options.disableScrollbar
         *     スクロールバー見せない or NOT (デフォルトでは見せるのでfalse)
         * @param {Boolean} options.startAtBottom
         *     スクロールしきった状態ではじめる or NOT (デフォルトはfalse)
         */
        initialize: function(options) {
            options = options || {};
            console.log('Scroll: initialize', options);

            this._ui = {};
            this._ui.scrollWrap = options.scrollWrap || __id('js-scroll-wrap');
            this._ui.scrollArea = options.scrollArea || __id('js-scroll-area');
            this._ui.scrollBar  = options.scrollBar  || __id('js-scroll-bar');

            // 要素ちゃんとある？
            this._ensureElm();

            // スクロールバー出すかどうか
            this._disableScrollBar = options.disableScrollBar || false;

            // スクロールしきった状態からはじめるかどうか
            this._startAtBottom = options.startAtBottom || false;

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
         * なかったらエラーを投げる
         *
         * @name ensureElm
         * @return {Boolean}
         *     要素がちゃんとあったかどうか
         */
        _ensureElm: function() {
            var isWrapMiss = !this._ui.scrollWrap;
            var isAreaMiss = !this._ui.scrollArea;

            if (isWrapMiss || isAreaMiss) {
                throw new Error('#scrollWrap or #scrollArea is not exist!');
            }
            return true;
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
            // モバイルじゃなければ何もせずそれらしく
            if (!__isMobile) {
                this._ui.scrollWrap.style['overflow'] = 'scroll';
                return;
            }
            var containerHeight = this._ui.scrollWrap.offsetHeight;
            var scrollAreaHeight = this._ui.scrollArea.offsetHeight;
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

            // 最初にstyle当てておかないと、次取れなくて困る
            // オプションによってスクロールしきった状態からスタート
            if (this._startAtBottom) {
                this._setScrollAreaY(-this._limitAreaY);
            } else {
                this._setScrollAreaY(0);
            }
            console.log('Scroll: start', this);
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
                this._setScrollBarHeight(0);
            }
            // 同じ要素を使いまわすこともあるので、リセットしておく
            this._setScrollAreaY(0);
            this._removeEventLitener();
            this._clearTimer();
        },

        handleEvent: function(ev) {
            switch (ev.type) {
            case 'touchstart':
                this._onStart(ev);
                break;
            case 'touchmove':
                this._onMove(ev);
                break;
            case 'touchend':
                this._onEnd(ev);
                break;
            }
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
            this._setScrollBarHeight(height);
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
            this._ui.scrollArea.addEventListener('touchstart', this, false);
            this._ui.scrollArea.addEventListener('touchend',   this, false);
            return this;
        },

        /**
         * スクロールするためのイベントをはがす
         *
         * @name removeEventListener
         */
        _removeEventLitener: function() {
            console.log('Scroll: removeEventListener');
            this._ui.scrollArea.removeEventListener('touchstart', this, false);
            this._ui.scrollArea.removeEventListener('touchend',   this, false);
            this._ui.scrollArea.removeEventListener('touchmove',  this, false);
            return this;
        },

        /**
         * スクロールしようとタップした瞬間のハンドラ
         *
         * @name onStart
         * @param {Object} ev
         *     Eventオブジェクト
         */
        _onStart: function(ev) {
            console.log('Scroll: onStart');

            this._clearTimer();
            this._isTouching = true;
            this._preAreaY = 0;
            this._speedY = 0;

            this._startTouchY = ev.changedTouches[0].pageY;
            this._startAreaY = this._getScrollAreaY();
            this._ui.scrollArea.addEventListener('touchmove', this, false);
        },

        /**
         * スクロールしおわり、またはタップしただけのハンドラ
         *
         * @name onEnd
         * @param {Object} ev
         *     Eventオブジェクト
         */
        _onEnd: function(ev) {
            console.log('Scroll: onEnd');

            var tempTouch = ev.changedTouches[0].pageY;
            // 誤タップを無視
            if ((this._startTouchY - tempTouch) < TOUCH_MISS_GAP && (this._startTouchY - tempTouch) > -TOUCH_MISS_GAP) {
                this._speedY = 0;
            }
            if ((this._startTouchY - tempTouch) < 0 && this._speedY < 0) {
                this._speedY *= -1;
            }

            this._isTouching = false;
            this._ui.scrollArea.removeEventListener('touchmove', this, false);

            this._setTimer();
        },

        /**
         * スクロール中のハンドラ
         *
         * @name onMove
         * @param {Object} ev
         *     Eventオブジェクト
         */
        _onMove: function(ev) {
            console.log('Scroll: onMove');
            ev.preventDefault();

            var tempTouchY = ev.changedTouches[0].pageY;
            var tempAreaY = this._getScrollAreaY();

            this._newAreaY = tempTouchY - this._startTouchY + this._startAreaY;
            this._setScrollAreaY(this._newAreaY);

            this._speedY = tempAreaY - this._preAreaY;
            // 素早くスワイプしてふっとぶのを防止
            if (this._speedY < -EXCEED_SWING_GAP) {
                this._speedY = -EXCEED_SWING_GAP + this._speedY * 0.1;
            }
            if (this._speedY > EXCEED_SWING_GAP) {
                this._speedY = EXCEED_SWING_GAP + this._speedY * 0.1;
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
            var translate3d = __getTranslate3d(this._ui.scrollArea);
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
            __setTranslate3d(this._ui.scrollArea, 0, y);
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
            __setTranslate3d(this._ui.scrollBar, 0, -this._newBarY);
        },

        /**
         * スクロールバーに高さをあたえる
         *
         * @name setScrollBarHeight
         * @param {Number} height
         *     高さ
         */
        _setScrollBarHeight: function(height) {
            height = height|0;
            console.log('Scroll: setScrollBarHeight', height);
            this._ui.scrollBar.style.height = height + 'px';
        },

        /**
         * 慣性スクロール用のタイマーをセットする
         *
         * @name setTimer
         */
        _setTimer: function() {
            console.log('Scroll: setTimer');
            var that = this;
            this._timer = setInterval(function() {
                that._loop();
            }, INERTIA_DURATION);
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
         * マジックナンバー祭りに見えるがこれこそがUXへの飽くなき挑戦である
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
            // それ以外は緩やかに減速
            else {
                console.log('Scroll: loop@');
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

            // バーは適当に動いてもらって良くて、はみ出てそれらしく見える
            this._followScrollBar();
        }
    };

    return Scroll;


    // プライベート関数たち
    // ----------------------------------------------------------------------------
    // getElementByIdのショートカット
    function __id(id) { return document.getElementById(id); };

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
