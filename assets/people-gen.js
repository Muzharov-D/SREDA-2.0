/* ========================================================================== */
/*  PEOPLE-GEN — детерминированная генерация рядовых сотрудников штата          */
/*  «Пульс компании» и «Пульс отдела» показывают полную штатную численность.   */
/*  Именные узлы (COCKPITS[dept].team, DIGITAL_STAFF[dept]) проработаны вручную.*/
/*  Остальные нейроны — добивка до штата. Этот модуль даёт каждому такому узлу  */
/*  ДЕТЕРМИНИРОВАННУЮ личность: одна и та же при перезагрузке (хеш от dept+kind  */
/*  +index, без Math.random/Date). Ховер — имя и роль, клик — полный профиль.   */
/*                                                                              */
/*  Подключён ПОСЛЕ rpg.js/talent.js — использует RPG_LVL_LBL, ROLE_SWARM,      */
/*  COCKPITS, DEPARTMENTS. Реестр window.__PEOPLEGEN кеширует объекты, чтобы     */
/*  ховер на карте и профиль по роуту работали с одной и той же личностью.       */
/* ========================================================================== */

/* детерминированный хеш строки (тот же контракт, что rpgHash/tlHash) */
function pgHash(s){ let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h >>> 0; }

/* --- пулы имён ------------------------------------------------------------- */
/* живые ФИО: мужские / женские имена + нейтральные фамилии (мужской/женский    */
/* варианты), пол выбирается детерминированно — имя и фамилия согласованы.       */
const PG_MALE_FIRST = ['Артём','Кирилл','Михаил','Роман','Никита','Андрей','Сергей','Дмитрий','Антон','Илья','Глеб','Степан','Тимофей','Григорий','Максим','Егор','Олег','Вадим','Борис','Леонид','Виктор','Руслан','Денис','Игорь'];
const PG_FEMALE_FIRST = ['Анна','Мария','Екатерина','Ольга','Татьяна','Дарья','Наталья','Юлия','Ирина','Елена','Светлана','Полина','Ксения','Алина','Вероника','Маргарита','Александра','Любовь','Галина','Валентина','Нина','София','Виктория','Алёна'];
const PG_SURNAME = [
  ['Соколов','Соколова'],['Морозов','Морозова'],['Волков','Волкова'],['Зайцев','Зайцева'],['Лебедев','Лебедева'],
  ['Козлов','Козлова'],['Новиков','Новикова'],['Орлов','Орлова'],['Макаров','Макарова'],['Никитин','Никитина'],
  ['Захаров','Захарова'],['Беляев','Беляева'],['Тарасов','Тарасова'],['Беляков','Белякова'],['Громов','Громова'],
  ['Киселёв','Киселёва'],['Кудрявцев','Кудрявцева'],['Фомин','Фомина'],['Журавлёв','Журавлёва'],['Воронов','Воронова'],
  ['Сорокин','Сорокина'],['Гаврилов','Гаврилова'],['Авдеев','Авдеева'],['Прохоров','Прохорова'],['Богданов','Богданова'],
  ['Корнеев','Корнеева'],['Дроздов','Дроздова'],['Самойлов','Самойлова'],['Власов','Власова'],['Поляков','Полякова'],
];
/* «цифровые» фамилии-позывные — тот же приём, что в talent.js (Вектор/Квант…) */
const PG_DIGIT_SURNAME = ['Вектор','Квант','Тензор','Радиан','Парсек','Сигма','Дельта','Фотон','Кварк','Спектр','Импульс','Модуль','Эфир','Зенит','Апекс','Базис','Растр','Глиф','Скаляр','Орбита','Призма','Катет','Литера','Индекс','Кортеж','Маятник','Полюс','Ротор','Синус','Триггер','Контур','Резонанс','Грань','Атом','Нейрон'];
const PG_DIGIT_FIRST = ['Артём','Марк','Алиса','Дарья','Ева','Олег','Нора','Илья','Антон','Руслан','Софи','Юна','Виктор','Лада','Егор','Инга','Лев','Майя','Тимур','Вера'];

/* эмодзи-аватары цифровых по «специализации» */
const PG_DIGIT_EMOJI = ['🤖','🛰️','⚙️','📡','🧮','🔭','💠','🧬','🔢','🌀'];

/* текущие задачи-болванки по «зоне» (детерминированно подставляются под роль) */
const PG_NOW_HUMAN = ['разбор тикетов очереди','подготовка к ревью','синк с командой','оформление результата','проверка черновика роя','планирование задач на спринт','отработка обратной связи','закрытие задачи к дедлайну'];
const PG_NOW_DIGIT = ['черновик готовится','прогон проверок','сбор результата','очередь задач функции','подготовка отчёта руководителю','обработка входящего тикета','генерация по шаблону должности','финальная сверка перед передачей'];

