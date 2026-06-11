# Авандок Среда 2.0 — больше, чем результат

Кликабельный прототип операционной среды компании на ИИ: 150 людей и 164 цифровых
сотрудника в одном штатном расписании, живой «Пульс компании», золотые профили,
передачи работы между отделами, governance и аудит.

Фронт: HTML + CSS + vanilla JS без сборки. Бэкенд: Express + SQLite (`server/`),
он же отдаёт статику. При первом старте БД наполняется демо-данными автоматически.

## Запуск

```bash
npm install
npm start          # http://localhost:3000
```

Маршруты:

| URL | Что открывается |
|---|---|
| http://localhost:3000 | внутренний контур «Среда» (`index.html`) |
| http://localhost:3000/inside | то же самое |
| http://localhost:3000/portal | внешний портал клиента (`portal.html`) |
| http://localhost:3000/office | офис (`office.html`) |

Полезное:

```bash
npm run seed                          # пересеять БД вручную
# или по HTTP (нужен заголовок X-API-Key):
curl -X POST http://localhost:3000/api/demo/reset -H "X-API-Key: sreda-prototype-key-2026"
```

## Структура

| Файл | Назначение |
|---|---|
| `index.html` | каркас: топбар, навигация, сцена, модалка задачи |
| `assets/styles.css` | дизайн-система (тёмный графит + изумруд) |
| `assets/mock.js` | все данные: отделы, люди, цифровой штат с должностными инструкциями |
| `assets/icons.js` | фирменные SVG-иконки + конвертер эмодзи → иконки |
| `assets/app.js` | все экраны и логика |
| `HANDOFF.md` | контекст для следующей рабочей сессии |

## Настройка git (один раз)

Репозиторий уже инициализирован, первый коммит сделан. Подключение к GitHub:

```bash
# 1. создайте пустой приватный репозиторий на github.com (без README)
# 2. привяжите и запушьте:
git remote add origin https://github.com/<ваш-аккаунт>/avandok-sreda.git
git push -u origin main
```

Дальше обычный цикл: `git add -A && git commit -m "feat: ..." && git push`.

## Деплой на Vercel (рекомендуется)

1. vercel.com → **Add New → Project** → импортируйте репозиторий `avandok-sreda`.
2. Framework Preset: **Other**. Build Command — пусто. Output Directory — `./`.
3. **Deploy**. Конфиг `vercel.json` уже в репозитории (кеш ассетов, clean URLs).

Каждый `git push` в `main` будет автоматически выкатывать новую версию.
Превью-ссылки на каждый PR — из коробки.

Альтернатива без GitHub — из консоли:

```bash
npm i -g vercel
vercel --prod
```

## Деплой на Render

1. render.com → **New → Blueprint** → подключите репозиторий.
2. Render прочитает `render.yaml` (web service: `npm install` → `node server/app.js`) — подтвердите.
3. **Apply**. После старта БД засеется автоматически; диск эфемерный, после
   редеплоя данные вернутся к демо-состоянию (это поведение прототипа, так и задумано).

## Что не попадает в репозиторий

Рабочие артефакты исключены через `.gitignore`: скриншоты-референсы,
`_backup/`, тяжёлый неиспользуемый `assets/hero-bg.png`, локальные настройки.
