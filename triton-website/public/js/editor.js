/* Triton Landscaping – owner edit mode.
   Only loads after the owner logs in at /edit.html. Changes are only kept
   when the server accepts the owner's login, so visitors can't change anything. */
(function () {
  'use strict';
  var T = window.Triton;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var token = null;
  try { token = localStorage.getItem('tritonToken'); } catch (e) {}
  if (!token) return;
  var auth = { Authorization: 'Bearer ' + token };

  function logout(msg) {
    try { localStorage.removeItem('tritonToken'); } catch (e) {}
    if (msg) alert(msg);
    location.reload();
  }

  // Check the login is still valid before switching edit mode on
  fetch('/api/login', { headers: auth, cache: 'no-store' }).then(function (r) {
    if (r.status === 401) return logout('Your editing login has expired. Please log in again at /edit.html.');
    if (r.ok) start();
  }).catch(function () { /* offline – stay in normal view */ });

  function start() {
    var html = document.documentElement;
    html.classList.add('editing');
    var c = T.content || {};
    var state = {
      texts: Object.assign({}, c.texts || {}),
      images: Object.assign({}, c.images || {}),
      links: Object.assign({}, c.links || {}),
      gallery: Array.isArray(c.gallery) ? c.gallery.slice() : null
    };
    var dirty = false, busy = 0;

    /* ---- Edit bar ---- */
    var bar = document.createElement('div');
    bar.className = 'edit-bar';
    bar.innerHTML = '<div class="eb-text"><strong>Edit mode</strong><span>Tap text or photos</span></div>' +
      '<button type="button" class="eb-save" disabled>Saved</button>' +
      '<button type="button" class="eb-exit">Log out</button>';
    document.body.insertBefore(bar, document.body.firstChild);
    var saveBtn = $('.eb-save', bar);
    var toast = document.createElement('div');
    toast.className = 'eb-toast'; toast.setAttribute('role', 'status'); toast.hidden = true;
    document.body.appendChild(toast);
    var toastTimer;
    function say(msg, kind, ms) {
      clearTimeout(toastTimer);
      toast.textContent = msg; toast.className = 'eb-toast ' + (kind || ''); toast.hidden = false;
      if (ms !== 0) toastTimer = setTimeout(function () { toast.hidden = true; }, ms || 3000);
    }
    function refreshSave() {
      saveBtn.disabled = !dirty || busy > 0;
      saveBtn.textContent = busy > 0 ? 'Uploading…' : dirty ? 'Save' : 'Saved';
      saveBtn.classList.toggle('ready', dirty && !busy);
    }
    function setDirty(v) { dirty = v; refreshSave(); }

    saveBtn.addEventListener('click', function () { save(); });
    $('.eb-exit', bar).addEventListener('click', function () {
      if (dirty && !confirm('You have changes that aren’t saved. Log out without saving them?')) return;
      dirty = false; logout();
    });
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

    function save() {
      if (busy) { say('Please wait for photos to finish uploading.'); return Promise.resolve(false); }
      saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
      return fetch('/api/content', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, auth),
        body: JSON.stringify(state)
      }).then(function (r) {
        if (r.status === 401) { dirty = false; logout('Your editing login has expired. Please log in again – your last changes were not saved.'); return false; }
        if (!r.ok) throw new Error(r.status);
        T.content = JSON.parse(JSON.stringify(state));
        setDirty(false);
        say('Saved! Your changes are now live.', 'ok');
        return true;
      }).catch(function () {
        setDirty(true);
        say('Couldn’t save. Check your internet connection and tap Save again.', 'err', 6000);
        return false;
      });
    }

    /* ---- Text ---- */
    var plainOK = (function () { var d = document.createElement('div'); d.contentEditable = 'plaintext-only'; return d.contentEditable === 'plaintext-only'; })();
    $$('[data-edit]').forEach(function (el) {
      el.contentEditable = plainOK ? 'plaintext-only' : 'true';
      el.spellcheck = true;
      el.addEventListener('input', function () {
        var k = el.getAttribute('data-edit');
        var v = el.innerText.replace(/\n+$/, '');
        state.texts[k] = v;
        el.classList.remove('ph');
        $$('[data-edit="' + k + '"]').forEach(function (o) { if (o !== el) { o.textContent = v; o.classList.remove('ph'); } });
        if (k === 'phone') T.syncPhone(v);
        setDirty(true);
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !el.hasAttribute('data-multiline')) { e.preventDefault(); el.blur(); }
      });
      if (!plainOK) el.addEventListener('paste', function (e) {
        e.preventDefault();
        document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
      });
    });
    // Show every FAQ answer so it can be edited
    $$('details').forEach(function (d) { d.open = true; });

    /* ---- Photos ---- */
    var fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.hidden = true;
    document.body.appendChild(fileInput);
    function pickFiles(multiple, cb) {
      fileInput.multiple = !!multiple; fileInput.value = '';
      fileInput.onchange = function () { var f = Array.prototype.slice.call(fileInput.files || []); if (f.length) cb(f); };
      fileInput.click();
    }
    function upload(file) {
      busy++; refreshSave();
      return T.resizeImage(file, 2000, 0.85).then(function (blob) {
        return fetch('/api/upload', { method: 'POST', headers: Object.assign({ 'Content-Type': 'image/jpeg' }, auth), body: blob });
      }).then(function (r) {
        if (r.status === 401) throw new Error('auth');
        if (!r.ok) throw new Error('upload');
        return r.json();
      }).then(function (d) { return d.url; })
        .catch(function (e) {
          say(e.message === 'decode' ? 'That photo couldn’t be opened. Try a JPG or PNG photo.'
            : e.message === 'auth' ? 'Your login has expired. Please log out and log in again.'
            : 'The photo didn’t upload. Check your internet connection and try again.', 'err', 6000);
          throw e;
        })
        .finally(function () { busy--; refreshSave(); });
    }

    function replaceImage(img) {
      pickFiles(false, function (files) {
        img.classList.add('uploading'); say('Uploading photo…', '', 0);
        upload(files[0]).then(function (url) {
          var k = img.getAttribute('data-img');
          state.images[k] = url;
          $$('[data-img="' + k + '"]').forEach(function (o) { o.src = url; });
          setDirty(true); say('Photo changed. Tap Save to keep it.');
        }).catch(function () {}).then(function () { img.classList.remove('uploading'); });
      });
    }

    function editLink(a) {
      var k = a.getAttribute('data-link');
      var name = k.charAt(0).toUpperCase() + k.slice(1);
      var cur = state.links[k] || (a.getAttribute('href') !== '#' ? a.href : '');
      var v = prompt('Paste the web address (link) of your ' + name + ' page:', cur || 'https://');
      if (v === null) return;
      v = v.trim();
      if (v === 'https://' || v === '') v = '#';
      else if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
      state.links[k] = v;
      $$('[data-link="' + k + '"]').forEach(function (o) { o.href = v; o.classList.toggle('ph', v === '#'); });
      setDirty(true);
    }

    // One click handler decides what a tap does in edit mode
    document.addEventListener('click', function (e) {
      if (e.target.closest('.edit-bar,.eb-toast')) return;
      var ed = e.target.closest('[data-edit]');
      if (ed) { if (ed.closest('a,summary,label,button')) e.preventDefault(); return; }
      var ln = e.target.closest('[data-link]');
      if (ln) { e.preventDefault(); editLink(ln); return; }
      var img = e.target.closest('img[data-img]');
      if (img) { e.preventDefault(); replaceImage(img); return; }
      var tel = e.target.closest('a[data-tel]');
      if (tel) { e.preventDefault(); return; }
      if (e.target.closest('summary')) { e.preventDefault(); return; }
      var a = e.target.closest('a[href]');
      if (a && dirty && !/^#/.test(a.getAttribute('href'))) {
        e.preventDefault();
        if (confirm('You have changes that aren’t saved yet. Save them now?')) {
          save().then(function (ok) { if (ok) location.href = a.href; });
        }
      }
    }, true);

    /* ---- Gallery: add, remove, replace ---- */
    var gallery = $('#gallery');
    if (gallery) {
      if (!state.gallery) state.gallery = T.defaults.gallery.slice();
      var tools = document.createElement('div');
      tools.className = 'eg-tools';
      tools.innerHTML = '<button type="button" class="btn btn-gold btn-lg btn-block eg-add">+ Add photos</button>' +
        '<p>Tap a photo to replace it, or tap <b>Remove</b> to take it out.</p>';
      gallery.parentNode.insertBefore(tools, gallery);

      var renderEdit = function () {
        gallery.innerHTML = '';
        state.gallery.forEach(function (p, i) {
          var item = document.createElement('div');
          item.className = 'g-item g-edit';
          var img = document.createElement('img');
          img.src = p.src; img.alt = p.alt || '';
          var rm = document.createElement('button');
          rm.type = 'button'; rm.className = 'g-remove'; rm.textContent = 'Remove';
          rm.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!confirm('Remove this photo from the gallery?')) return;
            state.gallery.splice(i, 1); renderEdit(); setDirty(true);
          });
          img.addEventListener('click', function () {
            pickFiles(false, function (files) {
              img.classList.add('uploading'); say('Uploading photo…', '', 0);
              upload(files[0]).then(function (url) {
                state.gallery[i] = { src: url, alt: '' }; renderEdit(); setDirty(true);
                say('Photo changed. Tap Save to keep it.');
              }).catch(function () { img.classList.remove('uploading'); });
            });
          });
          item.appendChild(img); item.appendChild(rm); gallery.appendChild(item);
        });
      };
      renderEdit();

      $('.eg-add', tools).addEventListener('click', function () {
        pickFiles(true, function (files) {
          var done = 0;
          say('Uploading ' + files.length + ' photo' + (files.length > 1 ? 's' : '') + '…', '', 0);
          files.reduce(function (p, f) {
            return p.then(function () {
              return upload(f).then(function (url) {
                state.gallery.unshift({ src: url, alt: '' }); done++; renderEdit(); setDirty(true);
              }).catch(function () {});
            });
          }, Promise.resolve()).then(function () {
            if (done) say(done + ' photo' + (done > 1 ? 's' : '') + ' added. Tap Save to keep them.');
          });
        });
      });
    }

    refreshSave();
    say('Edit mode is on. Tap any text or photo to change it, then tap Save.', '', 5000);
  }
})();
