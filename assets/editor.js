/* Editor: builds perfume / collection JSON and hands it to GitHub's new-file page. */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var val = function (id) { return ($("#" + id).value || "").trim(); };
  function slugify(s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-"); }
  function list(s) { return String(s || "").split(/[、,，\n]/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function toast(msg) { var el = $("#toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove("show"); }, 2000); }

  // ---- repo settings: guess from the Pages address, remember edits ----
  var RK = "perfume-cards:repo";
  var repo = { owner: "", repo: "", branch: "main" };
  var m = location.hostname.match(/^([^.]+)\.github\.io$/);
  if (m) { repo.owner = m[1]; var seg = location.pathname.split("/").filter(Boolean)[0]; repo.repo = seg && !/\.html$/.test(seg) ? seg : m[1] + ".github.io"; }
  try { var saved = JSON.parse(localStorage.getItem(RK)); if (saved && saved.owner) repo = saved; } catch (e) {}
  ["owner", "repo", "branch"].forEach(function (k) {
    var el = $("#r-" + k); el.value = repo[k] || (k === "branch" ? "main" : "");
    el.addEventListener("input", function () { repo[k] = el.value.trim(); try { localStorage.setItem(RK, JSON.stringify(repo)); } catch (e) {} paintRepo(); update(); updateCol(); });
  });
  function paintRepo() {
    $("#repo-label").textContent = repo.owner && repo.repo ? repo.owner + "/" + repo.repo + "（" + (repo.branch || "main") + "）" : "還沒設定，按這裡填你的 GitHub 帳號和儲存庫";
    if (!repo.owner) $("#repo-box").open = true;
  }
  function gh(kind, p, extra) {
    if (!repo.owner || !repo.repo) return null;
    return "https://github.com/" + repo.owner + "/" + repo.repo + "/" + kind + "/" + (repo.branch || "main") + (p ? "/" + p : "") + (extra || "");
  }
  function setLink(el, href) {
    if (href) { el.href = href; el.removeAttribute("aria-disabled"); el.style.opacity = ""; }
    else { el.removeAttribute("href"); el.setAttribute("aria-disabled", "true"); el.style.opacity = ".5"; el.title = "先在上面設定 GitHub 儲存庫"; }
  }
  paintRepo();

  // ---- tabs ----
  [["#t-perfume", "#p-perfume"], ["#t-col", "#p-col"]].forEach(function (pair, i, all) {
    $(pair[0]).addEventListener("click", function () {
      all.forEach(function (q) { $(q[0]).setAttribute("aria-selected", "false"); $(q[1]).hidden = true; });
      $(pair[0]).setAttribute("aria-selected", "true"); $(pair[1]).hidden = false;
    });
  });

  // ---- perfume ----
  var previewURL = "";
  $("#photoFile").addEventListener("change", function (e) {
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = e.target.files[0] ? URL.createObjectURL(e.target.files[0]) : ""; update();
  });
  var touched = {};
  ["brandSlug", "slug"].forEach(function (k) { $("#" + k).addEventListener("input", function () { touched[k] = true; }); });

  function perfumeData() {
    if (!touched.brandSlug) $("#brandSlug").value = slugify(val("brand"));
    if (!touched.slug) $("#slug").value = slugify(val("en")) || "";
    var b = val("brandSlug") || "brand", s = val("slug") || "perfume";
    var d = { brand: val("brand"), brandZh: val("brandZh"), name: val("name"), en: val("en"), series: val("series"),
      photo: "img/" + b + "/" + s + ".jpg", color: $("#color").value };
    if ($("#theme").value === "dark") d.theme = "dark";
    var mats = list(val("materials")); if (mats.length) d.materials = mats; else d.materialsNote = val("materialsNote") || "完整香調尚未核實";
    var notes = { top: list(val("top")), heart: list(val("heart")), base: list(val("baseNotes")) };
    if (notes.top.length || notes.heart.length || notes.base.length) d.notes = notes;
    d.source = $("#source").value; d.smell = val("smell");
    Object.keys(d).forEach(function (k) { if (d[k] === "") delete d[k]; });
    return { data: d, path: "data/perfumes/" + b + "/" + s + ".json", brand: b, slug: s };
  }
  function update() {
    var r = perfumeData(), json = JSON.stringify(r.data, null, 2);
    $("#o-json").textContent = json; $("#o-path").textContent = r.path; $("#o-photo").textContent = r.data.photo;
    setLink($("#gh-new"), gh("new", "", "?filename=" + encodeURIComponent(r.path) + "&value=" + encodeURIComponent(json + "\n")));
    setLink($("#gh-upload"), gh("upload", "img/" + r.brand));
    var p = JSON.parse(json); p.name = p.name || "香水名稱"; if (previewURL) p.photo = previewURL;
    var c = { ref: r.brand + "/" + r.slug, result: "（疊起來的結果，在組合檔裡填）", why: "這裡會寫為什麼這樣搭。" };
    $("#pv").innerHTML = PC.candCard(c, p, 0, { perfumes: {}, base: [] });
  }
  $("#f-perfume").addEventListener("input", update);
  $("#copy-p").addEventListener("click", function () { copy($("#o-json").textContent); });

  // ---- collection ----
  var cTouched = false;
  $("#c-id").addEventListener("input", function () { cTouched = true; });
  function colData() {
    if (!cTouched) $("#c-id").value = slugify(val("c-title")) || "";
    var id = val("c-id") || "my-collection";
    var base = val("c-base").split("\n").map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var parts = l.split(/\s+/); return { ref: parts[0], short: parts.slice(1).join(" ") || parts[0].split("/")[1], label: "基底 · 已入手" };
    });
    var cands = val("c-cands").split("\n").map(function (l) { return l.trim().split(/\s+/)[0]; }).filter(Boolean).map(function (ref) {
      return { ref: ref, score: null, result: "", why: "", conflict: "" };
    });
    var metrics = val("c-metrics").split("\n").map(function (l) { return l.trim(); }).filter(Boolean).map(function (l, i) {
      var p = l.split(/[｜|]/); return { key: "m" + (i + 1), label: p[0].trim(), hint: (p[1] || "").trim() };
    });
    var col = { id: id, title: val("c-title"), description: val("c-desc"),
      cover: { eyebrow: "疊香筆記", title: [val("c-title")], lead: val("c-desc") },
      base: base, candidates: cands, comparisons: [],
      rating: { metrics: metrics, summary: true, log: true } };
    if (base.length >= 2) {
      col.blend = { eyebrow: "先疊基底", title: [base.map(function (b) { return b.short; }).join(" ＋ "), "會是什麼味道？"],
        layers: base.map(function (b) { return { text: "", from: b.short, ref: b.ref }; }), result: "", desc: "" };
    }
    return col;
  }
  function updateCol() {
    var col = colData(), json = JSON.stringify(col, null, 2), path = "data/collections/" + col.id + ".json";
    $("#o-cjson").textContent = json; $("#o-cpath").textContent = path;
    var first = col.base[0] || col.candidates[0];
    var entry = { id: col.id, title: col.title, description: col.description, cover: first ? "img/" + first.ref + ".jpg" : "" };
    $("#o-index").textContent = JSON.stringify(entry, null, 2) + ",";
    setLink($("#gh-cnew"), gh("new", "", "?filename=" + encodeURIComponent(path) + "&value=" + encodeURIComponent(json + "\n")));
    setLink($("#gh-index"), gh("edit", "data/index.json"));
  }
  $("#f-col").addEventListener("input", updateCol);
  $("#copy-c").addEventListener("click", function () { copy($("#o-cjson").textContent); });

  // read existing perfumes from the public repo, then offer them as picks
  $("#load-list").addEventListener("click", function () {
    if (!repo.owner || !repo.repo) { toast("先設定 GitHub 儲存庫"); $("#repo-box").open = true; return; }
    var api = "https://api.github.com/repos/" + repo.owner + "/" + repo.repo + "/git/trees/" + (repo.branch || "main") + "?recursive=1";
    fetch(api).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
      var refs = (j.tree || []).map(function (t) { return t.path; }).filter(function (p) { return /^data\/perfumes\/[^/]+\/[^/]+\.json$/.test(p); })
        .map(function (p) { return p.replace(/^data\/perfumes\//, "").replace(/\.json$/, ""); });
      var box = $("#perfume-picks"); box.hidden = false; box.textContent = "";
      var h = document.createElement("div"); h.textContent = "點一下加入候選，按住 Shift 點加入基底："; box.appendChild(h);
      var wrap = document.createElement("div"); wrap.className = "mine-actions"; wrap.style.marginTop = "8px";
      refs.forEach(function (ref) {
        var b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = ref;
        b.addEventListener("click", function (e) {
          var t = $(e.shiftKey ? "#c-base" : "#c-cands");
          t.value = (t.value.trim() ? t.value.trim() + "\n" : "") + ref; updateCol();
        });
        wrap.appendChild(b);
      });
      box.appendChild(wrap);
      if (!refs.length) h.textContent = "這個儲存庫裡還沒有香水資料。";
    }).catch(function () { toast("讀不到儲存庫，確認帳號、名稱，以及儲存庫是公開的"); });
  });

  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast("已複製"); }, function () { toast("複製失敗，請手動選取"); });
    else toast("複製失敗，請手動選取");
  }
  update(); updateCol();
})();
