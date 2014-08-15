jquery.content-scroller
=======================

ページ内の一部分をスクロールできるようにするやつ

See [Sample](http://labs.lealog.net/content-scroller-sample/)

### 使い方
最低限のサンプルです。

#### HTML
```html
<div id="js-scroll-wrap" class="scroll-wrap">
  <div id="js-scroll-bar" class="scroll-bar"></div>
  <div id="js-scroll-area" class="scroll-area">
    ここにそれはもう長い長いコンテンツを
  </div>
</div>
```

#### CSS
```css
.scroll-wrap {
  /* 必須 */
  position: relative;
  overflow: hidden;

  /* 必須ですが好きな高さに */
  height: 100px;
}

.scroll-area {
  /* 好きなスタイルに */
}

.scroll-bar {
  /* 必須 */
  position: absolute;
  right: 0;

  /* 必須ですが好きなスタイルに */
  width: 4px;
  background-color: rgba(0,0,0,.5);
}
```

#### JavaScript
```javascript
// 初期化は要素があればいつでもOKです
var scroll = new Scroll({
    scrollWrap: $('#js-scroll-wrap'),
    scrollArea: $('#js-scroll-area'),
    scrollBar:  $('#js-scroll-bar')
});

// これではじめてスクロールできるようになります
scroll.start();


// 使わなくなったらこれを
scroll.dispose();
```

見た目はお好きにスタイリングしてください。


### 初期化オプション

#### options.scrollWrap
``jQuery``でラップされた、スクロールで制御したい要素

#### options.scrollArea
``jQuery``でラップされた、実際にスクロールしたい要素

#### options.scrollBar
``jQuery``でラップされた、スクロールバーとして扱う要素

#### options.disableScrollBar
スクロールバーを使わないなら``true``(デフォルトは``false``)

#### options.startAtBottome
スクロールしきった状態からスタートするなら``true``(デフォルトは``false``)


### 諸注意
- jQueryに依存していますが、コードはプラグインっぽくないです
- 中途半端にちゃんとしてて、中途半端に雑な実装があります
- PCのマウスホイール/トラックパッドの移動には対応してません(=PCでは実質使いものにならない)
