# 3. Архитектура безопасности, изоляция, портал, API и дорожная карта

## 3.1. Архитектура безопасности и управления доступом (Security & Governance Architecture)

### 3.1.1. Управление идентификацией и доступом (IAM)

Система идентификации и управления доступом (IAM) платформы «Авандок.Среда» построена на базе **Keycloak** — enterprise-решения для управления идентификацией и доступом с открытым исходным кодом. Аутентификация пользователей и сервисов реализована через протокол **OpenID Connect (OIDC)** с обязательным применением **PKCE (Proof Key for Code Exchange)** для всех публичных клиентов, что исключает атаки типа authorization code interception.

Keycloak выступает в роли централизованного Identity Provider (IdP), обеспечивая:
- Федерацию идентификации через SAML 2.0 и OIDC для интеграции с корпоративными Active Directory / LDAP;
- Многофакторную аутентификацию (MFA) через TOTP, WebAuthn (FIDO2) и SMS-коды;
- Управление сессиями с принудительным истечением токенов access/refresh и возможностью отзыва сессий в реальном времени;
- Брокеринг социальных идентификаций (Google Workspace, Yandex ID, VK ID) для B2C-сценариев.

Все токены выпускаются в формате JWT с подписью RS256, содержат claims для ролей, организации и уровня допуска, и валидируются на каждом микросервисе через распределённый JWKS endpoint.

### 3.1.2. Модели контроля доступа: RBAC + ABAC

Платформа реализует гибридную модель авторизации, сочетающую **RBAC (Role-Based Access Control)** и **ABAC (Attribute-Based Access Control)**. Политики авторизации централизованно управляются через **OPA (Open Policy Agent)** и **Cerbos**.

**RBAC-слой** определяет статические роли:
- `org:admin` — полный доступ к ресурсам организации;
- `org:manager` — управление агентами, задачами и биллингом;
- `org:member` — создание задач и просмотр назначенных агентов;
- `agent:executor` — выполнение задач в рамках делегированных полномочий;
- `agent:readonly` — доступ только на чтение к профилю и истории.

**ABAC-слой** дополняет RBAC динамическими атрибутами:
- Временные ограничения (time-of-day, task-duration);
- Географические ограничения (регион развёртывания, IP-диапазон);
- Контекст задачи (чувствительность данных, классификация по 152-ФЗ);
- Состояние субъекта (JIT-доступ, активность kill-switch).

Политики OPA написаны на языке Rego и развёртываются как sidecar-контейнеры в каждом поде Kubernetes. Пример политики ABAC для JIT-доступа:

```rego
package avandok.jit_access

import future.keywords.if
import future.keywords.in

default allow := false

allow if {
    input.user.jit_enabled
    input.user.jit_task_id == input.task.id
    input.task.status == "active"
    time.now_ns() < input.user.jit_expires_at
}
```

### 3.1.3. Идентификация рабочих нагрузок (SPIFFE/SPIRE)

Для аутентификации сервис-то-сервис (mTLS) и идентификации агентов внутри кластера применяется инфраструктура **SPIFFE/SPIRE**:
- **SPIRE Server** выступает в роли корня доверия и выпускает SVID (SPIFFE Verifiable Identity Document) в формате X.509;
- **SPIRE Agent** развёртывается на каждом worker-узле как DaemonSet и осуществляет attestation рабочих нагрузок через Kubernetes, AWS IAM или Unix-сокеты;
- Каждый под получает уникальный SPIFFE ID вида `spiffe://avandok.sreda/ns/{namespace}/sa/{service-account}/pod/{pod-name}`;
- Взаимодействие между микросервисами осуществляется исключительно через mTLS с валидацией SPIFFE ID на стороне принимающего сервиса.

### 3.1.4. Управление секретами