/* --- вспомогательное: роли/функции/скиллы из существующих данных отдела ---- */
function pgDeptTeam(dept){ return (typeof COCKPITS !== 'undefined' && COCKPITS[dept] && COCKPITS[dept].team) || []; }
function pgTeamRoles(dept){
  /* собираем РЯДОВЫЕ роли отдела (не руководящие первой строки) для добивки */
  const team = pgDeptTeam(dept);
  const out = [];
  team.forEach((t, i) => {
    if (i === 0) return; /* первый — руководитель, не клонируем как рядового */
    const role = Array.isArray(t) ? t[1] : t.role;
    const fn = Array.isArray(t) ? t[4] : t.fn;
    if (role) out.push({ role, fn: fn || 'Команда' });
  });
  return out.length ? out : [{ role: 'Специалист', fn: 'Команда' }];
}
function pgDeptLabel(dept){ const d = (typeof DEPARTMENTS !== 'undefined') && DEPARTMENTS.find(x => x.id === dept); return d ? d.label : dept; }
function pgDeptLead(dept){
  const team = pgDeptTeam(dept);
  if (!team.length) return 'CEO · Кирилл';
  const t = team[0];
  return Array.isArray(t) ? (t[0] + ' · ' + t[1]) : (t.name + ' · ' + t.role);
}
function pgSkillsFor(role){
  const sw = (typeof ROLE_SWARM !== 'undefined') && ROLE_SWARM[role];
  const names = sw ? sw.a.map(a => a.replace(/^\S+\s/, '')) : ['Экспертиза','Коммуникация','Скорость','Качество'];
  return names.slice(0, 4);
}

/* --- генерация ЛЮДЕЙ ------------------------------------------------------- */
/* genPerson(dept, index) → стабильная личность рядового сотрудника штата.       */
function genPerson(dept, index){
  const key = 'gp:' + dept + ':h:' + index;
  const reg = (window.__PEOPLEGEN = window.__PEOPLEGEN || {});
  if (reg[key]) return reg[key];
  const h = pgHash(key);
  const female = (h & 1) === 1;
  const first = female ? PG_FEMALE_FIRST[(h >>> 1) % PG_FEMALE_FIRST.length]
                       : PG_MALE_FIRST[(h >>> 1) % PG_MALE_FIRST.length];
  const sur = PG_SURNAME[(h >>> 6) % PG_SURNAME.length][female ? 1 : 0];
  const roles = pgTeamRoles(dept);
  const rr = roles[(h >>> 11) % roles.length];
  const lvl = 2 + (h % 3); /* 2..4 — рядовой состав: джуниор..сеньор */
  const skills = pgSkillsFor(rr.role).map((s, i) => ({ name: s, level: 6 + ((h >> (i * 3)) % 4) }));
  const now = PG_NOW_HUMAN[(h >>> 3) % PG_NOW_HUMAN.length];
  const year = 2019 + (h % 6);
  const obj = {
    kind: 'h', gen: true, dept, index: +index, key,
    name: first, surname: sur, full: first + ' ' + sur,
    role: rr.role, fn: rr.fn, grade: (typeof RPG_LVL_LBL !== 'undefined' ? RPG_LVL_LBL[lvl] : 'Специалист'),
    lvl, skills, now,
    lead: pgDeptLead(dept),
    hired: String(1 + (h >> 8) % 12).padStart(2, '0') + '.' + year,
    rating: +(4.3 + (h % 6) / 10).toFixed(1),
  };
  return (reg[key] = obj);
}

/* --- генерация ЦИФРОВЫХ ---------------------------------------------------- */
/* genWorker(dept, index) → стабильный рядовой цифровой сотрудник штата.         */
function genWorker(dept, index){
  const key = 'gp:' + dept + ':d:' + index;
  const reg = (window.__PEOPLEGEN = window.__PEOPLEGEN || {});
  if (reg[key]) return reg[key];
  const h = pgHash(key);
  const first = PG_DIGIT_FIRST[(h >>> 1) % PG_DIGIT_FIRST.length];
  const sur = PG_DIGIT_SURNAME[(h >>> 6) % PG_DIGIT_SURNAME.length];
  const roles = pgTeamRoles(dept);
  const rr = roles[(h >>> 11) % roles.length];
  const title = 'Цифровой · ' + rr.role; // сохраняем регистр роли (QA-инженер, Eng Manager)
  const skills = pgSkillsFor(rr.role).map((s, i) => ({ name: s, level: 3 + ((h >> (i * 2)) % 3) }));
  const now = PG_NOW_DIGIT[(h >>> 3) % PG_NOW_DIGIT.length];
  const model = ['haiku', 'sonnet', 'sonnet', 'opus'][h % 4];
  const lead = pgDeptLead(dept);
  const obj = {
    kind: 'd', gen: true, dept, index: +index, key,
    id: 'gw-' + dept + '-' + index,
    name: first + ' ' + sur, first, surname: sur,
    title, fn: rr.fn, role: rr.role,
    emoji: PG_DIGIT_EMOJI[(h >>> 4) % PG_DIGIT_EMOJI.length],
    model, lead, now,
    skills,
    /* мини-должностная инструкция рядового цифрового штата */
    ji: {
      mission: 'Снимать с команды «' + pgDeptLabel(dept) + '» рутину по зоне «' + rr.fn + '»: каждый результат уходит человеку черновиком, не в прод.',
      duties: pgSkillsFor(rr.role).slice(0, 3),
      limits: ['Не принимает необратимых решений без руководителя', 'Не выходит за периметр данных отдела «' + pgDeptLabel(dept) + '»', 'Каждый результат — черновик человеку'],
      kpi: [['Задач в неделю', String(80 + (h % 120))], ['Принято без правок', (55 + (h % 35)) + '%']],
      esc: 'Нестандартная ситуация → ' + lead,
    },
    status: 'active',
  };
  return (reg[key] = obj);
}

/* профиль по роуту: идемпотентно восстанавливает личность из реестра/генератора */
function genPersonByRoute(dept, index){ return genPerson(dept, +index); }
function genWorkerByRoute(dept, index){ return genWorker(dept, +index); }
