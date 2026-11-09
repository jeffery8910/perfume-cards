/* 自己疊疊看: pick 2–3 perfumes from data/catalog.json, see the scent families
   their materials point to, add your own rating and feeling, save as a PNG. */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var esc = PC.esc;
  var MAX = 3, HKEY = "perfume-cards:mixes";
  var all = [], byRef = {}, sel = [], like = 0, harm = 0;

  // Scent families, matched against each material word. First match wins,
  // so specific words come before broad ones.
  var EXACT = { "岩蘭草": "木質", "海地岩蘭草": "木質", "檸檬草": "柑橘", "苦橙葉": "綠意", "龍涎香調": "海洋", "白琥珀": "琥珀樹脂", "琥珀": "琥珀樹脂" };
  var FAMILIES = [
    ["苔土", /苔|土|泥/, "#5E6B3A"],
    ["茶", /茶/, "#5C8A4A"],
    ["琥珀樹脂", /焚香|乳香|沒藥|安息香|樹脂|欖香|沉香|灰燼|煙|琥珀/, "#8A5A2B"],
    ["海洋", /海|鹽|水|礦|龍涎|漂流/, "#2D6E8E"],
    ["麝香", /麝香/, "#8C7A9C"],
    ["花香", /花|茉莉|玫瑰|玉蘭|康乃馨|天竺葵|鳶尾|蓮|梔子/, "#B4577A"],
    ["綠意", /草|葉|薄荷|百里香|尤加利|羅勒|迷迭香|鼠尾草|薰衣草|茴香|大黃|青/, "#3E8A5C"],
    ["柑橘", /檸檬|佛手柑|柚|橙|橘|萊姆|香櫞/, "#C28A12"],
    ["木質", /木|檜|杉|松|柏|檀|樺|橡|針葉/, "#6E4524"],
    ["甜美", /香草|蜜|龍眼|米酒|奶|糖|可可|果|梨|桃/, "#C2645A"],
    ["辛香", /胡椒|肉桂|丁香|荳蔻|小茴|孜然|薑/, "#A0522D"]
  ];
  var COLOR = {}; FAMILIES.forEach(function (f) { COLOR[f[0]] = f[2]; });
  function family(word) {
    if (EXACT[word]) return EXACT[word];
    for (var i = 0; i < FAMILIES.length; i++) if (FAMILIES[i][1].test(word)) return FAMILIES[i][0];
    return null;
  }
  function words(p) {
    var w = (p.materials || []).slice();
    if (p.notes) ["top", "heart", "base"].forEach(function (k) { w = w.concat(p.notes[k] || []); });
    return w;
  }
  // Each perfume counts equally: its words are split into families, normalised to 1.
  function analyse(list) {
    var score = {}, seen = {};
    list.forEach(function (p) {
      var fams = words(p).map(family).filter(Boolean);
      if (!fams.length) return;
      var own = {};
      fams.forEach(function (f) { own[f] = (own[f] || 0) + 1 / fams.length; });
      Object.keys(own).forEach(function (f) { score[f] = (score[f] || 0) + own[f]; seen[f] = (seen[f] || 0) + 1; });
    });
    var sum = Object.keys(score).reduce(function (a, k) { return a + score[k]; }, 0) || 1;
    var rows = Object.keys(score).map(function (k) { return { f: k, pct: Math.round(score[k] / sum * 100), shared: seen[k] }; })
      .sort(function (a, b) { return b.pct - a.pct; });
    return rows;
  }
  function summary(rows, n) {
    if (!rows.length) return "這幾支沒有香材資料，寫下你聞到的感覺吧";
    var main = rows.filter(function (r) { return r.pct >= 18; }).slice(0, 2).map(function (r) { return r.f; });
    if (!main.length) main = [rows[0].f];
    var hint = rows.filter(function (r) { return main.indexOf(r.f) < 0 && r.pct >= 8; }).slice(0, 2).map(function (r) { return r.f; });
    var shared = rows.filter(function (r) { return r.shared >= 2; }).map(function (r) { return r.f; });
    var s = "以" + main.join("、") + "為主" + (hint.length ? "，帶一點" + hint.join("、") : "");
    if (n >= 2) s += shared.length ? "；" + shared.slice(0, 2).join("、") + "是共同的橋梁" : "；彼此香材重疊少，反差會比較明顯";
    return s;
  }

  function toast(msg) { var el = $("#toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove("show"); }, 2000); }
  function today() { var d = new Date(); return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate(); }

  // ---- picker ----
  function paintTiles() {
    var q = ($("#q").value || "").trim().toLowerCase(), b = $("#brandSel").value;
    var box = $("#tiles"); box.textContent = "";
    var shown = all.filter(function (p) {
      if (b && p.brand !== b) return false;
      if (!q) return true;
      return [p.name, p.en, p.brand, p.brandZh, p.series].concat(words(p)).join(" ").toLowerCase().indexOf(q) >= 0;
    });
    shown.forEach(function (p) {
      var t = document.createElement("button"); t.type = "button"; t.className = "tile";
      var i = sel.indexOf(p.ref); t.setAttribute("aria-pressed", String(i >= 0));
      t.setAttribute("aria-label", (p.brandZh || p.brand || "") + " " + p.name + (i >= 0 ? "，第 " + (i + 1) + " 支" : ""));
      var holder = document.createElement("div"); holder.style.cssText = "position:relative;aspect-ratio:4/5;border-radius:8px;overflow:hidden;background:#fff;container-type:inline-size";
      holder.innerHTML = PC.img(p, ""); var hi = holder.querySelector("img"); if (hi) { hi.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:" + (p.photoFit || "cover"); }
      t.appendChild(holder);
      var nm = document.createElement("b"); nm.textContent = p.name; t.appendChild(nm);
      var br = document.createElement("small"); br.textContent = [p.brandZh || p.brand, p.en].filter(Boolean).join(" · "); t.appendChild(br);
      if (i >= 0) { var o = document.createElement("span"); o.className = "ord"; o.textContent = i + 1; t.appendChild(o); }
      t.addEventListener("click", function () { toggle(p.ref); });
      box.appendChild(t);
    });
    if (!shown.length) box.innerHTML = '<p class="status">找不到符合的香水。</p>';
  }
  function toggle(ref) {
    var i = sel.indexOf(ref);
    if (i >= 0) sel.splice(i, 1);
    else if (sel.length >= MAX) { toast("最多選 " + MAX + " 支，先取消一支"); return; }
    else sel.push(ref);
    paintTiles(); paintCard(); syncURL();
  }

  // ---- result card ----
  function stars(n) { var s = ""; for (var i = 1; i <= 5; i++) s += i <= n ? "★" : "<i>★</i>"; return s; }
  function paintCard() {
    var list = sel.map(function (r) { return byRef[r]; });
    var box = $("#mixcard-box");
    var sl = $("#sel-list"); sl.textContent = "";
    list.forEach(function (p, i) { var s = document.createElement("span"); s.textContent = (i + 1) + ". " + p.name; sl.appendChild(s); });
    if (!list.length) { var s0 = document.createElement("span"); s0.textContent = "還沒選"; sl.appendChild(s0); }

    var title = list.length ? list.map(function (p) { return esc(p.name); }).join(" ＋ ") : "我的疊香";
    var body;
    if (list.length < 2) {
      body = '<p class="mix-empty">從上面挑 ' + (list.length ? "再一支" : "2–3 支") + "香水，<br>這裡會出現這組的香氣分析。</p>";
    } else {
      var rows = analyse(list);
      var photos = list.map(function (p) {
        var d = PC.derive(p);
        return '<div class="ph" style="--p-bg:' + (p.photoBg || (d.dark ? d.bg : "#fff")) + ";--fit:" + (p.photoFit || "cover") + ";--p-m:" + (d.dark ? "#EEF0FA" : d.m) + ";--p-on:" + (d.dark ? d.bg : "#fff") + '">' +
          PC.img(p, p.name) + '<span class="cap">' + esc(p.name) + "</span></div>";
      }).join("");
      var fam = rows.slice(0, 5).map(function (r) {
        return '<div class="fam-r" style="--f:' + COLOR[r.f] + '"><span>' + esc(r.f) + '</span><div class="fam-bar"><i style="width:' + Math.max(4, r.pct) + '%"></i></div><span>' + r.pct + "%</span></div>";
      }).join("");
      var feel = $("#feel").value.trim(), who = $("#who").value.trim();
      body = '<div class="mix-photos" style="--n:' + list.length + '">' + photos + "</div>" +
        '<div class="mix-sum">' + esc(summary(rows, list.length)) + "</div>" +
        (fam ? '<div class="blk"><div class="label">香氣方向 <span class="tag">依香材分類</span></div><div class="fam">' + fam + "</div></div>" : "") +
        '<div class="mix-feel"><div class="kv"><span>喜歡 <span class="st">' + stars(like) + '</span></span><span>融合 <span class="st">' + stars(harm) + "</span></span></div>" +
        (feel ? "<p>" + esc(feel) + "</p>" : '<p style="color:var(--muted)">試香後在右邊寫下感受。</p>') + "</div>";
      body += '<div class="foot"><span>依公開香材自動分類，不是實際試香' + (who ? " · " + esc(who) : "") + "</span><span>" + today() + "</span></div>";
    }
    box.innerHTML = '<section class="card mixcard" aria-label="我的疊香卡"><div class="in">' +
      '<div class="eyebrow">我的疊香 · 依噴的順序</div><h2 class="h">' + title.replace(/＋/g, '<span class="q">＋</span>') + "</h2>" + body +
      (list.length < 2 ? '<div class="foot"><span>自己疊疊看</span><span>' + today() + "</span></div>" : "") + "</div></section>";
  }

  // ---- ratings ----
  function makeRate(id, get, set) {
    var el = $("#" + id);
    for (var i = 1; i <= 5; i++) (function (v) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = "★"; b.setAttribute("aria-label", v + " 分");
      b.addEventListener("click", function () { set(get() === v ? 0 : v); paintRate(id, get()); paintCard(); });
      el.appendChild(b);
    })(i);
  }
  function paintRate(id, v) {
    Array.prototype.forEach.call($("#" + id).children, function (b, i) { b.classList.toggle("on", i < v); b.setAttribute("aria-pressed", String(i + 1 === v)); });
  }
  makeRate("like", function () { return like; }, function (v) { like = v; });
  makeRate("harm", function () { return harm; }, function (v) { harm = v; });
  ["feel", "who"].forEach(function (id) { $("#" + id).addEventListener("input", paintCard); });

  // ---- url + history ----
  function syncURL() {
    var u = new URL(location.href);
    if (sel.length) u.searchParams.set("p", sel.join(",")); else u.searchParams.delete("p");
    history.replaceState(null, "", u);
  }
  function loadHist() { try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch (e) { return []; } }
  function saveHist(h) { try { localStorage.setItem(HKEY, JSON.stringify(h)); return true; } catch (e) { toast("這個瀏覽器不允許儲存"); return false; } }
  function paintHist() {
    var h = loadHist(), ul = $("#hist"); ul.textContent = ""; $("#hist-empty").hidden = h.length > 0;
    h.slice().reverse().forEach(function (m) {
      var li = document.createElement("li"), top = document.createElement("div"); top.className = "lh";
      var b = document.createElement("b"); b.textContent = m.refs.map(function (r) { return byRef[r] ? byRef[r].name : r; }).join(" ＋ ");
      var s = document.createElement("span"); s.textContent = [m.date, m.like ? "喜歡 " + "★".repeat(m.like) : "", m.harm ? "融合 " + "★".repeat(m.harm) : ""].filter(Boolean).join(" · ");
      top.appendChild(b); top.appendChild(s); li.appendChild(top);
      if (m.feel) { var p = document.createElement("p"); p.textContent = m.feel; li.appendChild(p); }
      var row = document.createElement("div"); row.className = "mine-actions";
      var open = document.createElement("button"); open.type = "button"; open.className = "btn"; open.textContent = "打開";
      open.addEventListener("click", function () {
        sel = m.refs.filter(function (r) { return byRef[r]; }); like = m.like || 0; harm = m.harm || 0;
        $("#feel").value = m.feel || ""; $("#who").value = m.who || "";
        paintRate("like", like); paintRate("harm", harm); paintTiles(); paintCard(); syncURL();
        $("#res-h").scrollIntoView({ behavior: "smooth" });
      });
      var del = document.createElement("button"); del.type = "button"; del.className = "del"; del.textContent = "刪除";
      del.addEventListener("click", function () {
        if (!del.dataset.armed) { del.dataset.armed = "1"; del.textContent = "再按一次確認"; setTimeout(function () { delete del.dataset.armed; del.textContent = "刪除"; }, 3000); return; }
        saveHist(loadHist().filter(function (x) { return x.id !== m.id; })); paintHist();
      });
      row.appendChild(open); row.appendChild(del); li.appendChild(row); ul.appendChild(li);
    });
  }

  $("#keep").addEventListener("click", function () {
    if (sel.length < 2) { toast("至少選 2 支香水"); return; }
    var h = loadHist();
    h.push({ id: "m" + Date.now(), refs: sel.slice(), like: like, harm: harm, feel: $("#feel").value.trim(), who: $("#who").value.trim(), date: today() });
    if (saveHist(h)) { paintHist(); toast("已存進我的紀錄"); }
  });
  $("#save-img").addEventListener("click", function () {
    if (sel.length < 2) { toast("至少選 2 支香水"); return; }
    var name = "my-blend-" + sel.map(function (r) { return r.split("/")[1]; }).join("-").slice(0, 60);
    CardExport.saveCards([$("#mixcard-box .card")], name);
  });
  $("#share-link").addEventListener("click", function () {
    if (!sel.length) { toast("先挑香水"); return; }
    var link = location.href;
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(function () { toast("連結已複製，傳給朋友就能看到同一組"); }, function () { prompt("複製這個連結", link); });
  });
  $("#clear").addEventListener("click", function () { sel = []; paintTiles(); paintCard(); syncURL(); });
  $("#q").addEventListener("input", paintTiles);
  $("#brandSel").addEventListener("change", paintTiles);

  PC.getJSON("data/catalog.json").then(function (cat) {
    all = (cat.perfumes || []).filter(function (p) { return p.name; });
    all.forEach(function (p) { byRef[p.ref] = p; });
    var brands = {}; all.forEach(function (p) { if (p.brand) brands[p.brand] = p.brandZh || p.brand; });
    Object.keys(brands).sort().forEach(function (b) { var o = document.createElement("option"); o.value = b; o.textContent = brands[b] === b ? b : brands[b] + "（" + b + "）"; $("#brandSel").appendChild(o); });
    var fromURL = (new URLSearchParams(location.search).get("p") || "").split(",").filter(function (r) { return byRef[r]; }).slice(0, MAX);
    sel = fromURL;
    paintTiles(); paintCard(); paintHist();
  }).catch(function (e) {
    $("#tiles").innerHTML = '<p class="status err">' + esc(e.message) + "</p>";
  });
})();