Управление конфиденциальными данными (API-ключи LLM-провайдеров, учётные данные БД, сертификаты) реализовано через **OpenBao** (форк HashiCorp Vault, лицензия MPL 2.0) с криптографическим backend на **AES-256-GCM**:
- Все секреты хранятся в Vault в виде versioned key-value (KV v2);
- Динамические секреты (PostgreSQL, AWS) создаются с TTL и автоматически отзываются;
- Корневой ключ (unseal key) разделён через Shamir's Secret Sharing (threshold 3-of-5);
- Интеграция с Kubernetes через Vault Agent Injector — секреты монтируются в поды как файлы в памяти (tmpfs), исключая их попадание на persistent storage.

### 3.1.5. PEP и JIT-доступ

Каждое действие агента проходит через **PEP (Policy Enforcement Point)** — прокси-шлюз на базе Envoy с фильтром OPA. PEP проверяет:
1. Валидность JWT-токена и mTLS-сертификата;
2. Соответствие RBAC/ABAC-политикам для конкретного действия;
3. Актуальность JIT-доступа (Just-In-Time).

**JIT-доступ** предоставляется строго по принципу least privilege: агент получает ровно те разрешения, которые необходимы для выполнения конкретной задачи, и только на время её выполнения. По завершении задачи или по команде kill-switch разрешения мгновенно отзываются.

### 3.1.6. Kill-switch и защита от зацикливания

**Kill-switch** — механизм экстренного отзыва доступа. Реализован как синхронный HTTP-вызов с кодом ответа **402 Payment Required** (перегруженное значение — «доступ отозван»), который мгновительно прерывает выполнение задачи и инвалидирует все активные токены агента. Отзыв распространяется через Redis Pub/Sub на все PEP-ноды в течение <50 мс.

**Runaway detection** — защита от бесконечных циклов агентов. Реализована через circuit breaker на базе Prometheus + Alertmanager:
- Мониторинг метрик: количество итераций агента, потребление токенов LLM, длительность задачи;
- При превышении пороговых значений (например, >100 итераций или >10K токенов без прогресса) срабатывает circuit breaker;
- Агент принудительно останавливается, задача переводится в статус `suspended`, уведомление отправляется владельцу.

### 3.1.7. Аудит и compliance

Все события безопасности (аутентификация, авторизация, действия агентов, изменения политик) записываются в per-org таблицу `audit_log` с неизменяемым хешем (SHA-256) для обеспечения целостности цепочки событий. Логи экспортируются в SIEM-стек:
- **Wazuh** — для обнаружения вторжений и корреляции событий безопасности;
- **Grafana Loki / ELK** — для долгосрочного хранения и анализа логов.

Соответствие регуляторным требованиям:
- **152-ФЗ (РФ)** — шифрование персональных данных, хранение на территории РФ, обезличивание;
- **GDPR (ЕС)** — право на забвение, data portability, обработка на основании согласия;
- **Air-gapped deployment** — поддержка полностью изолированных инсталляций для оборонных, финансовых и госсекторов без внешних зависимостей.

---

## 3.2. Песочница и изоляция (Sandbox & Isolation)

Платформа реализует многоуровневую модель изоляции агентов в зависимости от класса чувствительности выполняемых задач и требований к безопасности. Каждый уровень обеспечивает принципиально разные гарантии изоляции с нарастающей стоимостью холодного старта.

### 3.2.1. Уровень 1: Изоляция процессов (gVisor)

**Применение:** агенты категории **Talent** — персональные ассистенты, работающие с данными одного пользователя.

**Технология:** **gVisor** — userspace-ядро ОС, реализующее системные вызовы приложения в изолированном пространстве пользователя (Sentry), минимизируя поверхность атаки на хостовое ядро Linux.

**Характеристики:**
- Холодный старт: ~300–500 мс;
- Совместимость: OCI-контейнеры без модификации;
- Оверхед: 10–20% на CPU-bound задачи, до 50% на syscall-intensive;
- Сетевая изоляция: отдельный сетевой стек в userspace, Netstack на Go.

