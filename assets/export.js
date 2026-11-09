/* Save cards as 1080×1350 PNGs on the viewer's own device.
   Uses html-to-image (renders through the browser itself, so the card CSS is kept).
   On phones it opens the share sheet (save to Photos); elsewhere it downloads. */
(function () {
  "use strict";
  var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function cloneFixed(card) {
    var wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;left:-12000px;top:0;width:1080px;pointer-events:none";
    var c = card.cloneNode(true);
    c.classList.add("fixed");
    // carry over typed values (clones lose them)
    // Images on other sites need CORS to be drawn; route them through a public image proxy.
    Array.prototype.forEach.call(c.querySelectorAll("img"), function (im) {
      var u = im.getAttribute("src") || "";
      if (/^https?:/.test(u) && u.indexOf(location.origin) !== 0) im.setAttribute("src", "https://images.weserv.nl/?url=" + encodeURIComponent(u));
    });
    var src = card.querySelectorAll("textarea,input"), dst = c.querySelectorAll("textarea,input");
    for (var i = 0; i < src.length; i++) dst[i].value = src[i].value;
    wrap.appendChild(c);
    document.body.appendChild(wrap);
    return { wrap: wrap, node: c };
  }

  function render(card) {
    var lib = window.htmlToImage;
    if (!lib) return Promise.reject(new Error("圖片工具沒有載入"));
    var t = cloneFixed(card);
    var opts = { width: 1080, height: 1350, pixelRatio: 1, cacheBust: false, backgroundColor: getComputedStyle(t.node).backgroundColor };
    var go = function (o) { return lib.toBlob(t.node, o); };
    // Safari often paints images only on the second pass.
    var p = (isIOS ? go(opts).then(function () { return go(opts); }) : go(opts))
      .catch(function () { return go(Object.assign({}, opts, { skipFonts: true })); });
    return p.then(function (blob) { t.wrap.remove(); return blob; }, function (e) { t.wrap.remove(); throw e; });
  }

  function deliver(files, title) {
    if (navigator.canShare && navigator.canShare({ files: files })) {
      return navigator.share({ files: files, title: title }).then(function () { return "shared"; }, function (e) {
        if (e && e.name === "AbortError") return "cancelled";
        return download(files);
      });
    }
    return download(files);
  }
  function download(files) {
    files.forEach(function (f, i) {
      setTimeout(function () {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(f); a.download = f.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      }, i * 350);
    });
    return Promise.resolve("downloaded");
  }

  function prepare(cards, baseName, onProgress) {
    var files = [], i = 0;
    function next() {
      if (i >= cards.length) return Promise.resolve(files);
      var n = i;
      if (onProgress) onProgress(n + 1, cards.length);
      return render(cards[n]).then(function (blob) {
        var name = baseName + (cards.length > 1 ? "-" + String(n + 1).padStart(2, "0") : "") + ".png";
        files.push(new File([blob], name, { type: "image/png" }));
        i++; return next();
      });
    }
    return next();
  }

  // A small sheet: shows progress, then a fresh tap to share (phones require
  // the share to start from a tap, and rendering takes a moment).
  var sheet;
  function ui() {
    if (sheet) return sheet;
    sheet = document.createElement("div");
    sheet.className = "xsheet"; sheet.hidden = true;
    sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-labelledby", "xsheet-h");
    sheet.innerHTML = '<div class="xsheet-box"><h2 id="xsheet-h">存成圖片</h2><p class="xsheet-msg"></p>' +
      '<div class="xsheet-prev"></div><div class="xsheet-act"><button type="button" class="btn solid" data-x="share">存到手機</button>' +
      '<button type="button" class="btn" data-x="dl">下載</button><button type="button" class="btn" data-x="close">關閉</button></div></div>';
    document.body.appendChild(sheet);
    sheet.addEventListener("click", function (e) {
      if (e.target === sheet) close();
      var b = e.target.closest("[data-x]"); if (!b) return;
      if (b.dataset.x === "close") close();
      if (b.dataset.x === "dl") download(sheet._files || []);
      if (b.dataset.x === "share") deliver(sheet._files || [], sheet._title).then(function (r) { if (r === "shared") close(); });
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheet.hidden) close(); });
    return sheet;
  }
  function close() { sheet.hidden = true; (sheet._urls || []).forEach(URL.revokeObjectURL); if (sheet._opener) sheet._opener.focus(); }

  function saveCards(cards, baseName) {
    var s = ui(), msg = s.querySelector(".xsheet-msg"), prev = s.querySelector(".xsheet-prev"), act = s.querySelector(".xsheet-act");
    s._opener = document.activeElement; s._title = baseName; s._files = null;
    prev.textContent = ""; act.hidden = true; s.hidden = false;
    var canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([""], "a.png", { type: "image/png" })] }));
    s.querySelector('[data-x="share"]').hidden = !canShare;
    msg.textContent = "準備圖片中…";
    return prepare(cards, baseName, function (n, total) { msg.textContent = "準備圖片中… " + n + " / " + total; }).then(function (files) {
      s._files = files; s._urls = [];
      files.slice(0, 6).forEach(function (f) { var im = document.createElement("img"); var u = URL.createObjectURL(f); s._urls.push(u); im.src = u; im.alt = f.name; prev.appendChild(im); });
      msg.textContent = files.length + " 張圖片準備好了（1080×1350）。" + (canShare ? "按「存到手機」選「儲存影像」。" : "按「下載」存到這台裝置。");
      act.hidden = false;
      var first = act.querySelector(canShare ? '[data-x="share"]' : '[data-x="dl"]'); first.focus();
    }).catch(function (e) {
      msg.textContent = "圖片產生失敗：" + (e && e.message || e) + "。可以改用螢幕截圖。"; act.hidden = false;
    });
  }

  window.CardExport = { saveCards: saveCards, prepare: prepare };
})();
