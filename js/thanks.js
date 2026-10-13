(function () {
  var F = window.MICHI_FORM;
  var params = new URLSearchParams(location.search);
  var slot = F.findSlot(params.get('slot') || '');
  var ok = Boolean(slot);

  document.getElementById(ok ? 'thanks-ok' : 'thanks-none').hidden = false;
  if (!ok) { return; }

  document.getElementById('s-date').textContent = F.dateLabel(slot) + ' ' + F.timeLabel(slot) + '（' + F.seminar.length + '）';
  document.getElementById('s-place').textContent = F.places[slot.place];

  var saved = F.load('michizure_seminar_done');
  if (saved && typeof saved.email === 'string' && saved.email) {
    document.getElementById('s-mail').textContent =
      saved.email + ' 宛に、予約内容の確認メールをお送りします。5分以内に届かない場合はご登録のメールアドレスに間違いがないか、また、迷惑メールフォルダをご確認ください。';
  }
  F.track('form_complete_view', { slot_id: slot.id });
})();