Агенты Talent развёртываются в namespace пользователя с ограниченными resource quotas и запускаются через RuntimeClass `gvisor` в Kubernetes.

### 3.2.2. Уровень 2: Изоляция контейнеров (Kata Containers)

**Применение:** агенты категории **Inside** — shared-агенты, работающие с данными команды или отдела.

**Технология:** **Kata Containers** — лёгкие виртуальные машины на базе QEMU или Cloud Hypervisor, каждая из которых запускает один OCI-контейнер в изолированном гостевом ядре.

**Характеристики:**
- Холодный старт: ~1–2 с;
- Аппаратная виртуализация: полная изоляция ядра, memory, I/O;
- Совместимость: прозрачная для Kubernetes через CRI (containerd + kata-runtime);
- Поддержка virtio-fs для эффективного shared storage.

Kata Containers обеспечивают границу изоляции между мульти-тенантными агентами внутри одного кластера, предотвращая escape-уязвимости контейнеров.

### 3.2.3. Уровень 3: Изоляция микро-ВМ (Firecracker)

**Применение:** агенты категории **Forge** — проектные агенты, выполняющие произвольный код, CI/CD пайплайны и работу с критичными репозиториями.

**Технология:** **AWS Firecracker** — VMM (Virtual Machine Monitor) на базе KVM, специально разработанный для serverless-рабочих нагрузок.

**Характеристики:**
- Холодный старт: **<125 мс** (целевой показатель);
- Потребление памяти: <5 МБ на ВМ (microVM);
- Плотность размещения: >1000 microVM на одном физическом сервере;
- Безопасность: минимальный device model, отсутствие эмуляции legacy устройств, seccomp-фильтры на всех API.

Firecracker microVM запускаются через оркестратор на базе Nomad или самостоятельный scheduler, интегрированный с Kubernetes через Virtual Kubelet.

### 3.2.4. Сетевые политики и фильтрация

На уровне кластера применяются **Kubernetes NetworkPolicy** с namespace-level сегментацией:
- Каждый tenant (организация) изолирован в dedicated namespace;
- Default-deny политика: весь межподовый трафик запрещён по умолчанию;
- Явное разрешение только между сервисами в рамках одного namespace или через ingress-контроллер.

**Egress-фильтрация:**
- Для задач с чувствительными данными — полное отсутствие исходящего интернета (`egress: []`);
- Для задач, требующих внешних API — обязательный прокси с фиксацией российского IP-адреса (**proxychains + резидентные прокси**) для compliance с требованиями Роскомнадзора;
- DNS-запросы логируются и фильтруются через CoreDNS с плагином `rewrite` и `blocklist`.

### 3.2.5. Резидентность данных

Платформа поддерживает **per-region deployment** с гарантией, что данные заказчика никогда не покидают географию, указанную в SLA:
- **Россия:** Yandex Cloud / Selectel, хранение в зонах ru-central1, ru-north2;
- **Европа:** Hetzner, OVHcloud, зоны eu-west, eu-central;
- **Air-gapped:** on-premise инсталляция без внешних зависимостей.

Репликация между регионами отключена по умолчанию; включение требует явного согласия заказчика и оформления через DPA (Data Processing Addendum).

---

## 3.3. Портал и каналы взаимодействия (Portal & Channels)

### 3.3.1. Веб-портал

Фронтенд платформы реализован на **React 18 + Next.js 14 (App Router)** с серверным рендерингом (SSR) для обеспечения SEO-оптимизации публичных страниц (лендинг, marketplace, документация).

**Архитектурные решения:**
- Server Components для статических и редко меняющихся данных (каталог агентов, тарифы);
- Client Components для интерактивных UI (чат с агентом, real-time дашборды);
- State management: Zustand для клиентского состояния, React Query (TanStack Query) для server state;
- Стилизация: Tailwind CSS + Radix UI для доступных компонентов;
- Интернационализация: next-intl, поддержка русского и английского языков.

