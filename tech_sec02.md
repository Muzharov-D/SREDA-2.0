# 2. Архитектура ядра и инфраструктурные компоненты

## 2.1. Agent Runtime (Framework Core)

### 2.1.1. Исполнительная среда агента

Agent Runtime представляет собой полноценную исполнительную среду, поддерживающую гибридную модель выполнения на базе Node.js (v20+) и Python (3.11+). Выбор runtime определяется декларативно в манифесте агента через поле `runtime: "node" | "python"`, что позволяет командам использовать привычный стек без компромиссов в производительности. Node-runtime оптимизирован для I/O-bound задач — интеграции с внешними API, обработка webhook, SSR-рендеринг. Python-runtime задействуется для compute-bound сценариев: ML-инференс, научные вычисления, обработка данных через pandas/polars.

Каждый агент упаковывается в изолированный контейнер (OCI-совместимый образ) с ограничениями по CPU (по умолчанию 1 vCPU, настраивается через `resources.cpu.limit`) и памяти (по умолчанию 512 MiB, `resources.memory.limit`). Оркестрация контейнеров выполняется через встроенный scheduler на базе Nomad или Kubernetes (режим `orchestrator.mode`). Запуск агента инициируется POST-запросом:

```
POST /v1/agents/{agent_id}/sessions
Body: {
  "context_id": "ctx_7f3a9b",
  "input_payload": { ... },
  "priority": "normal" | "high" | "critical",
  "ttl_seconds": 3600
}
```

### 2.1.2. Цикл рассуждения (Reasoning Loop)

Архитектура цикла рассуждения построена по четырёхфазной модели **Perceive → Plan → Act → Reflect**, реализованной в виде конечного автомата с явными состояниями.

**Perceive** — фаза восприятия. Runtime собирает входные сигналы: пользовательский prompt, события из event bus, изменения состояния связанных агентов, триггеры по расписанию (cron). Все сигналы нормализуются в единый формат `PerceptionEvent` (JSON Schema v7) и помещаются в приоритетную очередь (Redis Streams).

**Plan** — фаза планирования. На основе восприятия агент генерирует план действий через LLM-вызов с system-prompt, содержащим инструкции по декомпозиции задачи. План представляется как DAG (направленный ациклический граф) узлов `PlanNode`, где каждый узел содержит: `tool_call` (или `subagent_invocation`), `dependencies[]`, `expected_output_schema`, `timeout_ms`. План валидируется на отсутствие циклов и достижимость целевого состояния.

**Act** — фаза исполнения. Runtime последовательно или параллельно (в зависимости от DAG) выполняет узлы плана. Каждый tool-call проходит через MCP-протокол (Model Context Protocol), обеспечивающий строгую типизацию входных/выходных параметров. Пример MCP-вызова:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "github.create_pull_request",
    "arguments": {
      "repo": "avandok/core",
      "branch": "feature/auth-refactor",
      "title": "Рефакторинг модуля аутентификации"
    }
  },
  "id": 42
}
```

**Reflect** — фаза рефлексии. По завершении исполнения агент оценивает результат: соответствует ли `actual_output` ожидаемому `expected_output_schema`, были ли ошибки, требуется ли повторная итерация. Результат рефлексии записывается в память агента (эпизодическая память) и влияет на будущие планы.

### 2.1.3. Human-in-the-Loop (HITL)

Система реализует четырёхуровневую модель автономности, управляемую через поле `autonomy_level` в профиле агента:

- **L0 — Полная автономия**: Агент действует без уведомлений. Применяется для рутинных задач (форматирование кода, обновление зависимостей, генерация отчётов).
- **L1 — Уведомление человека**: Агент выполняет действие и отправляет уведомление в Slack/Teams/Email с кратким summary. Человек может откатить действие в течение 15 минут (`rollback_window_seconds`).
- **L2 — Одобрение человека**: Действие блокируется до явного approve через Dashboard или API `POST /v1/hitl/approvals/{approval_id}/approve`. Таймаут ожидания — 24 часа, после чего задача отменяется с кодом `HITL_TIMEOUT`.
- **L3 — Исполнение человеком**: Агент генерирует инструкцию и делегирует физическое исполнение человеку. Используется для критических операций: production deploy, удаление данных, финансовые транзакции.

Переход между уровнями динамический: runtime может повысить уровень при обнаружении аномалии (например, cost превышает порог `cost_alert_threshold_usd`).

### 2.1.4. Мультиагентная оркестрация

Оркестрация нескольких агентов реализована через DAG-based workflow engine. Workflow описывается декларативно в YAML:

```yaml
workflow:
  id: code_review_pipeline
  agents:
    - agent_id: linter_agent
      runtime: node
    - agent_id: security_scanner
      runtime: python
    - agent_id: reviewer_agent
      runtime: node
  edges:
    - from: linter_agent
      to: security_scanner
      condition: "linter_agent.output.severity != 'critical'"
    - from: security_scanner
      to: reviewer_agent
      pass_context: ["findings", "diff_summary"]
