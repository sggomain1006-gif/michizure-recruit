/* 会社説明会の候補日と表示用の整形（予約ページと完了ページで共有） */
(function () {
  var SEMINAR = { label: '会社説明会', length: '約90分' };
  /* 予約の送り先（Google Apps Script のウェブアプリURL）。空のあいだは送らずに完了ページへ進む */
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbyTTPb8N4fviGqW3d73g1tUHcszqJ0tJdsefo49eIVjWGZuAzD78MFLhODw4tKSPfAwVA/exec';
  var PLACES = { online: 'オンライン', tokyo: '東京本社（対面）', fukuoka: '福岡・西日本本部（対面）' };
  var SLOTS = [
    { id: '20261028-on', date: '2026-10-28', start: '18:30', end: '20:00', place: 'online' },
    { id: '20261107-tk', date: '2026-11-07', start: '13:00', end: '14:30', place: 'tokyo' },
    { id: '20261114-fk', date: '2026-11-14', start: '10:30', end: '12:00', place: 'fukuoka', full: true },
    { id: '20261118-on', date: '2026-11-18', start: '18:30', end: '20:00', place: 'online' },
    { id: '20261128-tk', date: '2026-11-28', start: '13:00', end: '14:30', place: 'tokyo' },
    { id: '20261205-fk', date: '2026-12-05', start: '13:00', end: '14:30', place: 'fukuoka' },
    { id: '20261209-on', date: '2026-12-09', start: '18:30', end: '20:00', place: 'online' }
  ];
  var DAYS = '日月火水木金土';

  function dateLabel(slot) {
    var p = slot.date.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return Number(p[1]) + '月' + Number(p[2]) + '日（' + DAYS.charAt(d.getDay()) + '）';
  }
  function timeLabel(slot) { return slot.start + '〜' + slot.end; }
  function findSlot(id) {
    for (var i = 0; i < SLOTS.length; i++) { if (SLOTS[i].id === id) return SLOTS[i]; }
    return null;
  }
  function track(name, params) {
    if (typeof window.gtag === 'function') { window.gtag('event', name, params || {}); }
  }
  function store(key, value) {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 保存できなくても動く */ }
  }
  function load(key) {
    try { return JSON.parse(sessionStorage.getItem(key)); } catch (e) { return null; }
  }
  function drop(key) {
    try { sessionStorage.removeItem(key); } catch (e) { /* noop */ }
  }

  window.MICHI_FORM = {
    seminar: SEMINAR, endpoint: ENDPOINT, places: PLACES, slots: SLOTS,
    dateLabel: dateLabel, timeLabel: timeLabel, findSlot: findSlot,
    track: track, store: store, load: load, drop: drop
  };
})();