### 3.3.2. Маркетплейс агентов

Marketplace — централизованный каталог агентов с функциональностью:
- **Поиск:** полнотекстовый поиск через Elasticsearch/Meilisearch с поддержкой фильтров по категории, навыкам, рейтингу, цене;
- **Фильтры:** теги (юриспруденция, разработка, аналитика), уровень изоляции, поддерживаемые LLM;
- **Рейтинги:** агрегированный рейтинг на основе NPS, скорости ответа, точности выполнения задач;
- **Версионирование:** каждый агент имеет semver-версию, changelog и rollback-возможность.

### 3.3.3. Биллинг и подписки

Биллинговая подсистема поддерживает гибридную модель оплаты:
- **Россия:** интеграция с **YooKassa** (ЮKassa) — поддержка банковских карт, СБП, ЮMoney, оплата по счёту для юрлиц;
- **Глобальный рынок:** интеграция со **Stripe** — карты, Apple Pay, Google Pay, SEPA;
- **Модели подписок:**
  - Free tier: 1 агент, 50 сообщений/мес;
  - Pro: до 10 агентов, неограниченные сообщения, приоритетная очередь;
  - Enterprise: неограниченные агенты, air-gapped опция, dedicated support, custom SLA.

**Usage metering:** каждое действие агента (LLM-вызов, токен, sandbox-секунда) учитывается через Kafka → ClickHouse с детализацией до секунды. Ежемесячный отчёт формируется автоматически и доступен в личном кабинете.

### 3.3.4. Каналы коммуникации

- **Real-time чат:** **Socket.IO** с fallback на long-polling, Redis Adapter для горизонтального масштабирования, комнаты (rooms) изолированы по org_id;
- **Telegram-бот:** webhook-интеграция через Bot API, поддержка inline-кнопок, файловых вложений до 20 МБ;
- **Slack:** Incoming/Outgoing Webhooks, Slash Commands, Block Kit UI для rich-интерфейсов;
- **Email:** SMTP/IMAP через Mailgun / Яндекс 360 для уведомлений, отчётов и двусторонней интеграции (агент может читать и отправлять письма);
- **IDE-интеграция:** расширение для **VS Code** на базе Language Server Protocol, inline-чат с агентом, автодополнение кода через Cowork UI; встроенный редактор **Monaco Editor** (ядро VS Code) для веб-интерфейса Cowork.

---

## 3.4. Спецификация API (ключевые эндпоинты)

### 3.4.1. Принципы проектирования REST API

API платформы следует принципам REST с расширениями для real-time взаимодействия:
- Версионирование через URL-префикс (`/api/v1/`);
- Формат данных: JSON, кодировка UTF-8;
- HTTP-методы семантичны: GET (чтение), POST (создание), PUT/PATCH (обновление), DELETE (удаление);
- Пагинация: cursor-based для больших списков, offset-based для статических каталогов;
- Ошибки: RFC 7807 (Problem Details), единая структура `{ type, title, status, detail, instance }`.

### 3.4.2. Аутентификация

- **Пользовательские запросы:** Bearer-токен в заголовке `Authorization: Bearer <jwt>`;
- **Agent-to-agent коммуникация:** взаимная TLS (mTLS) с валидацией SPIFFE ID + Bearer-токен для авторизации;
- **Rate limiting:** per-user и per-org лимиты через Envoy Rate Limit Service (RLS) с backend на Redis.

### 3.4.3. Ключевые эндпоинты

#### Найм агента

```http
POST /api/v1/agents/hire
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "agent_template_id": "talent-legal-v2",
  "organization_id": "org_7f8a9b2c",
  "configuration": {
    "name": "Юридический ассистент Альфа",
    "llm_provider": "yandexgpt",
    "llm_model": "yandexgpt-lite",
    "isolation_level": 1,
    "max_tokens_per_task": 50000
  },
  "billing_plan": "pro"
}
```