```

Передача контекста между агентами осуществляется через строго типизированный `ContextBag` — immutable-структуру, сериализуемую в JSON. Каждый агент получает только явно разрешённые поля (`pass_context`), что предотвращает утечку чувствительных данных.

### 2.1.5. Управление состоянием и event bus

Локальное состояние агента (текущая фаза цикла, partial results, checkpoint-и) хранится в SQLite (`~/.avandok/agents/{agent_id}/state.db`) для разработческого режима. В production-конфигурации мигрирует в PostgreSQL 15+ с таблицами:
- `agent_sessions` — метаданные сессий;
- `agent_checkpoints` — сериализованные состояния для восстановления после сбоя;
- `agent_event_log` — append-only лог всех событий (Event Sourcing).

Коммуникация между агентами и внешними системами осуществляется через event bus на базе Apache Kafka (production) или NATS (development). Топики именуются по схеме `agent.{agent_id}.events.{event_type}` и `workflow.{workflow_id}.state_changes`. Сообщения используют Avro-схему с регистрацией в Schema Registry.

---

## 2.2. LLM Gateway

### 2.2.1. Архитектура прокси-слоя

LLM Gateway функционирует как единая точка входа для всех LLM-вызовов в платформе, построенная на базе **LiteLLM** (Python-библиотека и standalone-proxy). LiteLLM абстрагирует различия между 100+ провайдерами, предоставляя унифицированный интерфейс OpenAI-compatible API (`/v1/chat/completions`, `/v1/embeddings`, `/v1/completions`). Внутренние сервисы платформы не обращаются к провайдерам напрямую — только через Gateway.

Конфигурация провайдеров задаётся в `config/litellm_config.yaml`:

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
      rpm: 100
      tpm: 200000
  - model_name: claude-sonnet-4
    litellm_params:
      model: anthropic/claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY
      rpm: 50
  - model_name: qwen-3.5-32b
    litellm_params:
      model: openrouter/qwen/qwen-3.5-32b
      api_key: os.environ/OPENROUTER_API_KEY
```

### 2.2.2. Интеграция с OpenRouter и локальными моделями

**OpenRouter** выступает резервным и расширяющим провайдером, предоставляя доступ к 200+ моделям (OpenAI, Anthropic, Google, Meta, Alibaba, DeepSeek и др.) через единый API-ключ и единую биллинговую модель. OpenRouter автоматически маршрутизирует запросы на наименее загруженные endpoint-ы, что снижает latency на 15–30% в пиковые часы.

**Локальные open-weight модели** развёртываются для сценариев с жёсткими требованиями к data privacy (финансовый сектор, госучреждения) и для cost-оптимизации рутинных задач. Поддерживаемые конфигурации:
- **Qwen 3.5/3.6** (32B, 72B, 110B параметров) — развёртывание через vLLM с tensor-parallelism (TP=4 для 72B на 4×A100);
- **DeepSeek-V3 / DeepSeek-R1** — развёртывание через SGLang для оптимизации throughput (до 4000 tok/sec на 8×H100).

Локальные endpoint-ы регистрируются в Gateway как `custom/openai-compatible` с явным указанием `base_url`:

```yaml
  - model_name: deepseek-r1-local
    litellm_params:
      model: openai/deepseek-reasoner
      api_base: http://vllm-cluster.internal:8000/v1
      api_key: dummy
```

### 2.2.3. Fallback chains и маршрутизация

Gateway реализует многоуровневые fallback chains. Если primary модель недоступна (HTTP 429, 5xx, таймаут >30s), запрос автоматически перенаправляется на secondary модель из сконфигурированной цепочки. Пример fallback-конфигурации:

```yaml
router_settings:
  fallback_strategy: "model_priority"
  fallback_chain:
    - gpt-4o
    - claude-sonnet-4
    - openrouter/gpt-4o
    - qwen-3.5-32b
```

**Per-task routing** выбирает наиболее дешёвую модель, способную выполнить задачу с требуемым качеством. Для каждого skill в реестре агента указан `min_model_tier` (базовый/стандартный/премиум). Router сопоставляет tier с прайс-листом моделей и выбирает оптимальную по соотношению cost/quality. Например, задача "summarize_email" (tier: базовый) маршрутизируется на Qwen 3.5 32B ($0.15/1M tok) вместо GPT-4o ($5.00/1M tok), экономия — 97%.

### 2.2.4. Prompt caching и трассировка

