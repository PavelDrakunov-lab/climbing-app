import React, { useState, useEffect, useMemo } from 'react';

const GYMS = [
  'Северная Стена · Петроградская',
  'Северная Стена · Бухарестская',
  'Трамонтана · Бронницкая',
  'El Capitan · Арсенальная',
  'Луч · Крестовский',
  'Энергия высоты · Обводный',
  'Неолит · Пионерская',
  'Танрэн · Комендантский',
  'СКА · Дивенская',
  'АТОМ',
  'Другой зал',
];

const LEVELS = [
  { value: 'beginner', label: 'Новичок', range: '5a–6a / V0–V2' },
  { value: 'intermediate', label: 'Средний', range: '6b–7a / V3–V5' },
  { value: 'advanced', label: 'Опытный', range: '7b+ / V6+' },
];

const STYLES = [
  { value: 'boulder', label: 'Боулдер' },
  { value: 'rope', label: 'Трудность' },
  { value: 'any', label: 'Без разницы' },
];

const CONDITIONS = [
  { value: 'fresh', label: 'Свежий', emoji: '💪' },
  { value: 'normal', label: 'Норм', emoji: '👌' },
  { value: 'tired', label: 'Устал', emoji: '😮‍💨' },
  { value: 'fingers', label: 'Пальцы', emoji: '🩹' },
];

const WEEKDAYS = [
  { value: 1, short: 'Пн', label: 'Понедельник' },
  { value: 2, short: 'Вт', label: 'Вторник' },
  { value: 3, short: 'Ср', label: 'Среда' },
  { value: 4, short: 'Чт', label: 'Четверг' },
  { value: 5, short: 'Пт', label: 'Пятница' },
  { value: 6, short: 'Сб', label: 'Суббота' },
  { value: 0, short: 'Вс', label: 'Воскресенье' },
];

const SESSIONS_KEY = 'climbing-sessions-v2';
const LOG_KEY = 'climbing-log-v1';
const GYM_NOTES_KEY = 'climbing-gym-notes-v1';
const CHECKINS_KEY = 'climbing-checkins-v1';

const CHECKIN_DURATION_MS = 3 * 60 * 60 * 1000;

const GRADE_SCORES = {
  '5a': 1, '5b': 2, '5c': 3,
  '6a': 4, '6a+': 5, '6b': 6, '6b+': 7, '6c': 8, '6c+': 9,
  '7a': 10, '7a+': 11, '7b': 12, '7b+': 13, '7c': 14, '7c+': 15,
  '8a': 16, '8a+': 17, '8b': 18, '8b+': 19, '8c': 20, '8c+': 21,
};

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nowPlusHourTime() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (d.getTime() === today.getTime()) return 'Сегодня';
  if (d.getTime() === tomorrow.getTime()) return 'Завтра';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' });
}

function formatLogDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  return formatLogDate(new Date(ts).toISOString().slice(0, 10));
}

function parseGrades(text) {
  if (!text) return [];
  const found = [];
  const matches = text.match(/(\d[abc]\+?)/gi) || [];
  for (const m of matches) {
    const norm = m.toLowerCase();
    if (GRADE_SCORES[norm]) found.push({ grade: norm, score: GRADE_SCORES[norm] });
  }
  return found;
}

function maxGradeFromText(text) {
  const grades = parseGrades(text);
  if (grades.length === 0) return null;
  return grades.reduce((m, g) => (g.score > m.score ? g : m), grades[0]);
}

