// 실습 워크벤치: 프롬프트 만들기, AI 답 검사, 증상 고르기
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var store = window.ledStore;

  // ---------- 효과·팔레트 목록 ----------
  function parseList(text) {
    text = (text || '').trim();
    if (!text) return [];
    try {
      var v = JSON.parse(text);
      if (Array.isArray(v)) return v.map(String);
    } catch (e) {}
    // JSON이 아니면 줄 단위 또는 쉼표 단위로
    var parts = text.indexOf('\n') >= 0 ? text.split('\n') : text.split(',');
    return parts.map(function (s) { return s.replace(/^[\s"'\[\]]+|[\s"'\[\],]+$/g, ''); }).filter(Boolean);
  }
  var effEl = $('effList'), palEl = $('palList'), sceneEl = $('scene');
  effEl.value = store.get('effList') || '';
  palEl.value = store.get('palList') || '';
  var savedScene = store.get('scene');
  if (savedScene) sceneEl.value = savedScene;

  function listStatus() {
    var e = parseList(effEl.value).length, p = parseList(palEl.value).length;
    $('listStatus').textContent = (e || p)
      ? '저장됨 · 효과 ' + e + '개, 팔레트 ' + p + '개. 프롬프트에 들어갔어요.'
      : '목록이 비어 있으면 프롬프트에 [효과 목록 붙여넣기] 자리만 남아요.';
  }

  // ---------- 프롬프트 ----------
  var FORMAT = '{"on":true,"bri":숫자,"seg":[{"id":0,"fx":숫자,"sx":숫자,"ix":숫자,"pal":숫자,"col":[[R,G,B],[R,G,B]]}]}';
  function buildPrompt() {
    var eff = effEl.value.trim() || '[효과 목록 붙여넣기]';
    var pal = palEl.value.trim() || '[팔레트 목록 붙여넣기]';
    var scene = sceneEl.value.trim() || '(원하는 장면을 적어 주세요)';
    return [
      '너는 WLED 조명 컨트롤러 전문가야.',
      '우리 설치물: 픽셀(WS2811) 100개, 세그먼트는 하나(id 0).',
      '아래는 우리 WLED의 효과 목록과 팔레트 목록이야. 목록에서 0부터 센 순서가 ID야.',
      '효과 목록: ' + eff,
      '팔레트 목록: ' + pal,
      '',
      '원하는 장면: ' + scene,
      '',
      '지켜 줄 것:',
      '- WLED JSON API 명령을 한 줄로 써 줘. 코드 블록 표시 없이.',
      '- 형식: ' + FORMAT,
      '- bri는 150 이하.',
      '- 명령 아래에 고른 효과 이름과 이유를 세 줄 이내로 설명해 줘.'
    ].join('\n');
  }
  function render() {
    var text = buildPrompt();
    var pre = $('promptOut');
    pre.textContent = text;
    // 원하는 장면 줄 강조
    var lines = text.split('\n');
    pre.innerHTML = lines.map(function (l) {
      var safe = l.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      if (safe.length > 400) safe = safe.slice(0, 400) + ' …(목록 나머지도 복사돼요)';
      return l.indexOf('원하는 장면:') === 0 ? '<span class="hl">' + safe + '</span>' : safe;
    }).join('\n');
    pre.dataset.full = text;
    listStatus();
  }
  // 복사 버튼이 잘린 미리보기 대신 전체를 복사하도록
  $('promptOut').parentElement.querySelector('.copy').addEventListener('click', function (e) {
    e.stopPropagation();
    var btn = this;
    window.copyText(buildPrompt()).then(function () {
      btn.classList.add('done'); btn.textContent = '복사됨 ✓'; window.showToast('프롬프트를 복사했어요. AI에 붙여 넣으세요.');
      setTimeout(function () { btn.classList.remove('done'); btn.textContent = '📋 프롬프트 복사'; }, 1500);
    }, function () { window.showToast('복사가 안 됐어요. 길게 눌러 직접 복사해 주세요.'); });
  }, true);

  effEl.addEventListener('input', function () { store.set('effList', effEl.value); render(); });
  palEl.addEventListener('input', function () { store.set('palList', palEl.value); render(); });
  sceneEl.addEventListener('input', function () { store.set('scene', sceneEl.value); render(); });
  document.querySelectorAll('[data-scene]').forEach(function (b) {
    b.addEventListener('click', function () {
      sceneEl.value = b.dataset.scene; store.set('scene', sceneEl.value); render();
      document.querySelectorAll('[data-scene]').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
  });
  render();

  // ---------- AI 답 검사 ----------
  var EXAMPLE = '좋아요! 아래 명령을 붙여 넣으세요.\n```json\n{“on”:true,“bri”:140,“seg”:[{“id”:0,“fx”:75,“sx”:70,“ix”:160,“pal”:9,“col”:[[0,80,255],[0,20,80]]}]}\n```\n효과 Lake(75): 잔잔한 호수처럼 물결칩니다. 팔레트 Ocean(9). 속도 70으로 느리게 했어요.';
  $('exampleBtn').addEventListener('click', function () { $('aiAnswer').value = EXAMPLE; check(); });
  $('checkBtn').addEventListener('click', check);

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function msg(kind, html) { return '<div class="msg ' + kind + '">' + html + '</div>'; }

  function check() {
    var raw = $('aiAnswer').value;
    var out = [];
    if (!raw.trim()) { $('checkResult').innerHTML = msg('info', 'AI의 답을 먼저 붙여 넣어 주세요.'); return; }
    var fixed = raw;
    if (/```/.test(fixed)) { out.push(msg('info', '```json 같은 코드 블록 표시가 있어서 뺐어요.')); fixed = fixed.replace(/```[a-zA-Z]*/g, ''); }
    if (/[“”„‟″]/.test(fixed)) { out.push(msg('info', '휜 따옴표(“ ”)를 곧은 따옴표(")로 바꿨어요.')); fixed = fixed.replace(/[“”„‟″]/g, '"'); }
    fixed = fixed.replace(/[‘’]/g, "'");
    var a = fixed.indexOf('{'), b = fixed.lastIndexOf('}');
    if (a < 0 || b < a) { out.push(msg('bad', '{ 로 시작해서 } 로 끝나는 명령을 찾지 못했어요. AI에게 "WLED JSON 명령을 한 줄로 다시 써 줘"라고 해 보세요.')); $('checkResult').innerHTML = out.join(''); return; }
    var jsonText = fixed.slice(a, b + 1);
    var obj;
    try { obj = JSON.parse(jsonText); }
    catch (e) {
      out.push(msg('bad', '괄호나 쉼표가 깨져 있어서 WLED가 읽을 수 없어요. AI에게 "JSON 문법이 틀렸어. 같은 형식으로 한 줄만 다시 써 줘"라고 하세요.<br><span class="small">(' + esc(e.message) + ')</span>'));
      $('checkResult').innerHTML = out.join(''); return;
    }
    var problems = [], notes = [];
    var seg = obj && Array.isArray(obj.seg) ? obj.seg[0] : null;
    if (!seg) problems.push('"seg" 부분이 없어요. 효과가 안 바뀔 수 있어요. AI에게 형식을 다시 알려 주세요.');
    if (seg && typeof seg.fx !== 'number') problems.push('효과 번호(fx)가 없어요.');
    if (obj.on === false) notes.push('"on":false 라서 불이 꺼져요. 일부러 끄려던 게 아니면 true로 바꾸세요.');
    if (typeof obj.bri === 'number' && obj.bri > 150) { notes.push('밝기 bri가 ' + obj.bri + '이에요. 약속은 150 이하라 150으로 낮췄어요.'); obj.bri = 150; }
    ['sx', 'ix'].forEach(function (k) { if (seg && typeof seg[k] === 'number' && (seg[k] < 0 || seg[k] > 255)) problems.push(k + ' 값은 0~255여야 해요.'); });
    if (seg && (seg.pal === 0 || seg.pal === undefined) && !(Array.isArray(seg.col) && seg.col.length > 1)) notes.push('팔레트가 0(Default)이고 색이 하나뿐이라 한 가지 색만 나올 수 있어요.');

    var effs = parseList(effEl.value), pals = parseList(palEl.value);
    var rows = [];
    function row(k, v, name) { rows.push('<tr><td><code>' + k + '</code></td><td>' + esc(v) + '</td><td>' + (name ? esc(name) : '<span class="muted">—</span>') + '</td></tr>'); }
    if (seg) {
      row('fx', seg.fx, effs[seg.fx] !== undefined ? '효과: ' + effs[seg.fx] : (effs.length ? '목록에 없는 번호예요!' : '효과 목록을 붙이면 이름이 보여요'));
      if (effs.length && effs[seg.fx] === undefined) problems.push('fx ' + seg.fx + '번은 붙여 둔 효과 목록에 없어요. AI에게 목록을 다시 주고 번호를 확인해 달라고 하세요.');
      if (seg.sx !== undefined) row('sx', seg.sx, '속도');
      if (seg.ix !== undefined) row('ix', seg.ix, '세기');
      if (seg.pal !== undefined) row('pal', seg.pal, pals[seg.pal] !== undefined ? '팔레트: ' + pals[seg.pal] : '팔레트');
      if (seg.col) row('col', JSON.stringify(seg.col), '색');
    }
    if (obj.bri !== undefined) row('bri', obj.bri, '밝기');

    problems.forEach(function (p) { out.push(msg('bad', p)); });
    notes.forEach(function (n) { out.push(msg('info', n)); });
    var clean = JSON.stringify(obj);
    if (!problems.length) out.push(msg('ok', '✓ WLED가 읽을 수 있는 명령이에요. 아래 한 줄을 복사해 프리셋의 API command 칸에 붙여 넣으세요.'));
    out.push('<div class="codebox"><button type="button" class="copy">📋 깨끗한 명령 복사</button><pre>' + esc(clean) + '</pre></div>');
    if (rows.length) out.push('<div class="table-wrap"><table style="min-width:0"><thead><tr><th>숫자</th><th>값</th><th>뜻</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>');
    $('checkResult').innerHTML = out.join('');
  }

  // ---------- 증상 고르기 ----------
  var SYMPTOMS = [
    { t: '아무것도 안 켜진다', where: 'WLED 전원 버튼·밝기 → 컨트롤러 전원 표시등 → 어댑터', steps: ['WLED 화면 위쪽 전원 버튼이 켜져 있고 밝기가 0이 아닌지 봐요.', '컨트롤러에 불이 들어와 있는지 봐요. 없으면 선생님께 전원 확인을 부탁해요.', '전원이 꺼진 상태에서 전원 단자를 살짝 당겨 봐요.'], e: 1 },
    { t: '어느 번호부터 뒤가 전부 꺼져 있다', where: '마지막으로 켜진 노드와 첫 번째로 꺼진 노드 사이', steps: ['몇 번까지 켜지는지 번호로 말해요.', '전원을 끄고, 그 두 노드 사이 JST를 빼서 끝까지 다시 꽂아요.', '그래도 그대로면 두 노드 중 하나가 고장. 선생님과 교체해요 (설정은 안 바꿔도 돼요).'], e: 2 },
    { t: '불은 켜지는데 뒤쪽 몇 개가 말을 안 듣는다', where: 'WLED 설정의 LED 수', steps: ['배선은 그대로 두고 설정부터 의심해요.', 'Config → LED Preferences에서 각 출력의 LED 수가 25인지 선생님과 확인해요.'], e: 3 },
    { t: '한 구간 전체가 반응이 없다', where: '단자대의 그 구간 출력, 줄의 IN 끝', steps: ['나머지 구간은 켜지나요? 그럼 그 구간 선만 봐요.', '단자대에 물린 줄이 IN 끝인지 화살표로 확인해요 (OUT 끝을 물리면 안 켜져요).', 'DATA 선이 단자에서 빠지지 않았는지 살짝 당겨 봐요.'], e: 4 },
    { t: '노드 하나만 안 켜진다 (뒤는 정상)', where: '그 노드 자체', steps: ['신호는 지나가니 그 노드의 LED만 고장일 가능성이 커요.', '번호를 기록하고 선생님께. 교체는 전원을 끄고 해요.'], e: 5 },
    { t: '고른 색과 다른 색이 나온다', where: 'WLED 색 순서 설정', steps: ['빨강을 골랐는데 초록이 나오면 색 순서 문제예요.', 'LED Preferences의 Color order를 선생님과 확인해요.'], e: 6 },
    { t: '깜빡이거나 제멋대로 켜진다', where: '덜 꽂힌 DATA 커넥터', steps: ['깜빡이기 시작하는 번호 근처 JST를 하나씩 끝까지 다시 꽂아요 (전원 끄고).', '금속 핀이 보이면 덜 꽂힌 거예요.'], e: 7 },
    { t: '끝으로 갈수록 누렇고 어둡다', where: '끝단 급전선', steps: ['구간 끝(입구 옆) 급전선이 풀리지 않았는지 선생님과 확인해요.', '임시로 밝기를 낮춰 보면 나아지는지 봐요.'], e: 8 },
    { t: '켜자마자 잠깐 켜졌다 꺼진다', where: '전류 부족 또는 단락', steps: ['밝기를 반으로 낮춰 다시 켜 봐요. 살아나면 전원 용량 부족이에요.', '안 살아나면 단락일 수 있어요. 손 떼고 선생님을 불러요.'], e: 9 },
    { t: '박스를 만지면 켜졌다 꺼졌다 한다', where: '헐거운 커넥터, 팽팽한 선', steps: ['선이 팽팽하게 당겨진 곳을 찾아요.', '전원을 끄고 다시 꽂고, 여유 루프를 남겨요.'], e: 10 },
    { t: '엉뚱한 박스가 켜진다 · 순서가 뒤섞였다', where: '설치 순서와 기록표', steps: ['번호 스티커와 순서 기록표를 대조해요.', '연결된 순서가 곧 번호예요. 순서를 바꿔 단 곳을 찾아요.'], e: 11 },
    { t: '켤 때마다 효과가 처음 것으로 돌아간다', where: '부팅 시 프리셋 설정', steps: ['선생님께 "부팅 시 적용 프리셋"을 확인해 달라고 해요.'], e: 12 },
    { t: 'WLED-AP가 안 보이거나 4.3.2.1이 안 열린다', where: '와이파이 연결, 모바일 데이터', steps: ['컨트롤러가 켜져 있는지 봐요.', '모바일 데이터를 끄고, "인터넷 없음" 경고가 나오면 연결 유지를 눌러요.', '주소는 http://4.3.2.1 그대로. 여러 명이 동시에 붙으면 끊겨요.'], e: 13 },
    { t: '프리셋을 저장했는데 변화가 없다', where: '붙여 넣은 명령', steps: ['위의 "AI 답 검사하기"에 그 명령을 붙여 검사해요.', '깨끗한 명령을 다시 붙여 넣고 Save.'], e: 15 }
  ];
  var box = $('symptoms');
  SYMPTOMS.forEach(function (s, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = s.t;
    b.addEventListener('click', function () {
      box.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      $('answer').innerHTML = '<div class="card note"><p class="small muted">먼저 볼 곳</p><h3 style="margin:2px 0 10px">' + esc(s.where) + '</h3><ol style="margin:0;padding-left:20px">' +
        s.steps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
        '</ol><p style="margin-top:12px"><a href="playbook.html#e' + s.e + '">가이드북 ' + s.e + '번에서 자세히 →</a></p></div>';
    });
    box.appendChild(b);
  });

  // ---------- 반으로 나누기 그림 ----------
  var hv = $('halving');
  if (hv) {
    var seq = [100, 50, 25, 13, 7, 4, 2, 1];
    hv.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">' + seq.map(function (n, i) {
      return '<span style="display:inline-flex;align-items:center;gap:6px"><span class="msg ' + (i === seq.length - 1 ? 'ok' : 'info') + '" style="padding:4px 10px">' + (i ? i + '번째 → ' : '시작 ') + n + '개</span>' + (i < seq.length - 1 ? '<span class="muted">›</span>' : '') + '</span>';
    }).join('') + '</div>';
  }
})();
