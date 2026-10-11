// 빛으로 짓는 인생의 무대 — 공통 스크립트 (복사 버튼, 체크리스트 저장)
(function () {
  // ---- 저장 (브라우저마다 따로, 실패해도 페이지는 동작) ----
  var store = {
    get: function (k) { try { return window.localStorage.getItem('ledkit:' + k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem('ledkit:' + k, v); } catch (e) {} },
    del: function (k) { try { window.localStorage.removeItem('ledkit:' + k); } catch (e) {} }
  };
  window.ledStore = store;

  // ---- 토스트 ----
  var toast;
  function showToast(text) {
    if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast); }
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(function () { toast.classList.remove('show'); }, 1600);
  }
  window.showToast = showToast;

  // ---- 복사 ----
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }
  window.copyText = copyText;

  function sourceFor(btn) {
    if (btn.dataset.copy) return btn.dataset.copy;
    var id = btn.dataset.copyTarget;
    var el = id ? document.getElementById(id) : (btn.closest('.codebox') || btn.parentElement).querySelector('pre, textarea');
    if (!el) return '';
    return ('value' in el && el.tagName !== 'PRE') ? el.value : el.innerText;
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy], [data-copy-target], .codebox .copy');
    if (!btn) return;
    var text = sourceFor(btn);
    if (!text) return;
    var label = btn.dataset.label || btn.textContent;
    btn.dataset.label = label;
    copyText(text).then(function () {
      btn.classList.add('done'); btn.textContent = '복사됨 ✓';
      showToast('복사했어요. 붙여 넣으면 됩니다.');
      setTimeout(function () { btn.classList.remove('done'); btn.textContent = label; }, 1500);
    }, function () {
      showToast('복사가 안 됐어요. 길게 눌러 직접 복사해 주세요.');
    });
  });

  // ---- 체크리스트 (진행 막대 + 저장) ----
  function initChecklist(list) {
    var key = 'check:' + list.id;
    var boxes = Array.prototype.slice.call(list.querySelectorAll('input[type=checkbox]'));
    var saved = {};
    try { saved = JSON.parse(store.get(key) || '{}'); } catch (e) { saved = {}; }
    boxes.forEach(function (b, i) { b.checked = !!saved[i]; });
    var prog = document.querySelector('[data-progress-for="' + list.id + '"]');
    function update() {
      var s = {}, n = 0;
      boxes.forEach(function (b, i) { if (b.checked) { s[i] = 1; n++; } });
      store.set(key, JSON.stringify(s));
      if (prog) {
        prog.querySelector('i').style.width = (boxes.length ? n / boxes.length * 100 : 0) + '%';
        prog.querySelector('.count').textContent = n + ' / ' + boxes.length;
      }
    }
    list.addEventListener('change', update);
    var reset = document.querySelector('[data-reset-for="' + list.id + '"]');
    if (reset) reset.addEventListener('click', function () { boxes.forEach(function (b) { b.checked = false; }); update(); });
    update();
  }
  document.querySelectorAll('ul.checklist[id]').forEach(initChecklist);
})();