```http
201 Created
Location: /api/v1/agents/agt_3d4e5f6a

{
  "id": "agt_3d4e5f6a",
  "status": "provisioning",
  "endpoint": "https://agents.avandok.sreda/ns/org-7f8a/agt-3d4e5f6a",
  "provisioned_at": "2026-06-10T18:30:00Z",
  "kill_switch_url": "https://api.avandok.sreda/api/v1/agents/agt_3d4e5f6a/kill"
}
```

#### Профиль агента

```http
GET /api/v1/agents/agt_3d4e5f6a/profile
Authorization: Bearer <jwt>
```

```http
200 OK

{
  "id": "agt_3d4e5f6a",
  "name": "Юридический ассистент Альфа",
  "type": "talent",
  "isolation_level": 1,
  "status": "active",
  "metrics": {
    "tasks_completed": 142,
    "avg_response_time_ms": 890,
    "tokens_consumed": 2840000
  },
  "created_at": "2026-06-10T18:30:00Z",
  "updated_at": "2026-06-10T21:00:00Z"
}
```

#### Создание задачи

```http
POST /api/v1/tasks
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "agent_id": "agt_3d4e5f6a",
  "title": "Проверка договора аренды",
  "description": "Проанализировать договор аренды на соответствие 152-ФЗ и выявить рисковые пункты",
  "priority": "high",
  "context": {
    "document_url": "s3://org-7f8a/docs/dogovor_arendy.pdf",
    "classification": "confidential"
  },
  "jit_permissions": ["read:s3:org-7f8a/docs/*", "write:audit_log"]
}
```

```http
201 Created
Location: /api/v1/tasks/tsk_9a8b7c6d

{
  "id": "tsk_9a8b7c6d",
  "status": "queued",
  "agent_id": "agt_3d4e5f6a",
  "estimated_duration_sec": 120,
  "created_at": "2026-06-10T21:05:00Z"
}
```

#### Статус задачи

```http
GET /api/v1/tasks/tsk_9a8b7c6d/status
Authorization: Bearer <jwt>
```

```http
200 OK

{
  "id": "tsk_9a8b7c6d",
  "status": "running",
  "progress_percent": 45,
  "current_step": "clause_analysis",
  "agent_id": "agt_3d4e5f6a",
  "started_at": "2026-06-10T21:05:02Z",
  "estimated_completion": "2026-06-10T21:07:15Z"
}
```

#### Создание проекта Forge

```http
POST /api/v1/projects
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "name": "Миграция на микросервисы",
  "description": "Проект по декомпозиции монолита на Go-микросервисы",
  "isolation_level": 3,
  "repository_url": "https://github.com/org/monolith",
  "agents": ["forge-architect-v1", "forge-devops-v2"],
  "resource_limits": {
    "max_agents": 5,
    "compute_hours_monthly": 500
  }
}
```

```http
201 Created
Location: /api/v1/projects/prj_1b2c3d4e

{
  "id": "prj_1b2c3d4e",
  "name": "Миграция на микросервисы",
  "status": "initializing",
  "firecracker_vms": [
    {
      "vm_id": "fc-vm-7a8b",
      "agent_id": "forge-architect-v1",
      "status": "booting",
      "boot_time_ms": 98
    }
  ],
  "created_at": "2026-06-10T21:10:00Z"
}
```

#### Company Pulse

```http
GET /api/v1/pulse?org_id=org_7f8a9b2c&period=24h
Authorization: Bearer <jwt>
```

```http
200 OK

{
  "organization_id": "org_7f8a9b2c",
  "period": "24h",
  "metrics": {
    "active_agents": 12,
    "tasks_completed": 89,
    "tasks_failed": 3,
    "avg_task_duration_sec": 145,
    "tokens_consumed": 1840000,
    "cost_usd": 47.50
  },
  "top_agents": [
    {"agent_id": "agt_3d4e5f6a", "tasks": 42, "rating": 4.8}
  ],
  "alerts": [
    {"type": "kill_switch_triggered", "agent_id": "agt_x1y2z3", "timestamp": "2026-06-10T20:15:00Z"}
  ]
}
```

