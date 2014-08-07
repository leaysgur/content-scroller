jquery.content-scroller
=======================

ページ内の一部分をスクロールできるようにするやつ

See [Sample](#TBD)

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
var scroll = new Scroll({
    scrollWrap: $('#js-scroll-wrap'),
    scrollArea: $('#js-scroll-area'),
    scrollBar:  $('#js-scroll-bar')
});

scroll.start();
```

見た目はお好きにスタイリングしてください。

### 諸注意
- jQueryに依存しています
- PCのマウスホイール/トラックパッドの移動には対応してません