export default function App() {
  const [tab, setTab] = useState('partners');
  const [sessions, setSessions] = useState([]);
  const [log, setLog] = useState([]);
  const [gymNotes, setGymNotes] = useState({});
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showSessionForm, setShowSessionForm] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [completingSession, setCompletingSession] = useState(null);
  const [editingGym, setEditingGym] = useState(null);

  const [filter, setFilter] = useState('all');
  const [boardPeriod, setBoardPeriod] = useState('week');
  const [viewingClimber, setViewingClimber] = useState(null);

  const [name, setName] = useState('');
  const [gym, setGym] = useState(GYMS[0]);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('19:00');
  const [level, setLevel] = useState('intermediate');
  const [style, setStyle] = useState('any');
  const [condition, setCondition] = useState('normal');
  const [note, setNote] = useState('');

  const [recurringDays, setRecurringDays] = useState([2, 4]);
  const [recurringWeeks, setRecurringWeeks] = useState(4);

  const [completedFlash, setCompletedFlash] = useState(0);
  const [completedProjects, setCompletedProjects] = useState(0);
  const [completedAttempts, setCompletedAttempts] = useState(0);
  const [completedGradeList, setCompletedGradeList] = useState([]); // [{grade, count}]
  const [completedFelt, setCompletedFelt] = useState('normal');
  const [completedNote, setCompletedNote] = useState('');

  const [gymNoteText, setGymNoteText] = useState('');
  const [checkinNote, setCheckinNote] = useState('');

  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    function load() {
      try {
        const sessionsRaw = localStorage.getItem(SESSIONS_KEY);
        if (sessionsRaw) {
          const parsed = JSON.parse(sessionsRaw);
          if (Array.isArray(parsed)) setSessions(parsed);
        }
        const logRaw = localStorage.getItem(LOG_KEY);
        if (logRaw) {
          const parsed = JSON.parse(logRaw);
          if (Array.isArray(parsed)) setLog(parsed);
        }
        const gymsRaw = localStorage.getItem(GYM_NOTES_KEY);
        if (gymsRaw) {
          const parsed = JSON.parse(gymsRaw);
          if (parsed && typeof parsed === 'object') setGymNotes(parsed);
        }
        const checkinsRaw = localStorage.getItem(CHECKINS_KEY);
        if (checkinsRaw) {
          const parsed = JSON.parse(checkinsRaw);
          if (Array.isArray(parsed)) setCheckins(parsed);
        }
        const savedName = localStorage.getItem('climber-name');
        if (savedName) setName(savedName);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  function saveSessions(next) {
    setSessions(next);
    try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(next)); } catch (e) { console.error(e); }
  }
  function saveLog(next) {
    setLog(next);
    try { localStorage.setItem(LOG_KEY, JSON.stringify(next)); } catch (e) { console.error(e); }
  }
  function saveGymNotes(next) {
    setGymNotes(next);
    try { localStorage.setItem(GYM_NOTES_KEY, JSON.stringify(next)); } catch (e) { console.error(e); }
  }
  function saveCheckins(next) {
    setCheckins(next);
    try { localStorage.setItem(CHECKINS_KEY, JSON.stringify(next)); } catch (e) { console.error(e); }
  }

  async function handleAddSession() {
    if (!name.trim()) return;
    try { localStorage.setItem('climber-name', name.trim()); } catch (e) {}

    const newSession = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name.trim(),
      gym, date, time, level, style, condition,
      note: note.trim(),
      interested: [],
      createdAt: Date.now(),
    };
    saveSessions([...sessions, newSession]);
    setShowSessionForm(false);
    setNote('');
  }

  async function handleAddRecurring() {
    if (!name.trim() || recurringDays.length === 0) return;
    try { localStorage.setItem('climber-name', name.trim()); } catch (e) {}

    const newSessions = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + recurringWeeks * 7);

    const cursor = new Date(today);
    while (cursor <= endDate) {
      if (recurringDays.includes(cursor.getDay())) {
        const iso = cursor.toISOString().slice(0, 10);
        newSessions.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + '_' + iso,
          name: name.trim(),
          gym, time, level, style, condition,
          date: iso,
          note: note.trim(),
          interested: [],
          recurring: true,
          createdAt: Date.now(),
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    saveSessions([...sessions, ...newSessions]);
    setShowRecurringForm(false);
    setNote('');
  }

  async function handleDeleteSession(id) {
    saveSessions(sessions.filter((s) => s.id !== id));
  }

  async function handleToggleInterest(sessionId) {
    const climber = name.trim() || 'Аноним';
    const next = sessions.map((s) => {
      if (s.id !== sessionId) return s;
      const interested = s.interested || [];
      if (interested.includes(climber)) {
        return { ...s, interested: interested.filter((x) => x !== climber) };
      }
      return { ...s, interested: [...interested, climber] };
    });
    saveSessions(next);
  }

  function openComplete(session) {
    setCompletingSession(session);
    setCompletedFlash(0);
    setCompletedProjects(0);
    setCompletedAttempts(0);
    setCompletedGradeList([]);
    setCompletedFelt('normal');
    setCompletedNote('');
  }

  async function handleSaveComplete() {
    if (!completingSession) return;
    const totalRoutes = completedFlash + completedProjects + completedAttempts;
    const validGrades = completedGradeList.filter((g) => g.grade && g.count > 0);
    if (totalRoutes === 0 || validGrades.length === 0) return;

    // Собираем читаемые строки из структурированных данных, чтобы журнал и карточки выглядели как раньше
    const routesParts = [];
    if (completedFlash > 0) routesParts.push(`${completedFlash} флешем`);
    if (completedProjects > 0) routesParts.push(`${completedProjects} проектов`);
    if (completedAttempts > 0) routesParts.push(`${completedAttempts} попыток`);
    const routesStr = routesParts.join(' + ');
    const gradesStr = validGrades.map((g) => `${g.grade} ×${g.count}`).join(', ');

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      sessionId: completingSession.id,
      name: completingSession.name,
      gym: completingSession.gym,
      date: completingSession.date,
      // Структурированные данные
      flash: completedFlash,
      projects: completedProjects,
      attempts: completedAttempts,
      gradeList: validGrades,
      // Совместимость со старым форматом для отображения
      routes: routesStr,
      grades: gradesStr,
      felt: completedFelt,
      note: completedNote.trim(),
      completedAt: Date.now(),
    };
    saveLog([entry, ...log]);
    saveSessions(sessions.filter((s) => s.id !== completingSession.id));
    setCompletingSession(null);
  }

  async function handleDeleteLogEntry(id) {
    saveLog(log.filter((e) => e.id !== id));
  }

  function openGymNotes(g) {
    setEditingGym(g);
    setGymNoteText(gymNotes[g] || '');
  }

  async function handleSaveGymNote() {
    if (!editingGym) return;
    const next = { ...gymNotes };
    if (gymNoteText.trim()) next[editingGym] = gymNoteText.trim();
    else delete next[editingGym];
    saveGymNotes(next);
    setEditingGym(null);
  }

  async function handleCheckin() {
    if (!name.trim()) return;
    try { localStorage.setItem('climber-name', name.trim()); } catch (e) {}

    const climber = name.trim();
    const filtered = checkins.filter((c) => c.name !== climber);
    const newCheckin = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: climber,
      gym,
      note: checkinNote.trim(),
      condition,
      checkedInAt: Date.now(),
    };
    saveCheckins([...filtered, newCheckin]);
    setShowCheckinForm(false);
    setCheckinNote('');
  }

  async function handleCheckout() {
    const climber = name.trim() || 'Аноним';
    saveCheckins(checkins.filter((c) => c.name !== climber));
  }

  const activeCheckins = useMemo(() => {
    const now = Date.now();
    return checkins
      .filter((c) => now - c.checkedInAt < CHECKIN_DURATION_MS)
      .sort((a, b) => b.checkedInAt - a.checkedInAt);
  }, [checkins]);

  const myActiveCheckin = useMemo(() => {
    const climber = name.trim();
    if (!climber) return null;
    return activeCheckins.find((c) => c.name === climber) || null;
  }, [activeCheckins, name]);

  const now = new Date();
  const visibleSessions = sessions
    .filter((s) => {
      const dt = new Date(s.date + 'T' + s.time);
      // показываем сегодняшние записи весь день, плюс будущие
      return dt.getTime() > now.getTime() - 12 * 60 * 60 * 1000;
    })
    .filter((s) => filter === 'all' || s.level === filter)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const leaderboard = useMemo(() => {
    const cutoffMs = boardPeriod === 'week'
      ? 7 * 24 * 60 * 60 * 1000
      : boardPeriod === 'month'
      ? 30 * 24 * 60 * 60 * 1000
      : Infinity;
    const cutoff = Date.now() - cutoffMs;

    const stats = {};
    for (const e of log) {
      if (e.completedAt < cutoff) continue;
      if (!stats[e.name]) stats[e.name] = { name: e.name, sessions: 0, gyms: new Set(), maxGrade: null };
      stats[e.name].sessions += 1;
      stats[e.name].gyms.add(e.gym);
      const top = maxGradeFromText(e.grades);
      if (top && (!stats[e.name].maxGrade || top.score > stats[e.name].maxGrade.score)) {
        stats[e.name].maxGrade = top;
      }
    }
    return Object.values(stats)
      .map((s) => ({ ...s, gyms: s.gyms.size }))
      .sort((a, b) => b.sessions - a.sessions || (b.maxGrade?.score || 0) - (a.maxGrade?.score || 0));
  }, [log, boardPeriod]);

  return (
    <div className="min-h-screen bg-stone-50" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />

      <header className="border-b-2 border-stone-900 bg-stone-50 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-stone-900 leading-none">
                КТО ЛЕЗЕТ
              </h1>
              <p className="text-xs text-stone-500 mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {activeCheckins.length > 0
                  ? `🟢 сейчас в зале: ${activeCheckins.length}`
                  : 'партнёры · журнал · рейтинг · залы'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-orange-600 leading-none">
                {tab === 'partners' ? visibleSessions.length
                  : tab === 'log' ? log.length
                  : tab === 'leaderboard' ? leaderboard.length
                  : Object.keys(gymNotes).length}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-stone-500 mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {tab === 'partners' ? 'записей'
                  : tab === 'log' ? 'тренировок'
                  : tab === 'leaderboard' ? 'участников'
                  : 'заметок'}
              </div>
            </div>
          </div>
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            <TabButton active={tab === 'partners'} onClick={() => setTab('partners')}>Партнёры</TabButton>
            <TabButton active={tab === 'log'} onClick={() => setTab('log')}>Журнал</TabButton>
            <TabButton active={tab === 'leaderboard'} onClick={() => setTab('leaderboard')}>Рейтинг</TabButton>
            <TabButton active={tab === 'gyms'} onClick={() => setTab('gyms')}>Залы</TabButton>
          </nav>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-32">
        {loading ? (
          <div className="text-center py-12 text-stone-400 italic">Загружаем…</div>
        ) : tab === 'partners' ? (
          <PartnersTab
            sessions={visibleSessions}
            checkins={activeCheckins}
            currentName={name}
            filter={filter}
            setFilter={setFilter}
            onDelete={handleDeleteSession}
            onToggleInterest={handleToggleInterest}
            onComplete={openComplete}
          />
        ) : tab === 'log' ? (
          <LogTab log={log} onDelete={handleDeleteLogEntry} />
        ) : tab === 'leaderboard' ? (
          <LeaderboardTab
            board={leaderboard}
            period={boardPeriod}
            setPeriod={setBoardPeriod}
            currentName={name}
            onSelectClimber={setViewingClimber}
          />
        ) : (
          <GymsTab gymNotes={gymNotes} onEdit={openGymNotes} />
        )}
      </main>

      {!showSessionForm && !showRecurringForm && !showCheckinForm && !completingSession && !editingGym && tab === 'partners' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {myActiveCheckin ? (
            <button
              onClick={handleCheckout}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-full shadow-lg font-bold tracking-wide transition active:scale-95 flex items-center gap-2"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Я в зале · уйти
            </button>
          ) : (
            <button
              onClick={() => setShowCheckinForm(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-full shadow-lg font-bold tracking-wide transition active:scale-95"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              📍 Я тут
            </button>
          )}
          <button
            onClick={() => {
              setDate(todayISO());
              setTime(nowPlusHourTime());
              setShowSessionForm(true);
            }}
            className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-3 rounded-full shadow-lg font-bold tracking-wide transition active:scale-95"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            + Иду лазать
          </button>
          <button
            onClick={() => setShowRecurringForm(true)}
            className="bg-stone-900 hover:bg-stone-800 text-white px-4 py-3 rounded-full shadow-lg font-bold tracking-wide transition active:scale-95"
            style={{ fontFamily: "'Fraunces', serif" }}
            title="Регулярные слоты"
          >
            ⟳
          </button>
        </div>
      )}

      {showCheckinForm && (
        <Modal title="Я сейчас в зале" onClose={() => setShowCheckinForm(false)}>
          <p className="text-sm text-stone-600 -mt-1 mb-2">
            Скажи друзьям, что ты на скалодроме прямо сейчас. Чекин держится 3 часа, потом пропадает сам.
          </p>
          <Field label="Имя">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как тебя зовут"
              className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-stone-900 focus:border-emerald-600 focus:outline-none"
            />
          </Field>
          <Field label="Зал">
            <select
              value={gym}
              onChange={(e) => setGym(e.target.value)}
              className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-stone-900 focus:border-emerald-600 focus:outline-none"
            >
              {GYMS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Самочувствие">
            <div className="grid grid-cols-4 gap-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCondition(c.value)}
                  className={`py-2 rounded border-2 transition ${
                    condition === c.value
                      ? 'border-stone-900 bg-stone-900 text-stone-50'
                      : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
                  }`}
                >
                  <div className="text-lg leading-none">{c.emoji}</div>
                  <div className="text-[10px] mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {c.label.toLowerCase()}
                  </div>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Сообщение (необязательно)">
            <input
              type="text"
              value={checkinNote}
              onChange={(e) => setCheckinNote(e.target.value)}
              placeholder="например: на левой стене, до 22:00"
              className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-stone-900 focus:border-emerald-600 focus:outline-none"
            />
          </Field>
          <button
            onClick={handleCheckin}
            disabled={!name.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white py-3 rounded font-bold tracking-wide transition active:scale-95 mt-2"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            📍 Я здесь
          </button>
        </Modal>
      )}

      {showSessionForm && (
        <Modal title="Новая запись" onClose={() => setShowSessionForm(false)}>
          <SessionFormFields
            {...{ name, setName, gym, setGym, date, setDate, time, setTime,
                  level, setLevel, style, setStyle, condition, setCondition, note, setNote }}
            showDate
          />
          <button
            onClick={handleAddSession}
            disabled={!name.trim()}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white py-3 rounded font-bold tracking-wide transition active:scale-95 mt-2"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Записаться
          </button>
        </Modal>
      )}

      {showRecurringForm && (
        <Modal title="Регулярные слоты" onClose={() => setShowRecurringForm(false)}>
          <p className="text-sm text-stone-600 -mt-1 mb-2">
            Записать тебя на одно и то же время в выбранные дни недели
          </p>
          <SessionFormFields
            {...{ name, setName, gym, setGym, date, setDate, time, setTime,
                  level, setLevel, style, setStyle, condition, setCondition, note, setNote }}
            showDate={false}
          />
          <Field label="Дни недели">
            <div className="flex gap-1.5 flex-wrap">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => {
                    setRecurringDays(
                      recurringDays.includes(d.value)
                        ? recurringDays.filter((x) => x !== d.value)
                        : [...recurringDays, d.value]
                    );
                  }}
                  className={`w-11 h-11 rounded-full border-2 text-sm font-bold transition ${
                    recurringDays.includes(d.value)
                      ? 'border-stone-900 bg-stone-900 text-stone-50'
                      : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
                  }`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {d.short}
                </button>
              ))}
            </div>
          </Field>
          <Field label="На сколько недель вперёд">
            <div className="grid grid-cols-4 gap-2">
              {[2, 4, 8, 12].map((w) => (
                <button
                  key={w}
                  onClick={() => setRecurringWeeks(w)}
                  className={`py-2 rounded border-2 font-bold transition ${
                    recurringWeeks === w
                      ? 'border-stone-900 bg-stone-900 text-stone-50'
                      : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
                  }`}
                >
                  {w} нед.
                </button>
              ))}
            </div>
          </Field>
          <button
            onClick={handleAddRecurring}
            disabled={!name.trim() || recurringDays.length === 0}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white py-3 rounded font-bold tracking-wide transition active:scale-95 mt-2"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Создать слоты
          </button>
        </Modal>
      )}

      {completingSession && (
        <Modal title="Как прошло?" onClose={() => setCompletingSession(null)}>
          <div className="bg-stone-100 p-3 rounded text-sm text-stone-700 -mt-1 mb-2">
            <span className="font-bold">{completingSession.gym}</span> · {formatDate(completingSession.date)} в {completingSession.time}
          </div>
          <Field label="Что получилось *">
            <div className="grid grid-cols-3 gap-2">
              <Counter
                label="Флешем"
                hint="с первой попытки"
                value={completedFlash}
                onChange={setCompletedFlash}
              />
              <Counter
                label="Проекты"
                hint="взял после работы"
                value={completedProjects}
                onChange={setCompletedProjects}
              />
              <Counter
                label="Попытки"
                hint="не удалось"
                value={completedAttempts}
                onChange={setCompletedAttempts}
              />
            </div>
          </Field>

          <Field label="Категории *">
            <GradePicker value={completedGradeList} onChange={setCompletedGradeList} />
            <p className="text-[10px] text-stone-500 mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              нажми на категорию чтобы добавить, потом меняй число
            </p>
          </Field>

          <Field label="Как себя чувствовал">
            <div className="grid grid-cols-4 gap-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCompletedFelt(c.value)}
                  className={`py-2 rounded border-2 transition ${
                    completedFelt === c.value
                      ? 'border-stone-900 bg-stone-900 text-stone-50'
                      : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
                  }`}
                >
                  <div className="text-lg leading-none">{c.emoji}</div>
                  <div className="text-[10px] mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {c.label.toLowerCase()}
                  </div>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Заметка (необязательно)">
            <textarea
              value={completedNote}
              onChange={(e) => setCompletedNote(e.target.value)}
              placeholder="что получилось, что нет, что попробовать в следующий раз"
              rows={3}
              className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-stone-900 focus:border-orange-600 focus:outline-none resize-none"
            />
          </Field>
          <button
            onClick={handleSaveComplete}
            disabled={
              completedFlash + completedProjects + completedAttempts === 0 ||
              completedGradeList.filter((g) => g.grade && g.count > 0).length === 0
            }
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white py-3 rounded font-bold tracking-wide transition active:scale-95 mt-2"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Сохранить в журнал
          </button>
        </Modal>
      )}

      {editingGym && (
        <Modal title={editingGym} onClose={() => setEditingGym(null)}>
          <Field label="Заметки про этот зал">
            <textarea
              value={gymNoteText}
              onChange={(e) => setGymNoteText(e.target.value)}
              placeholder="Любимые стены, когда меньше народа, проекты, что попробовать..."
              rows={8}
              className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-stone-900 focus:border-orange-600 focus:outline-none resize-none"
              style={{ fontFamily: "'Fraunces', serif" }}
            />
          </Field>
          <button
            onClick={handleSaveGymNote}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded font-bold tracking-wide transition active:scale-95 mt-2"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Сохранить
          </button>
        </Modal>
      )}

      {viewingClimber && (
        <Modal title={viewingClimber} onClose={() => setViewingClimber(null)}>
          <ClimberHistory climberName={viewingClimber} log={log} />
        </Modal>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-bold tracking-wide border-b-2 transition whitespace-nowrap ${
        active
          ? 'text-stone-900 border-orange-600'
          : 'text-stone-500 border-transparent hover:text-stone-900'
      }`}
      style={{ fontFamily: "'Fraunces', serif" }}
    >
      {children}
    </button>
  );
}

function PartnersTab({ sessions, checkins, currentName, filter, setFilter, onDelete, onToggleInterest, onComplete }) {
  const climberName = currentName.trim() || 'Аноним';

  return (
    <>
      {checkins.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xs uppercase tracking-widest text-stone-700 font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Сейчас в зале
            </h2>
          </div>
          <div className="space-y-2">
            {checkins.map((c) => {
              const cond = CONDITIONS.find((x) => x.value === c.condition);
              const isMine = c.name === climberName;
              return (
                <div key={c.id} className={`bg-white border-2 rounded-lg p-3 ${isMine ? 'border-emerald-500' : 'border-stone-200'}`}>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-bold text-stone-900">{c.name}</span>
                    {isMine && <span className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>это ты</span>}
                    {cond && <span title={cond.label}>{cond.emoji}</span>}
                    <span className="text-stone-400">·</span>
                    <span className="text-stone-700 text-sm">{c.gym}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-xs text-stone-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {timeAgo(c.checkedInAt)}
                    </span>
                    {c.note && <span className="text-sm text-stone-700 italic flex-1 text-right">«{c.note}»</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest text-stone-700 font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Запланировано
        </h2>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>все уровни</FilterChip>
        {LEVELS.map((l) => (
          <FilterChip key={l.value} active={filter === l.value} onClick={() => setFilter(l.value)}>
            {l.label.toLowerCase()}
          </FilterChip>
        ))}
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12 px-6 border-2 border-dashed border-stone-300 rounded-lg">
          <div className="text-4xl mb-2">🧗</div>
          <p className="text-stone-700 font-medium">Пока никто не записался</p>
          <p className="text-stone-500 text-sm mt-1">Нажми «Иду лазать» внизу</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const levelInfo = LEVELS.find((l) => l.value === s.level);
            const styleInfo = STYLES.find((st) => st.value === s.style);
            const condInfo = CONDITIONS.find((c) => c.value === s.condition);
            const interested = s.interested || [];
            const isInterested = interested.includes(climberName);
            const isMine = s.name === climberName;

            return (
              <article key={s.id} className="bg-white border border-stone-200 rounded-lg p-4 hover:border-stone-900 transition group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap mb-1">
                      <h3 className="text-lg font-bold text-stone-900">{s.name}</h3>
                      <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 bg-orange-100 text-orange-800 rounded" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {levelInfo?.label}
                      </span>
                      {condInfo && <span title={condInfo.label}>{condInfo.emoji}</span>}
                      {s.recurring && <span className="text-[10px] text-stone-500" title="Регулярный слот">⟳</span>}
                    </div>
                    <p className="text-stone-600 text-sm">{s.gym}</p>
                    <div className="flex items-center gap-3 mt-2 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      <span className="font-semibold text-stone-900">{formatDate(s.date)}</span>
                      <span className="text-stone-400">•</span>
                      <span className="text-stone-700">{s.time}</span>
                      <span className="text-stone-400">•</span>
                      <span className="text-stone-700">{styleInfo?.label}</span>
                    </div>
                    {s.note && (
                      <p className="text-stone-700 text-sm mt-3 italic border-l-2 border-stone-300 pl-3">{s.note}</p>
                    )}

                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {!isMine && (
                        <button
                          onClick={() => onToggleInterest(s.id)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition ${
                            isInterested
                              ? 'bg-orange-600 text-white border-orange-600'
                              : 'bg-white text-stone-700 border-stone-300 hover:border-orange-600'
                          }`}
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {isInterested ? '✓ хочу с тобой' : '+1 хочу с тобой'}
                        </button>
                      )}
                      {interested.length > 0 && (
                        <span className="text-xs text-stone-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {interested.length}: {interested.join(', ')}
                        </span>
                      )}
                      {isMine && (
                        <button
                          onClick={() => onComplete(s)}
                          className="text-xs px-3 py-1.5 rounded-full border border-stone-900 bg-stone-900 text-stone-50 hover:bg-stone-800 transition"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          ✓ отметить пройденным
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onDelete(s.id)}
                    className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-600 text-xs transition"
                    title="Удалить запись"
                  >
                    ✕
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-stone-400 mt-12" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        записи общие · ты сейчас как «{climberName}»
      </p>
    </>
  );
}