#### WebSocket: real-time события

```
GET /ws/v1/events
Authorization: Bearer <jwt>
```

Протокол: Socket.IO over WebSocket. События:
- `task:created`, `task:updated`, `task:completed`;
- `agent:status_changed`;
- `alert:kill_switch`;
- `pulse:metrics`.

```json
// Пример события
{
  "event": "task:updated",
  "timestamp": "2026-06-10T21:11:00Z",
  "data": {
    "task_id": "tsk_9a8b7c6d",
    "status": "running",
    "progress_percent": 60,
    "message": "Анализ раздела 4: обработка персональных данных"
  }
}
```

---

## 3.5. Дорожная карта и вехи (Roadmap & Milestones)

### Фаза 1: Фундамент (0–3 месяца)

Цель: запуск MVP с базовой функциональностью агентов и безопасности.

- **Agent Runtime:** ядро выполнения агентов с поддержкой цикла observation → thought → action, интеграция с LLM Gateway;
- **LLM Gateway:** унифицированный прокси для YandexGPT, GigaChat, OpenAI с rate limiting, fallback и cost tracking;
- **OpenBao:** развёртывание Vault-кластера для управления секретами, интеграция с Kubernetes;
- **Helm-чарты:** полный набор Helm-чартов для установки платформы в Kubernetes (RKE2 / managed K8s);
- **gVisor:** интеграция RuntimeClass для изоляции Talent-агентов, тестирование производительности.

Критерий завершения: возможность нанять агента, создать задачу и получить результат в изолированном sandbox.

### Фаза 2: Расширение (3–6 месяцев)

Цель: обогащение агентов навыками, RAG, UI и монетизация.

- **Skills / MCP:** система плагинов для агентов (Model Context Protocol), marketplace навыков;
- **RAG:** векторное хранилище (Qdrant / Milvus), ingestion pipeline для документов, гибридный поиск (dense + sparse);
- **Open-weight models:** поддержка self-hosted LLM (Llama 3, Mistral, Saiga) через vLLM / TGI для air-gapped сценариев;
- **Cowork UI:** веб-интерфейс совместной работы с агентами, Monaco editor, inline-чат, diff-просмотр;
- **Metering & Billing:** полноценная система учёта ресурсов, интеграция YooKassa и Stripe, тарифные планы.

Критерий завершения: публичный доступ к marketplace агентов, платные подписки, работающий Cowork UI.

### Фаза 3: Enterprise & Масштаб (6–12 месяцев)

Цель: enterprise-grade безопасность, масштабирование и compliance.

- **K8s Data Plane:** собственный CNI (Cilium) с eBPF для observability и безопасности, advanced scheduling (Karpenter);
- **Firecracker:** интеграция microVM для Forge-проектов, оркестрация через Nomad / Virtual Kubelet;
- **SPIFFE/SPIRE:** полное покрытие mTLS между всеми сервисами, workload identity для агентов;
- **SIEM:** интеграция Wazuh + Loki, корреляция событий безопасности, автоматические playbooks;
- **Air-gapped deployment:** полностью автономная инсталляция без внешних зависимостей, offline-обновления через air-gap bundle.

Критерий завершения: сертификация по 152-ФЗ, успешный пилот в air-gapped режиме для госсектора.

### Релиз 1.0: 10 июня 2026 года

Финальный релиз платформы «Авандок.Среда» версии 1.0 запланирован на **10 июня 2026 года**. Релиз включает:
- Все компоненты Фаз 1–3 в production-ready состоянии;
- SLA 99.9% для облачной версии, 99.95% для Enterprise Dedicated;
- Поддержка русского и английского языков;
- Полный комплект документации: API Reference, Deployment Guide, Security Whitepaper, Compliance Dossier.