**Prompt caching** реализован на уровне Gateway через Redis-кластер. Повторяющиеся system-prompt и контекстные prefix-и кэшируются с TTL 1 час. Cache key формируется как SHA256 от нормализованного prompt. Попадание в кэш снижает cost на 30–60% для диалоговых сценариев и batch-обработки.

**Trace context** интегрируется с OpenTelemetry. Каждый inference call оборачивается в span с атрибутами:
- `llm.model` — использованная модель;
- `llm.provider` — провайдер;
- `llm.prompt_tokens`, `llm.completion_tokens` — токенометрия;
- `llm.latency_ms` — полное время ответа;
- `llm.cost_usd` — рассчитанная стоимость.

Spans экспортируются в Jaeger/Tempo и агрегируются для анализа bottleneck-ов.

### 2.2.5. Cost tracking

Биллинговая телеметрия агрегируется по трём измерениям:
- **Per task**: `GET /v1/billing/tasks/{task_id}/cost` возвращает детализацию по каждому LLM-вызову в рамках задачи;
- **Per agent**: накопительная статистика за период (`GET /v1/billing/agents/{agent_id}/usage?from=...&to=...`);
- **Per customer**: агрегация по tenant_id для enterprise-B2B сценариев с поддержкой лимитов (`budget_cap_usd`) и алертов при достижении 80% лимита.

---

## 2.3. Data Platform

### 2.3.1. Схема профиля агента

Профиль агента — центральная сущность Data Platform, хранимая в PostgreSQL и частично денормализованная в Qdrant для семантического поиска. Схема профиля включает пять доменов:

1. **Identity**: `agent_id` (UUIDv7), `name`, `version`, `runtime`, `owner_team`, `created_at`, `updated_at`. Версионирование через semver; миграция профиля между версиями — атомарная транзакция.

2. **Skills**: массив объектов `SkillEntry` с полями `skill_id`, `proficiency_level` (1–5, где 5 — эксперт), `certified_by` (human reviewer или auto-certification pipeline), `last_used_at`. Уровень влияет на routing: задачи с `required_proficiency >= 4` назначаются только сертифицированным агентам.

3. **Memory**: двухкомпонентная система. **Эпизодическая память** — хронологический журнал взаимодействий (таблица `episodic_memories`: `session_id`, `timestamp`, `event_type`, `content_vector`, `raw_content`). **Семантическая память** — обобщённые знания, извлечённые через периодический ETL (таблица `semantic_memories`: `concept`, `embedding`, `confidence_score`, `source_episodes[]`).

4. **Experience**: проектная история в формате `ProjectRecord` — `project_id`, `role`, `duration_hours`, `outcome` (success/partial/failure), `feedback_score` (от заказчика-человека или peer-агента), `artifacts_produced[]`.

5. **Cost history & KPIs**: накопительные метрики эффективности. `total_cost_usd`, `tasks_completed`, `acceptance_rate` (approved / total), `avg_time_to_completion_minutes`, `error_rate` (failed / total). KPIs пересчитываются ежечасно через материализованное представление `agent_kpi_snapshot`.

### 2.3.2. RAG-инфраструктура

Векторное хранилище реализовано на **Qdrant** (v1.9+), развёрнутом в режиме кластера (3+ node) для production. Коллекции именуются по доменам:
- `company_wiki` — внутренняя документация, Confluence-страницы, Notion;
- `code_repos` — индексированные кодовые базы (через `tree-sitter` для chunk-ирования по AST-границам функций/классов);
- `api_docs` — OpenAPI/Swagger спецификации, README-файлы;
- `agent_skills` — embedding-и skill-описаний для семантического поиска по capability.

Chunk-ирование документов выполняется с перекрытием (overlap 20%) и сохранением метаданных: `source_url`, `last_updated`, `author`, `doc_version`. Размер chunk — 512 токенов для текстов, 150 токенов для кода. Embedding-модель — `text-embedding-3-large` (OpenAI) или `bge-m3` (локальная альтернатива, 1024-мерные векторы).

Поиск реализован гибридно: dense retrieval (cosine similarity по embedding) + sparse retrieval (BM25 по ключевым словам) с reranking через cross-encoder `bge-reranker-v2-m3`. Топ-5 результатов подаются в контекст LLM как `retrieved_context`.

### 2.3.3. Skill Registry

Реестр навыков разделён на два уровня:

**Global Registry** — публичный каталог reusable skills, версионируемый через Git-репозиторий `avandok/skills-public`. Каждый skill включает: `skill.yaml` (манифест), `implementation/` (код runtime), `tests/` (pytest suite), `README.md` (документация). Skills публикуются после code review и автоматического тестирования в sandbox. Установка: `avandok skill install @avandok/github-pr-reviewer`.

