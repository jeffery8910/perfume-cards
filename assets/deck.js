/* Deck page: loads ?c=<collection>, renders the cards, and keeps the viewer's
   own scores, feelings and trial logs in this browser (with backup export). */
(function () {
  "use strict";
  var qs = new URLSearchParams(location.search);
  var id = (qs.get("c") || "").replace(/[^a-z0-9_-]/gi, "");
  var SHOT = qs.get("shot") === "1";
  if (SHOT) document.documentElement.classList.add("shot");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var deck = $("#deck");

  if (!id) { location.replace("index.html"); return; }

  PC.loadCollection(id).then(function (res) {
    var col = res.col, ctx = res.ctx;
    document.title = col.title || "香水卡";
    $("#title").textContent = col.title || "";
    $("#desc").textContent = col.description || "";
    deck.innerHTML = PC.renderDeck(col, ctx);
    PC.numberPages(deck);
    if (!SHOT) { initState(col, ctx); addExport(col); }
    var imgs = $$("img", deck).map(function (im) {
      return im.complete ? Promise.resolve() : new Promise(function (r) { im.onload = im.onerror = r; });
    });
    Promise.all(imgs.concat([document.fonts ? document.fonts.ready : Promise.resolve()])).then(function () {
      document.body.dataset.ready = "1";
    });
  }).catch(function (e) {
    deck.innerHTML = '<p class="status err">' + PC.esc(e.message) +
      "。如果你是直接打開本機檔案，請改用 GitHub Pages 網址，或在資料夾執行 <code>npx serve</code> 再開。</p>";
    document.body.dataset.ready = "1";
  });

  function addExport(col) {
    $$(".card", deck).forEach(function (card, i) {
      var f = $(".foot", card); if (!f) return;
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn-export web-only"; b.textContent = "存成圖片";
      b.setAttribute("aria-label", "把第 " + (i + 1) + " 張存成圖片");
      b.addEventListener("click", function () { CardExport.saveCards([card], col.id + "-" + String(i + 1).padStart(2, "0")); });
      f.insertBefore(b, $(".pg", f));
    });
    $("#save-all").addEventListener("click", function () { CardExport.saveCards($$(".card", deck), col.id); });
  }

  function initState(col, ctx) {
    var metrics = (col.rating && col.rating.metrics || []).map(function (m) { return m.key; });
    var MAX = metrics.length * 5;
    var KEY = "perfume-cards:" + col.id;
    var S = { scores: {}, logs: [] };
    try { var v = JSON.parse(localStorage.getItem(KEY)); if (v && v.scores) S = v; } catch (e) {}
    function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("這個瀏覽器不允許儲存，請改用一般視窗"); } }
    function rec(ref) { return S.scores[ref] || (S.scores[ref] = {}); }
    function total(r) { var s = 0, c = 0; metrics.forEach(function (m) { if (r && r[m]) { s += r[m]; c++; } }); return c ? s : null; }
    function hhmm(ts) { var d = new Date(ts); return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
    function toast(msg) { var el = $("#toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove("show"); }, 2000); }
    function sel(attr, ref) { return "[" + attr + '="' + ref.replace(/"/g, "") + '"]'; }

    function paintCard(ref) {
      var r = S.scores[ref] || {}, panel = $(".rate" + sel("data-ref", ref));
      var tt = total(r);
      if (panel) {
        metrics.forEach(function (m) {
          $$('.pips[data-m="' + m + '"] .pip', panel).forEach(function (p) {
            p.classList.toggle("on", (r[m] || 0) >= +p.dataset.v);
            p.setAttribute("aria-pressed", String(r[m] === +p.dataset.v));
          });
        });
        var f = $("[data-field]", panel); if (f && document.activeElement !== f) f.value = r.feel || "";
        $("[data-total]", panel).textContent = tt == null ? "–" : tt;
        $(".save-state", panel).textContent = r.updatedAt ? "已存在這台裝置 " + hhmm(r.updatedAt) : "還沒評分";
      }
      $$(".sc" + sel("data-ref", ref)).forEach(function (c) { var v = r[c.dataset.k]; $("b", c).textContent = v || ""; c.classList.toggle("set", !!v); });
      var tot = $(sel("data-tot", ref)); if (tot) tot.textContent = tt == null ? "" : tt;
      var fl = $(sel("data-feel", ref)); if (fl) { fl.textContent = r.feel ? "我的感受：" + r.feel : ""; fl.hidden = !r.feel; }
    }
    function paintRank() {
      var rows = col.candidates.map(function (c) { var r = S.scores[c.ref]; return { c: c, p: ctx.perfumes[c.ref], r: r || {}, t: total(r) }; })
        .filter(function (x) { return x.t != null || x.r.feel; })
        .sort(function (a, b) { return (b.t || 0) - (a.t || 0); });
      var ol = $("#rank-list"); ol.textContent = "";
      $("#rank-empty").hidden = rows.length > 0;
      rows.forEach(function (x, i) {
        var li = document.createElement("li"), b = document.createElement("button");
        b.type = "button"; b.setAttribute("aria-label", "跳到 " + x.p.name + " 的卡片");
        b.addEventListener("click", function () {
          var sec = $("section" + sel("data-ref", x.c.ref));
          if (sec) { sec.scrollIntoView({ behavior: "smooth", block: "start" }); var pp = $(".pip", sec); if (pp) pp.focus({ preventScroll: true }); }
        });
        var no = document.createElement("span"); no.className = "no"; no.textContent = i + 1;
        var im = document.createElement("img"); im.alt = ""; if (x.p.photo) im.src = x.p.photo; else im.style.visibility = "hidden";
        var mid = document.createElement("div");
        var nm = document.createElement("div"); nm.className = "nm"; nm.textContent = x.p.name;
        var bar = document.createElement("div"); bar.className = "bar"; var bi = document.createElement("i"); bi.style.width = ((x.t || 0) / MAX * 100) + "%"; bar.appendChild(bi);
        mid.appendChild(nm); mid.appendChild(bar);
        if (x.r.feel) { var mt = document.createElement("div"); mt.className = "meta"; mt.textContent = x.r.feel.length > 40 ? x.r.feel.slice(0, 40) + "…" : x.r.feel; mid.appendChild(mt); }
        var sc = document.createElement("div"); sc.className = "sc2"; sc.textContent = x.t == null ? "–" : x.t;
        var sm = document.createElement("small"); sm.textContent = "/" + MAX; sc.appendChild(sm);
        [no, im, mid, sc].forEach(function (n) { b.appendChild(n); });
        li.appendChild(b); ol.appendChild(li);
      });
    }
    function paintLogs() {
      var ul = $("#log-list"); if (!ul) return;
      ul.textContent = ""; $("#log-empty").hidden = S.logs.length > 0;
      var STAR = ["", "★", "★★", "★★★", "★★★★", "★★★★★"], AG = { yes: "會再這樣疊", maybe: "再試試", no: "不會再疊" };
      var prefix = col.base.map(function (b) { return b.short || ctx.perfumes[b.ref].name; }).join("＋");
      S.logs.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).forEach(function (l) {
        var li = document.createElement("li"), h = document.createElement("div"); h.className = "lh";
        var b = document.createElement("b"); b.textContent = (prefix ? prefix + "＋" : "") + (l["log-third"] || "（未填）");
        var s = document.createElement("span"); s.textContent = [l["log-date"] || hhmm(l.createdAt), l["log-weather"], STAR[l.like || 0], AG[l.again]].filter(Boolean).join(" · ");
        h.appendChild(b); h.appendChild(s); li.appendChild(h);
        [["噴的位置", "log-where"], ["10 分鐘", "log-10"], ["30 分鐘", "log-30"], ["2 小時後", "log-120"], ["筆記", "log-note"]].forEach(function (f) {
          if (l[f[1]]) { var p = document.createElement("p"); p.textContent = f[0] + "：" + l[f[1]]; li.appendChild(p); }
        });
        var del = document.createElement("button"); del.type = "button"; del.className = "del"; del.textContent = "刪除這筆";
        del.addEventListener("click", function () {
          if (del.dataset.armed) { S.logs = S.logs.filter(function (x) { return x.id !== l.id; }); save(); paintLogs(); }
          else { del.dataset.armed = "1"; del.textContent = "再按一次確認刪除"; setTimeout(function () { delete del.dataset.armed; del.textContent = "刪除這筆"; }, 3000); }
        });
        li.appendChild(del); ul.appendChild(li);
      });
    }
    function paintAll() { col.candidates.forEach(function (c) { paintCard(c.ref); }); paintRank(); paintLogs(); }
    function persist(ref) { rec(ref).updatedAt = Date.now(); save(); paintCard(ref); paintRank(); }

    // trial log draft
    var DKEY = KEY + ":draft", draft = { like: 0, again: null };
    try { var dv = JSON.parse(localStorage.getItem(DKEY)); if (dv) draft = dv; } catch (e) {}
    function saveDraft() { try { localStorage.setItem(DKEY, JSON.stringify(draft)); } catch (e) {} }
    function paintDraft() {
      $$(".star").forEach(function (b) { b.classList.toggle("on", (draft.like || 0) >= +b.dataset.v); });
      $$(".yb").forEach(function (b) { b.classList.toggle("on", draft.again === b.dataset.yn); });
      $$("[data-f]").forEach(function (el) { if (document.activeElement !== el) el.value = draft[el.dataset.f] || ""; });
    }

    document.addEventListener("click", function (e) {
      var p = e.target.closest(".pip");
      if (p) { var panel = p.closest(".rate"), m = p.parentNode.dataset.m, v = +p.dataset.v, r = rec(panel.dataset.ref); r[m] = r[m] === v ? null : v; persist(panel.dataset.ref); return; }
      var s = e.target.closest(".star");
      if (s) { var n = +s.dataset.v; draft.like = draft.like === n ? 0 : n; saveDraft(); paintDraft(); return; }
      var y = e.target.closest(".yb");
      if (y) { draft.again = draft.again === y.dataset.yn ? null : y.dataset.yn; saveDraft(); paintDraft(); return; }
      var a = e.target.closest("[data-act]");
      if (!a) return;
      if (a.dataset.act === "savelog") {
        if (!Object.keys(draft).some(function (k) { return draft[k]; })) { toast("先填一點內容再儲存"); return; }
        var entry = JSON.parse(JSON.stringify(draft)); entry.createdAt = Date.now(); entry.id = "l" + entry.createdAt;
        S.logs.push(entry); save(); draft = { like: 0, again: null }; saveDraft(); paintDraft(); paintLogs(); toast("紀錄已儲存");
      } else if (a.dataset.act === "export") {
        var blob = new Blob([JSON.stringify({ collection: col.id, exportedAt: new Date().toISOString(), data: S }, null, 2)], { type: "application/json" });
        var link = document.createElement("a"); link.href = URL.createObjectURL(blob);
        link.download = "perfume-cards-" + col.id + "-" + new Date().toISOString().slice(0, 10) + ".json";
        document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
        toast("已下載備份檔");
      } else if (a.dataset.act === "import") {
        $("#import-file").click();
      }
    });
    document.addEventListener("input", function (e) {
      var f = e.target.closest(".rate [data-field]");
      if (f) { var ref = f.closest(".rate").dataset.ref; rec(ref)[f.dataset.field] = f.value; persist(ref); return; }
      var d = e.target.closest("[data-f]");
      if (d) { draft[d.dataset.f] = d.value; saveDraft(); }
    });
    $("#import-file").addEventListener("change", function (e) {
      var file = e.target.files[0]; if (!file) return;
      file.text().then(function (txt) {
        var j = JSON.parse(txt), d = j.data || j;
        if (!d.scores) throw new Error("bad");
        if (j.collection && j.collection !== col.id) { toast("這是「" + j.collection + "」的備份，和這組不同"); return; }
        Object.keys(d.scores).forEach(function (k) {
          var a = d.scores[k], b = S.scores[k];
          if (!b || (a.updatedAt || 0) > (b.updatedAt || 0)) S.scores[k] = a;
        });
        var ids = {}; S.logs.forEach(function (l) { ids[l.id] = 1; });
        (d.logs || []).forEach(function (l) { if (!ids[l.id]) S.logs.push(l); });
        save(); paintAll(); toast("備份已匯入");
      }).catch(function () { toast("讀不懂這個檔案，請選匯出的 .json 備份"); });
      e.target.value = "";
    });

    paintAll(); paintDraft();
  }
})();