function LogTab({ log, onDelete }) {
  if (log.length === 0) {
    return (
      <div className="text-center py-16 px-6 border-2 border-dashed border-stone-300 rounded-lg">
        <div className="text-5xl mb-3">📓</div>
        <p className="text-stone-700 text-lg font-medium">Журнал пуст</p>
        <p className="text-stone-500 text-sm mt-2">
          После тренировки на вкладке «Партнёры» нажми «отметить пройденным» под своей записью
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {log.map((e) => {
        const cond = CONDITIONS.find((c) => c.value === e.felt);
        const top = maxGradeFromText(e.grades);
        return (
          <article key={e.id} className="bg-white border border-stone-200 rounded-lg p-4 group">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-bold text-stone-900" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatLogDate(e.date)}
                  </span>
                  {cond && <span title={cond.label}>{cond.emoji}</span>}
                  {top && (
                    <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 bg-orange-100 text-orange-800 rounded font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      топ: {top.grade}
                    </span>
                  )}
                </div>
                <p className="text-stone-600 text-sm mt-0.5">{e.name} · {e.gym}</p>
                {(e.routes || e.grades) && (
                  <div className="mt-3 space-y-1 text-sm">
                    {e.routes && (
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-stone-500 mr-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>трассы</span>
                        <span className="text-stone-800">{e.routes}</span>
                      </div>
                    )}
                    {e.grades && (
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-stone-500 mr-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>категории</span>
                        <span className="text-stone-800 font-bold">{e.grades}</span>
                      </div>
                    )}
                  </div>
                )}
                {e.note && (
                  <p className="text-stone-700 text-sm mt-3 italic border-l-2 border-stone-300 pl-3">{e.note}</p>
                )}
              </div>
              <button
                onClick={() => onDelete(e.id)}
                className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-600 text-xs transition"
              >
                ✕
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function LeaderboardTab({ board, period, setPeriod, currentName, onSelectClimber }) {
  const climberName = currentName.trim();

  return (
    <>
      <div className="flex gap-2 mb-6">
        {[
          { v: 'week', l: 'неделя' },
          { v: 'month', l: 'месяц' },
          { v: 'all', l: 'всё время' },
        ].map((p) => (
          <FilterChip key={p.v} active={period === p.v} onClick={() => setPeriod(p.v)}>
            {p.l}
          </FilterChip>
        ))}
      </div>

      {board.length === 0 ? (
        <div className="text-center py-16 px-6 border-2 border-dashed border-stone-300 rounded-lg">
          <div className="text-5xl mb-3">🏆</div>
          <p className="text-stone-700 text-lg font-medium">Тут пока пусто</p>
          <p className="text-stone-500 text-sm mt-2">
            Запиши тренировки в журнал — рейтинг считается автоматически
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {board.map((s, i) => {
            const isMe = s.name === climberName;
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
            return (
              <button
                key={s.name}
                onClick={() => onSelectClimber(s.name)}
                className={`w-full text-left bg-white border rounded-lg p-4 transition hover:border-stone-900 ${
                  isMe ? 'border-orange-600 border-2' : 'border-stone-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-black text-stone-400 w-8 text-center" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {medal || `${i + 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-bold text-stone-900 text-lg">{s.name}</span>
                      {isMe && <span className="text-[10px] uppercase tracking-widest text-orange-700 font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>ты</span>}
                    </div>
                    <div className="flex items-baseline gap-3 text-sm text-stone-600 mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      <span><b className="text-stone-900">{s.sessions}</b> {s.sessions === 1 ? 'тренировка' : s.sessions < 5 ? 'тренировки' : 'тренировок'}</span>
                      <span>·</span>
                      <span><b className="text-stone-900">{s.gyms}</b> {s.gyms === 1 ? 'зал' : 'залов'}</span>
                    </div>
                  </div>
                  {s.maxGrade && (
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-widest text-stone-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        топ
                      </div>
                      <div className="text-xl font-black text-orange-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {s.maxGrade.grade}
                      </div>
                    </div>
                  )}
                  <span className="text-stone-400 text-xl">›</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-stone-400 mt-8" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        нажми на участника, чтобы увидеть его тренировки
      </p>
    </>
  );
}

function ClimberHistory({ climberName, log }) {
  const myEntries = log
    .filter((e) => e.name === climberName)
    .sort((a, b) => b.completedAt - a.completedAt);

  const totalSessions = myEntries.length;
  const uniqueGyms = new Set(myEntries.map((e) => e.gym)).size;
  const allGrades = myEntries.flatMap((e) => parseGrades(e.grades));
  const topGrade = allGrades.length > 0
    ? allGrades.reduce((m, g) => (g.score > m.score ? g : m), allGrades[0])
    : null;

  if (myEntries.length === 0) {
    return (
      <div className="text-center py-6 text-stone-500 italic -mt-2">
        Пока нет записей в журнале
      </div>
    );
  }

  return (
    <div className="-mt-2">
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-stone-100 rounded-lg p-3 text-center">
          <div className="text-2xl font-black text-stone-900" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {totalSessions}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-stone-500 mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            тренировок
          </div>
        </div>
        <div className="bg-stone-100 rounded-lg p-3 text-center">
          <div className="text-2xl font-black text-stone-900" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {uniqueGyms}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-stone-500 mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            залов
          </div>
        </div>
        <div className="bg-orange-100 rounded-lg p-3 text-center">
          <div className="text-2xl font-black text-orange-700" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {topGrade?.grade || '—'}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-orange-700 mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            топ
          </div>
        </div>
      </div>

      <h3 className="text-xs uppercase tracking-widest text-stone-700 font-bold mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        История
      </h3>

      <div className="space-y-2">
        {myEntries.map((e) => {
          const cond = CONDITIONS.find((c) => c.value === e.felt);
          const top = maxGradeFromText(e.grades);
          return (
            <article key={e.id} className="bg-white border border-stone-200 rounded-lg p-3">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-bold text-stone-900 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatLogDate(e.date)}
                </span>
                {cond && <span className="text-sm" title={cond.label}>{cond.emoji}</span>}
                {top && (
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 bg-orange-100 text-orange-800 rounded font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    топ: {top.grade}
                  </span>
                )}
              </div>
              <p className="text-stone-600 text-xs mt-0.5">{e.gym}</p>
              {(e.routes || e.grades) && (
                <div className="mt-2 space-y-0.5 text-sm">
                  {e.routes && (
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-stone-500 mr-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>трассы</span>
                      <span className="text-stone-800">{e.routes}</span>
                    </div>
                  )}
                  {e.grades && (
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-stone-500 mr-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>категории</span>
                      <span className="text-stone-800 font-bold">{e.grades}</span>
                    </div>
                  )}
                </div>
              )}
              {e.note && (
                <p className="text-stone-700 text-sm mt-2 italic border-l-2 border-stone-300 pl-3">{e.note}</p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function GymsTab({ gymNotes, onEdit }) {
  return (
    <div className="space-y-3">
      {GYMS.map((g) => {
        const hasNote = !!gymNotes[g];
        return (
          <button
            key={g}
            onClick={() => onEdit(g)}
            className={`w-full text-left bg-white border rounded-lg p-4 transition ${
              hasNote ? 'border-stone-900' : 'border-stone-200 hover:border-stone-500'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-stone-900">{g}</h3>
              <span className="text-[10px] uppercase tracking-widest text-stone-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {hasNote ? 'есть заметки' : 'добавить'}
              </span>
            </div>
            {hasNote && (
              <p className="text-stone-700 text-sm mt-2 whitespace-pre-wrap line-clamp-3">
                {gymNotes[g]}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs uppercase tracking-wider rounded-full border whitespace-nowrap transition ${
        active
          ? 'bg-stone-900 text-stone-50 border-stone-900'
          : 'bg-transparent text-stone-700 border-stone-300 hover:border-stone-900'
      }`}
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {children}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-20 flex items-center justify-center p-4">
      <div className="bg-stone-50 w-full max-w-md rounded-2xl border-2 border-stone-900 max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b-2 border-stone-900 flex items-baseline justify-between sticky top-0 bg-stone-50 z-10">
          <h2 className="text-xl font-black tracking-tight text-stone-900">{title}</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function SessionFormFields({
  name, setName, gym, setGym, date, setDate, time, setTime,
  level, setLevel, style, setStyle, condition, setCondition, note, setNote,
  showDate,
}) {
  return (
    <>
      <Field label="Имя">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Как тебя зовут"
          className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-stone-900 focus:border-orange-600 focus:outline-none"
        />
      </Field>

      <Field label="Зал">
        <select
          value={gym}
          onChange={(e) => setGym(e.target.value)}
          className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-stone-900 focus:border-orange-600 focus:outline-none"
        >
          {GYMS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </Field>

      <div className={showDate ? 'grid grid-cols-2 gap-3' : ''}>
        {showDate && (
          <Field label="Дата">
            <input
              type="date"
              value={date}
              min={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-stone-900 focus:border-orange-600 focus:outline-none"
            />
          </Field>
        )}
        <Field label="Время">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-stone-900 focus:border-orange-600 focus:outline-none"
          />
        </Field>
      </div>

      <Field label="Уровень">
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              onClick={() => setLevel(l.value)}
              className={`px-2 py-2 rounded border-2 text-center transition ${
                level === l.value
                  ? 'border-stone-900 bg-stone-900 text-stone-50'
                  : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
              }`}
            >
              <div className="text-sm font-bold">{l.label}</div>
              <div className="text-[10px] opacity-70 mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {l.range}
              </div>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Стиль">
        <div className="grid grid-cols-3 gap-2">
          {STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStyle(s.value)}
              className={`px-2 py-2 rounded border-2 text-sm font-medium transition ${
                style === s.value
                  ? 'border-stone-900 bg-stone-900 text-stone-50'
                  : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Самочувствие">
        <div className="grid grid-cols-4 gap-2">
          {CONDITIONS.map((c) => (
            <button
              key={c.value}
              onClick={() => setCondition(c.value)}
              className={`py-2 rounded border-2 transition ${
                condition === c.value
                  ? 'border-stone-900 bg-stone-900 text-stone-50'
                  : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
              }`}
            >
              <div className="text-lg leading-none">{c.emoji}</div>
              <div className="text-[10px] mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {c.label.toLowerCase()}
              </div>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Заметка (необязательно)">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Например: проектирую 7а на левой стене"
          rows={2}
          className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-stone-900 focus:border-orange-600 focus:outline-none resize-none"
        />
      </Field>
    </>
  );
}

function Counter({ label, hint, value, onChange }) {
  return (
    <div className="bg-white border-2 border-stone-300 rounded-lg p-2 text-center">
      <div className="text-[10px] uppercase tracking-widest text-stone-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {label}
      </div>
      <div className="text-[9px] text-stone-400 mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {hint}
      </div>
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 rounded-full bg-stone-100 text-stone-700 font-bold hover:bg-stone-200 transition active:scale-90"
          type="button"
        >
          −
        </button>
        <span className="text-2xl font-black text-stone-900 w-8 text-center" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {value}
        </span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 rounded-full bg-orange-600 text-white font-bold hover:bg-orange-700 transition active:scale-90"
          type="button"
        >
          +
        </button>
      </div>
    </div>
  );
}

const PICKABLE_GRADES = [
  '5a', '5b', '5c',
  '6a', '6a+', '6b', '6b+', '6c', '6c+',
  '7a', '7a+', '7b', '7b+', '7c', '7c+',
  '8a', '8a+', '8b', '8b+',
];

function GradePicker({ value, onChange }) {
  // value: [{grade, count}]
  function addGrade(g) {
    if (value.find((x) => x.grade === g)) return;
    onChange([...value, { grade: g, count: 1 }]);
  }
  function removeGrade(g) {
    onChange(value.filter((x) => x.grade !== g));
  }
  function updateCount(g, count) {
    if (count < 1) {
      removeGrade(g);
      return;
    }
    onChange(value.map((x) => (x.grade === g ? { ...x, count } : x)));
  }

  // Сортируем выбранные по сложности (возрастание)
  const sorted = [...value].sort((a, b) => (GRADE_SCORES[a.grade] || 0) - (GRADE_SCORES[b.grade] || 0));
  const usedSet = new Set(value.map((x) => x.grade));

  return (
    <div className="space-y-2">
      {sorted.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {sorted.map((g) => (
            <div key={g.grade} className="flex items-center gap-2 bg-stone-100 rounded px-2 py-1.5">
              <span className="font-bold text-stone-900 w-12" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {g.grade}
              </span>
              <span className="text-stone-500 text-sm">×</span>
              <button
                onClick={() => updateCount(g.grade, g.count - 1)}
                className="w-6 h-6 rounded-full bg-white text-stone-700 font-bold hover:bg-stone-200 transition text-sm"
                type="button"
              >
                −
              </button>
              <span className="text-base font-black text-stone-900 w-6 text-center" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {g.count}
              </span>
              <button
                onClick={() => updateCount(g.grade, g.count + 1)}
                className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold hover:bg-orange-700 transition text-sm"
                type="button"
              >
                +
              </button>
              <button
                onClick={() => removeGrade(g.grade)}
                className="ml-auto text-stone-400 hover:text-red-600 text-xs"
                type="button"
              >
                удалить
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {PICKABLE_GRADES.map((g) => {
          const isUsed = usedSet.has(g);
          return (
            <button
              key={g}
              onClick={() => addGrade(g)}
              disabled={isUsed}
              className={`px-2.5 py-1 text-xs rounded border transition ${
                isUsed
                  ? 'bg-stone-100 border-stone-200 text-stone-300 cursor-not-allowed'
                  : 'bg-white border-stone-300 text-stone-700 hover:border-orange-600 hover:text-orange-700'
              }`}
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
              type="button"
            >
              {g}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {label}
      </div>
      {children}
    </label>
  );
}