**Local Registry** — приватный реестр компании, хранимый в корпоративном GitLab/GitHub. Содержит специфичные интеграции (внутренние API, корпоративные политики, специфические форматы данных). Local skills имеют приоритет при разрешении имён над Global (shadowing).

### 2.3.4. Персистентность памяти

**Краткосрочная память** (short-term) хранится в Redis Cluster (6+ node) с политикой eviction `allkeys-lru`. Содержит: текущий контекст диалога (последние 10 сообщений), partial results выполняющихся задач, временные checkpoint-и. TTL — 24 часа для сессий, 1 час для partial results.

**Долгосрочная память** (long-term) — комбинация PostgreSQL (структурированные данные) и Qdrant (векторные embedding-и). Эпизодические воспоминания архивируются в PostgreSQL с партиционированием по `created_at` (месячные партиции). Семантические концепты хранятся в Qdrant с HNSW-индексом (ef=128, m=16) для субсекундного поиска. Синхронизация между краткосрочной и долгосрочной памятью выполняется фоновым процессом `memory_consolidator`, запускаемым каждые 6 часов.

---

## 2.4. Dashboard & Analytics

### 2.4.1. BI-слой

Аналитическая подсистема построена на комбинации **Metabase** (self-hosted, OSS-версия) и **Apache Superset** (для продвинутых enterprise-клиентов с требованием кастомной визуализации). Metabase подключается к реплике PostgreSQL (read-only) через JDBC и предоставляет out-of-the-box дашборды с drill-down возможностями. Superset используется для сложных сценариев: корреляционный анализ, кастомные визуализации на D3.js, встроенная аналитика в iframe клиентских порталов.

Данные агрегируются в слой `analytics_mart` — набор материализованных представлений, обновляемых ежечасно через dbt (data build tool):
- `mart_tasks` — фактическая таблица задач с измерениями времени, агента, заказчика, статуса;
- `mart_agent_performance` — агрегаты по эффективности агентов;
- `mart_cost_allocation` — распределение затрат по проектам и tenant-ам.

### 2.4.2. Real-time метрики

Потоковая аналитика реализована на Apache Flink, потребляющем топик Kafka `agent.events` и вычисляющем окна (tumbling window 1 минута) по следующим метрикам:

- **Task completion rate** — количество успешно завершённых задач в минуту (`count_where(status='completed') / window_size`);
- **Acceptance rate** — доля задач, одобренных human reviewer-ом без правок (`approved / (approved + rejected + modified)`);
- **Cost per task** — средняя стоимость LLM-вызовов и compute на одну задачу (`sum(cost_usd) / count(tasks)`);
- **Agent utilization** — процент времени, когда агент находится в состоянии `executing` относительно общего uptime (`executing_time / total_time * 100`);
- **Time-to-completion (TTC)** — медианное время от создания задачи до финального статуса (`percentile_cont(0.5) within group (order by duration)`).

Метрики экспонируются в Prometheus и визуализируются в Grafana с алертами (PagerDuty/Opsgenie integration) при отклонении от SLA.

### 2.4.3. Предиктивная аналитика

ML-модели предиктивной аналитики обучаются на исторических данных из `analytics_mart` и развёртываются через MLflow:

- **Agent burnout prediction**: бинарный классификатор (XGBoost) предсказывает вероятность снижения качества работы агента (acceptance rate < 70%) в ближайшие 48 часов на основе паттернов: частота ошибок, рост latency, увеличение retry-rate. При вероятности > 0.7 система рекомендует "отпуск" агента (понижение нагрузки) или перекалибровку skill-ов.

- **Bottleneck detection in cross-functional flows**: анализ DAG workflow на предмет узлов с наибольшим `avg_wait_time` (время в очереди) и `max_processing_time`. Алгоритм PageRank адаптирован для взвешенного графа зависимостей агентов выявляет критические узлы, блокирующие throughput всего pipeline.

### 2.4.4. Custom KPI Builder

Enterprise-клиентам предоставляется конструктор кастомных KPI через визуальный интерфейс Superset или declarative YAML-конфигурацию:

```yaml
kpi:
  id: security_review_sla
  name: "SLA проверки безопасности"
  formula: "percentile_cont(0.95) within (security_scan_duration) < 300"
  dimensions: ["team", "project", "severity"]
  alert_threshold: 0.95
  notification_channel: "slack://#security-alerts"
```

KPI вычисляются материализованными представлениями (materialized views) с инкрементальным обновлением (REFRESH CONCURRENTLY в PostgreSQL). Клиенты получают доступ к данным через row-level security (RLS) на уровне PostgreSQL, гарантирующую изоляцию tenant-ов.

