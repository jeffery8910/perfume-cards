/* Perfume Cards: turns perfume + collection JSON into card markup.
   Shared by deck.html (the deck) and editor.html (live preview). */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function lines(v) {
    var arr = Array.isArray(v) ? v : String(v || "").split("\n");
    return arr.map(esc).join("<br>");
  }
  function accent(html) {
    return html.replace(/×/g, '<span class="x">×</span>').replace(/＋/g, '<span class="q">＋</span>');
  }
  function url(p) { return p ? (/^https?:/.test(p) ? p.replace(/"/g, "%22") : encodeURI(p)) : ""; }

  // ---- colors ----------------------------------------------------------
  function hexToRgb(h) {
    h = String(h || "#2F6B45").replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    var x = hexToRgb(a), y = hexToRgb(b);
    return "#" + x.map(function (v, i) {
      return Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, "0");
    }).join("");
  }
  // Fill in bg/soft from the one accent color when a perfume file leaves them out.
  function derive(p) {
    var dark = p.theme === "dark", c = p.color || "#2F6B45";
    return {
      dark: dark,
      m: c,
      bg: p.bg || (dark ? mix(c, "#141414", 0.82) : mix(c, "#ffffff", 0.87)),
      soft: p.soft || (dark ? mix(c, "#141414", 0.55) : mix(c, "#ffffff", 0.74))
    };
  }
  function vars(p) {
    var d = derive(p);
    return "--m:" + d.m + ";--m-bg:" + d.bg + ";--m-soft:" + d.soft;
  }
  // How a perfume shows up as a chip or layer (light: soft fill; dark: its own ground).
  function chipColors(p) {
    if (!p) return "--l-bg:var(--wood-soft);--l-fg:var(--wood)";
    var d = derive(p);
    return d.dark ? "--l-bg:" + d.bg + ";--l-fg:#EEF0FA" : "--l-bg:" + d.soft + ";--l-fg:" + d.m;
  }
  function photoVars(p) {
    var d = derive(p);
    return "--p-bg:" + (p.photoBg || (d.dark ? d.bg : "#ffffff")) + ";--fit:" + (p.photoFit || "cover") +
      ";--p-m:" + (d.dark ? "#EEF0FA" : d.m) + ";--p-on:" + (d.dark ? d.bg : "#ffffff");
  }
  function cls(p, base) { return base + (derive(p).dark ? " is-dark" : ""); }

  function dots(v) {
    if (v == null) return '<span class="na">資料不足</span>';
    var s = '<span class="dots" aria-label="' + v + ' 分">';
    for (var k = 0; k < 5; k++) s += k < v ? '<i class="on"></i>' : "<i></i>";
    return s + "</span>";
  }
  function foot(text) {
    return '<div class="foot"><span>' + esc(text || "") + '</span><span class="pg"></span></div>';
  }
  // No photo yet: draw a simple bottle in the perfume's own colors.
  function bottle(p, alt) {
    var d = derive(p), ink = d.dark ? "#EEF0FA" : d.m, glass = d.dark ? "rgba(255,255,255,.12)" : d.soft;
    return '<svg class="bottle" viewBox="0 0 120 150" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + esc(alt) + '（尚無照片）">' +
      '<rect x="46" y="10" width="28" height="20" rx="4" fill="' + ink + '"/><rect x="52" y="30" width="16" height="10" fill="' + ink + '" opacity=".7"/>' +
      '<rect x="24" y="40" width="72" height="96" rx="14" fill="' + glass + '" stroke="' + ink + '" stroke-width="2.5"/>' +
      '<rect x="36" y="70" width="48" height="36" rx="4" fill="' + (d.dark ? d.bg : "#fff") + '" stroke="' + ink + '" stroke-width="1.5"/>' +
      '<text x="60" y="93" text-anchor="middle" font-size="11" font-weight="700" fill="' + ink + '" font-family="sans-serif">' + esc((p.en || p.name || "").slice(0, 10)) + "</text></svg>";
  }
  // ---- photos --------------------------------------------------------
  // A viewer can swap in their own bottle photo; it stays in their browser only.
  var MYKEY = "perfume-cards:my-photos", REG = {}, mine = null;
  function myPhotos() {
    if (mine) return mine;
    try { mine = JSON.parse(localStorage.getItem(MYKEY)) || {}; } catch (e) { mine = {}; }
    return mine;
  }
  function setMyPhoto(ref, dataURL) {
    var m = myPhotos();
    if (dataURL) m[ref] = dataURL; else delete m[ref];
    try { localStorage.setItem(MYKEY, JSON.stringify(m)); return true; }
    catch (e) { if (dataURL) delete m[ref]; return false; }
  }
  function img(p, alt, opts) {
    opts = opts || {};
    if (p.ref) REG[p.ref] = p;
    var own = p.ref && myPhotos()[p.ref];
    var src = own || p.photo, html;
    if (!src) html = bottle(p, alt);
    else html = '<img src="' + (own ? own : url(src)) + '" alt="' + esc(alt) + '" referrerpolicy="no-referrer"' + (own ? ' style="object-fit:cover"' : "") +
      ' onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'img-miss\',textContent:\'圖片載入失敗\'}))">';
    var credit = own ? "我拍的" : (src ? p.photoCredit : "");
    if (credit) {
      var link = !own && (p.photoSource || p.link);
      html += link ? '<a class="credit" href="' + esc(link) + '" target="_blank" rel="noopener">圖：' + esc(credit) + "</a>"
                   : '<span class="credit">圖：' + esc(credit) + "</span>";
    }
    if (opts.changeable && p.ref) {
      html += '<span class="photo-btns web-only"><button type="button" data-photo="' + esc(p.ref) + '">' + (own ? "換照片" : "用我的照片") + "</button>" +
        (own ? '<button type="button" data-photo-reset="' + esc(p.ref) + '">還原</button>' : "") + "</span>";
    }
    return html;
  }
  function wrapImg(p, alt, opts) {
    return '<span class="img-slot" data-img="' + esc(p.ref || "") + '" data-alt="' + esc(alt) + '" data-ch="' + (opts && opts.changeable ? 1 : 0) + '">' + img(p, alt, opts) + "</span>";
  }
  function refreshPhoto(ref) {
    var p = REG[ref]; if (!p) return;
    document.querySelectorAll('.img-slot[data-img="' + ref.replace(/"/g, "") + '"]').forEach(function (slot) {
      slot.innerHTML = img(p, slot.dataset.alt, { changeable: slot.dataset.ch === "1" });
    });
  }
  // Shrink a picked photo to at most 900 px so many fit in browser storage.
  function readPhoto(file) {
    return new Promise(function (resolve, reject) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var k = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u); resolve(c.toDataURL("image/jpeg", 0.82));
      };
      im.onerror = function () { URL.revokeObjectURL(u); reject(new Error("讀不到這張照片")); };
      im.src = u;
    });
  }
  var picker;
  function bindPhotoButtons(notify) {
    notify = notify || function () {};
    picker = document.createElement("input"); picker.type = "file"; picker.accept = "image/*"; picker.hidden = true;
    document.body.appendChild(picker);
    var target = null;
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-photo]");
      if (b) { e.preventDefault(); target = b.dataset.photo; picker.value = ""; picker.click(); return; }
      var r = e.target.closest("[data-photo-reset]");
      if (r) { e.preventDefault(); setMyPhoto(r.dataset.photoReset, null); refreshPhoto(r.dataset.photoReset); notify("已換回網站圖片", r.dataset.photoReset); }
    });
    picker.addEventListener("change", function () {
      var f = picker.files[0]; if (!f || !target) return;
      var ref = target;
      readPhoto(f).then(function (d) {
        if (setMyPhoto(ref, d)) { refreshPhoto(ref); notify("已換成你的照片，只存在這台裝置", ref); }
        else notify("瀏覽器空間不夠，先還原幾張照片再試", ref);
      }).catch(function (e) { notify(e.message, ref); });
    });
  }

  function displayName(p) { return p.brandZh ? p.brandZh + " " + p.name : p.name; }

  // ---- cards -----------------------------------------------------------
  function coverCard(col, ctx) {
    var c = col.cover || {};
    var photos = (col.base || []).map(function (b) {
      var p = ctx.perfumes[b.ref];
      return '<div class="ph" style="' + photoVars(p) + '">' + wrapImg(p, displayName(p)) +
        '<span class="cap">' + esc(b.cap || displayName(p)) + "</span></div>";
    }).join("");
    return '<section class="card cover" data-kind="cover" aria-label="封面"><div class="in">' +
      '<div class="eyebrow">' + esc(c.eyebrow) + "</div>" +
      '<h2 class="h">' + accent(lines(c.title || col.title)) + "</h2>" +
      (c.lead ? '<p class="lead">' + esc(c.lead) + "</p>" : "") +
      '<div class="cover-photos" style="--n:' + Math.max(1, (col.base || []).length) + '">' + photos + "</div>" +
      foot(c.foot || "往左滑看完整比較") + "</div></section>";
  }

  function baseCard(b, p) {
    var s = "";
    if (p.notes) {
      var rows = [["top", "前調"], ["heart", "中調"], ["base", "後調"]];
      s += '<div class="notes">' + rows.filter(function (r) { return (p.notes[r[0]] || []).length; }).map(function (r) {
        return '<div class="note ' + r[0] + '"><b>' + r[1] + '</b><div class="chips">' +
          p.notes[r[0]].map(function (x) { return '<span class="chip">' + esc(x) + "</span>"; }).join("") + "</div></div>";
      }).join("") + "</div>";
    }
    if (p.classification) {
      s += '<div class="blk"><div class="label">' + esc(p.classificationLabel || "香氣分類") + '</div><div class="bigfact">' + esc(p.classification) + "</div></div>";
    }
    if (p.materials && p.materials.length) {
      s += '<div class="blk"><div class="label">' + esc(p.materialsLabel || "代表香材") + '</div><div class="chips">' +
        p.materials.map(function (x) { return '<span class="chip">' + esc(x) + "</span>"; }).join("") + "</div></div>";
    }
    if (p.smell) s += '<div class="smell"><span class="tag">' + esc(p.source || "推論") + "</span>" + esc(p.smell) + "</div>";
    if (p.warning) s += '<div class="warn"><strong>注意</strong>　' + esc(p.warning) + "</div>";
    return '<section class="' + cls(p, "card") + '" style="' + vars(p) + '" data-kind="base" aria-label="' + esc(displayName(p)) + '"><div class="in">' +
      '<div class="prod-head"><div class="prod-img" style="' + photoVars(p) + '">' + wrapImg(p, displayName(p) + " 瓶身", { changeable: true }) + "</div>" +
      '<div class="prod-name"><div class="eyebrow">' + esc(b.label || "") + '</div><h2 class="h">' +
      (p.brandZh ? esc(p.brandZh) + "<br>" : "") + esc(p.name) + "</h2>" +
      '<div class="sub">' + esc(p.sub || [p.brand, p.en].filter(Boolean).join(" · ")) + "</div></div></div>" +
      s + foot(p.notesSource || "香調依公開資料整理") + "</div></section>";
  }

  function blendCard(col, ctx) {
    var bl = col.blend;
    var layers = (bl.layers || []).map(function (l) {
      var st = l.ref ? chipColors(ctx.perfumes[l.ref]) : chipColors(null);
      return '<div class="layer" style="' + st + '">' + esc(l.text) + "<small>" + esc(l.from || "") + "</small></div>";
    }).join("");
    var dirs = (bl.directions || []).length ?
      '<div class="blk"><div class="groupname">' + esc(bl.directionsLabel || "第三支決定方向") + '</div><div class="dirs" style="--n:' + bl.directions.length + '">' +
      bl.directions.map(function (d) { return '<div class="dir">' + esc(d.name) + "<span>" + esc(d.hint || "") + "</span></div>"; }).join("") + "</div></div>" : "";
    return '<section class="card" data-kind="blend" aria-label="基底疊香"><div class="in">' +
      '<div class="eyebrow">' + esc(bl.eyebrow || "先疊基底") + '</div><h2 class="h">' + accent(lines(bl.title)) + "</h2>" +
      '<div class="stack">' + layers + "</div>" +
      (bl.result ? '<div class="result">' + esc(bl.result) + "</div>" : "") +
      (bl.desc ? '<p class="lead"><span class="tag">推論</span>' + esc(bl.desc) + "</p>" : "") + dirs +
      foot(bl.foot || "推論為主觀預測，非實測") + "</div></section>";
  }

  function ratePanel(c, p, metrics) {
    var rows = metrics.map(function (m) {
      var pips = "";
      for (var v = 1; v <= 5; v++) pips += '<button type="button" class="pip" data-v="' + v + '" aria-label="' + esc(m.label) + " " + v + ' 分" aria-pressed="false">' + v + "</button>";
      return '<div class="bk-r"><div class="bk-rl"><b>' + esc(m.label) + "</b><small>" + esc(m.hint || "") + '</small></div><div class="pips" data-m="' + esc(m.key) + '" role="group" aria-label="' + esc(m.label) + '">' + pips + "</div></div>";
    }).join("");
    var id = "feel-" + c.ref.replace(/[^a-z0-9]/gi, "-");
    return '<div class="rate web-only" data-ref="' + esc(c.ref) + '" role="region" aria-label="' + esc(p.name) + ' 我的評分">' +
      '<div class="rate-head"><div class="label">我的評分</div><div class="bk-total"><b data-total>–</b><i>/' + metrics.length * 5 + "</i></div></div>" +
      '<div class="bk-rows">' + rows + "</div>" +
      '<div class="bk-f"><label for="' + id + '">我的感受</label><textarea id="' + id + '" data-field="feel" rows="3" placeholder="例如：30 分鐘後木質變明顯"></textarea></div>' +
      '<span class="save-state" aria-live="polite">還沒評分</span></div>';
  }

  function candCard(c, p, i, ctx, opts) {
    opts = opts || {};
    var bases = ctx.base || [];
    var hasScore = Object.prototype.hasOwnProperty.call(c, "score");
    var badge = '<div class="pc-score"><span>' + esc(c.scoreLabel || "疊香相容性") + "</span>" +
      (hasScore && c.score != null ? dots(c.score) : "<b>資料不足</b>") + "</div>";
    var mats = (p.materials && p.materials.length) ?
      '<div class="chips">' + p.materials.map(function (x) { return '<span class="chip">' + esc(x) + "</span>"; }).join("") + "</div>" :
      '<div class="pc-na">' + esc(p.materialsNote || "完整香調尚未核實") + "</div>";
    var d = derive(p);
    var formula = bases.map(function (b) {
      return '<span class="f" style="' + chipColors(ctx.perfumes[b.ref]) + '">' + esc(b.short || ctx.perfumes[b.ref].name) + "</span>";
    }).concat(['<span class="f" style="--l-bg:' + d.m + ";--l-fg:" + (d.dark ? d.bg : "#fff") + '">' + esc(p.name) + "</span>"])
      .join('<span class="op">＋</span>');
    var eyebrow = [p.brand, c.eyebrow || p.series, i ? "第 " + i + " 款" : ""].filter(Boolean).join(" · ");
    return '<section class="' + cls(p, "card pc") + '" style="' + vars(p) + '" data-kind="candidate" data-ref="' + esc(c.ref) + '" aria-label="' + esc(p.name) + '"><div class="in">' +
      '<div class="pc-top"><div class="pc-head"><div class="eyebrow">' + esc(eyebrow) + "</div>" +
      '<h2 class="pc-name' + (p.name.length >= 7 ? " long" : "") + '">' + esc(p.name) + "<em>" + esc(p.en || "") + "</em></h2>" + badge + "</div>" +
      '<div class="pc-img" style="' + photoVars(p) + '">' + wrapImg(p, p.name + " 瓶身", { changeable: true }) + "</div></div>" +
      '<div class="pc-box"><div class="pc-label">單獨聞起來 <span class="tag">' + esc(p.source || "推論") + "</span></div>" + mats +
      '<p class="pc-text">' + esc(p.smell || "") + "</p></div>" +
      '<div class="pc-box"><div class="pc-label">' + (bases.length ? "疊起來" : "搭配") + ' <span class="tag">推論</span></div>' +
      '<div class="formula">' + formula + "</div>" +
      '<div class="pc-result">' + esc(c.result || "") + '</div><p class="pc-text">' + esc(c.why || "") + "</p></div>" +
      (c.conflict ? '<div class="pc-con"><b>可能衝突</b>' + esc(c.conflict) + "</div>" : "") +
      (opts.metrics ? ratePanel(c, p, opts.metrics) : "") +
      foot(c.foot || "疊加效果為主觀推論，非實測") + "</div></section>";
  }

  function matrixCard(m) {
    var n = (m.columns || []).length;
    var rows = (m.rows || []).map(function (r) {
      return '<div class="mx-row' + (r.highlight ? " top" : "") + '"><div class="mx-n"><b>' + esc(r.name) + "</b><small>" + esc(r.desc || "") + "</small></div>" +
        (r.values || []).map(function (v) { return "<div>" + dots(v) + "</div>"; }).join("") + "</div>";
    }).join("");
    return '<section class="card" data-kind="matrix" aria-label="' + esc(Array.isArray(m.title) ? m.title.join("") : m.title) + '"><div class="in">' +
      '<div class="eyebrow">' + esc(m.eyebrow || "") + '</div><h2 class="h">' + lines(m.title) + "</h2>" +
      (m.lead ? '<p class="lead">' + esc(m.lead) + "</p>" : "") +
      '<div class="mx" style="--n:' + n + '"><div class="mx-head"><span></span>' + m.columns.map(function (c) { return "<span>" + esc(c) + "</span>"; }).join("") + "</div>" + rows + "</div>" +
      foot(m.foot || "主觀預測，非實測") + "</div></section>";
  }

  function listCard(m) {
    var items = (m.items || []).map(function (it) {
      return '<div class="fr-row' + (it.highlight ? " hi" : "") + '"><b>' + esc(it.name) + (it.badge ? "<em>" + esc(it.badge) + "</em>" : "") + "</b>" +
        (it.materials ? '<span class="fr-m">' + esc(it.materials) + "</span>" : "") + '<span class="fr-d">' + esc(it.desc || "") + "</span></div>";
    }).join("");
    return '<section class="card" data-kind="list" aria-label="' + esc(Array.isArray(m.title) ? m.title.join("") : m.title) + '"><div class="in">' +
      '<div class="eyebrow">' + esc(m.eyebrow || "") + '</div><h2 class="h">' + lines(m.title) + "</h2>" +
      (m.lead ? '<p class="lead">' + esc(m.lead) + "</p>" : "") + '<div class="fr">' + items + "</div>" +
      (m.warning ? '<div class="warn-l"><b>注意</b>' + esc(m.warning) + "</div>" : "") +
      foot(m.foot || "描述為推論") + "</div></section>";
  }

  function summaryCard(col, ctx) {
    var ms = col.rating.metrics;
    var head = ms.map(function (m) { return "<span>" + esc(m.label) + "</span>"; }).join("") + "<span>總分</span>";
    var rows = (col.candidates || []).map(function (c) {
      var p = ctx.perfumes[c.ref];
      return '<div class="rt-row"><div class="rt-n">' + esc(p.name) + "</div>" +
        ms.map(function (m) { return '<div class="sc" data-ref="' + esc(c.ref) + '" data-k="' + esc(m.key) + '"><b></b><i>/5</i></div>'; }).join("") +
        '<div class="rt-tot"><b data-tot="' + esc(c.ref) + '"></b><i>/' + ms.length * 5 + "</i></div></div>" +
        '<p class="rt-feel web-only" data-feel="' + esc(c.ref) + '" hidden></p>';
    }).join("");
    return '<section class="card" data-kind="summary" aria-label="我的評分總表"><div class="in">' +
      '<div class="eyebrow">試香後自己填 · 我的評分表</div><h2 class="h">我的評分總表</h2>' +
      '<p class="lead">每格 1–5 分。' + (ctx.base.length ? "「" + esc(ms[1] ? ms[1].label : "疊香後") + "」是加上基底一起聞。" : "") + "</p>" +
      '<div class="rt" style="--n:' + ms.length + '"><div class="rt-head"><span></span>' + head + "</div>" + rows + "</div>" +
      foot("網頁版會自動彙整每款香水卡上打的分數") + "</div></section>";
  }

  function logCard(col, ctx) {
    var shorts = (col.base || []).map(function (b) { return b.short || ctx.perfumes[b.ref].name; });
    var f = [["log-date", "日期"], ["log-weather", "天氣／溫度"], ["log-third", shorts.length ? "搭配的那一支" : "香水"], ["log-where", "噴的位置"]];
    var t = [["log-10", "10 分鐘"], ["log-30", "30 分鐘"], ["log-120", "2 小時後"]];
    var stars = "";
    for (var i = 1; i <= 5; i++) stars += '<button type="button" class="star" data-v="' + i + '" aria-label="' + i + ' 顆星">★</button>';
    return '<section class="card" data-kind="log" aria-label="試香紀錄"><div class="in">' +
      '<div class="eyebrow">試香後自己填 · 試香紀錄</div><h2 class="h">' + accent(esc(shorts.concat(["______"]).join("＋"))) + "</h2>" +
      '<div class="lg-grid">' + f.map(function (x) { return '<div class="lg-f"><label for="' + x[0] + '">' + x[1] + '</label><input id="' + x[0] + '" data-f="' + x[0] + '" class="ln" autocomplete="off"></div>'; }).join("") + "</div>" +
      '<div class="lg-sub">聞起來的變化</div><div class="lg-times">' +
      t.map(function (x) { return '<div class="lg-t"><label for="' + x[0] + '">' + x[1] + '</label><textarea id="' + x[0] + '" data-f="' + x[0] + '" class="ln" rows="2"></textarea></div>'; }).join("") + "</div>" +
      '<div class="lg-like"><div class="lg-l"><span>整體喜歡程度</span><div class="stars" role="group" aria-label="整體喜歡程度">' + stars + "</div></div>" +
      '<div class="lg-l"><span>還會這樣疊嗎</span><div class="yn"><button type="button" class="yb" data-yn="yes">會</button><button type="button" class="yb" data-yn="maybe">再試試</button><button type="button" class="yb" data-yn="no">不會</button></div></div></div>' +
      '<div class="lg-t note"><label for="log-note">筆記</label><textarea id="log-note" data-f="log-note" class="ln" rows="3"></textarea></div>' +
      '<div class="foot"><span>可以截圖這張，每次試香填一張</span><button type="button" class="btn solid web-only" data-act="savelog">儲存這筆紀錄</button><span class="pg"></span></div>' +
      "</div></section>";
  }

  // ---- data loading ----------------------------------------------------
  function getJSON(path) {
    return fetch(path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("讀不到 " + path + "（" + r.status + "）");
      return r.json();
    });
  }
  function loadCollection(id) {
    return getJSON("data/collections/" + id + ".json").then(function (col) {
      col.id = col.id || id;
      col.base = col.base || [];
      col.candidates = col.candidates || [];
      col.comparisons = col.comparisons || [];
      var refs = {};
      col.base.forEach(function (b) { refs[b.ref] = 1; });
      col.candidates.forEach(function (c) { refs[c.ref] = 1; });
      (col.blend && col.blend.layers || []).forEach(function (l) { if (l.ref) refs[l.ref] = 1; });
      var keys = Object.keys(refs);
      return Promise.all(keys.map(function (k) { return getJSON("data/perfumes/" + k + ".json"); })).then(function (list) {
        var perfumes = {};
        keys.forEach(function (k, i) { perfumes[k] = list[i]; perfumes[k].ref = k; });
        return { col: col, ctx: { perfumes: perfumes, base: col.base } };
      });
    });
  }

  function renderDeck(col, ctx) {
    var out = [];
    if (col.cover !== false) out.push(coverCard(col, ctx));
    col.base.forEach(function (b) { out.push(baseCard(b, ctx.perfumes[b.ref])); });
    if (col.blend) out.push(blendCard(col, ctx));
    var metrics = col.rating && col.rating.metrics;
    col.candidates.forEach(function (c, i) { out.push(candCard(c, ctx.perfumes[c.ref], i + 1, ctx, { metrics: metrics })); });
    col.comparisons.forEach(function (m) { out.push(m.type === "list" ? listCard(m) : matrixCard(m)); });
    if (metrics && col.rating.summary !== false) out.push(summaryCard(col, ctx));
    if (col.rating && col.rating.log) out.push(logCard(col, ctx));
    return out.join("\n");
  }
  function numberPages(root) {
    var cards = root.querySelectorAll(".card");
    var n = String(cards.length).padStart(2, "0");
    cards.forEach(function (c, i) {
      var pg = c.querySelector(".pg");
      if (pg) pg.textContent = String(i + 1).padStart(2, "0") + " / " + n;
    });
  }

  window.PC = { esc: esc, derive: derive, loadCollection: loadCollection, getJSON: getJSON, renderDeck: renderDeck,
    numberPages: numberPages, candCard: candCard, baseCard: baseCard, img: img, wrapImg: wrapImg,
    refreshPhoto: refreshPhoto, bindPhotoButtons: bindPhotoButtons, readPhoto: readPhoto };
})();
