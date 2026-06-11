# Техническая спецификация «Авандок.Среда»
## Раздел 1. Архитектурная платформа и топология развёртывания

---

### 1. Обзор архитектуры

Платформа «Авандок.Среда» построена по принципу модульной пятиблочной архитектуры с выделенным сквозным слоем управления (Governance). Каждый блок представляет собой автономную доменную область с чётко определёнными интерфейсами, контрактами API и границами ответственности. Такое разделение обеспечивает независимую эволюцию компонентов, горизонтальное масштабирование под нагрузкой и возможность поэтапного внедрения функциональности в соответствии с выбранным продуктовым планом.

**Пять функциональных блоков:**

1. **Framework** — оркестрационный ядро платформы. Отвечает за жизненный цикл AI-агентов: создание профилей, назначение задач, маршрутизацию вызовов к LLM, аккумуляцию навыков, управление состоянием диалогов и координацию мультиагентных команд. Framework реализован как распределённый сервис на базе Kubernetes, с разделением Control Plane (управление метаданными, политиками, расписаниями) и Data Plane (непосредственное выполнение задач агентами, инференс, обработка потоков).

2. **Data Platform** — унифицированный слой данных. Обеспечивает персистентное хранение профилей агентов, истории взаимодействий, векторных индексов навыков, метрик производительности и аудит-логов. Включает реляционное хранилище (PostgreSQL / SQLite), векторную базу (Qdrant), кэш-слой (Redis) и подсистему секретов (OpenBao). Data Platform является единым источником правды для всех остальных блоков.

3. **Dashboard** — аналитическая и административная консоль. Предоставляет визуализацию нейронной карты агентов, real-time пульс организации, KPI по кросс-функциональным потокам, инструменты управления доступом и политиками. Реализован как SPA-приложение с бэкендом на REST/gRPC, интегрированным с Prometheus и Grafana для метрик, Loki / ELK для логов.

4. **Portal** — точка входа для пользователей и агентов. Объединяет веб-интерфейс найма, каталог агентов, формы запросов на задачи и механизм аутентификации. Portal взаимодействует с Framework через асинхронную очередь задач и синхронные API для оперативных запросов.

5. **Channels** — коммуникационный шлюз. Интегрирует платформу с внешними каналами: корпоративная почта, мессенджеры, API-системы заказчика, webhook-эндпоинты. Channels отвечает за нормализацию входящих сообщений, маршрутизацию к Framework и доставку исходящих ответов.

**Сквозной слой Governance** охватывает все пять блоков и включает:
- **Identity & Access Management** на базе Keycloak (SSO, MFA, ролевая модель RBAC/ABAC);
- **Policy Engine** на базе OPA / Cerbos для динамической авторизации;
- **Workload Identity** через SPIFFE/SPIRE для взаимной аутентификации сервисов;
- **Security Monitoring** через Wazuh для обнаружения вторжений;
- **Audit & Compliance** — централизованный сбор аудит-логов с неизменяемым хранением.

**Маппинг на продуктовые фазы:**

| Фаза | Задействованные блоки | Режим развёртывания |
|------|----------------------|---------------------|
| **Inside** | Все 5 блоков | On-premise / SaaS, полная нервная система |
| **Talent** | Portal + Data Platform + Channels + Dashboard (customer-facing); Framework скрыт | Гибрид: Framework на стороне Sreda |
| **Forge** | Все 5 блоков в изолированной среде | Sandbox Sreda, customer видит только окно прогресса |

Архитектурная диаграмма компонентов представляет собой централизованную схему с Data Platform в ядре, Framework и Channels на периферии обработки, Portal и Dashboard как точки взаимодействия с пользователями, и Governance как обрамляющий слой безопасности и управления.

---

### 2. Продуктовая модульность по фазам

#### 2.1. Фаза Inside: полная нервная система организации

Фаза Inside предполагает развёртывание всех пяти архитектурных блоков в инфраструктуре заказчика — будь то on-premise дата-центр, приватное облако или SaaS-инстанс Sreda. Это режим максимальной интеграции, при котором платформа становится полноценной «нервной системой» организации.

**Техническая реализация:**

Control Plane развёртывается как набор stateless микросервисов в Kubernetes, управляемых через Helm-чарты. Data Plane включает пулы воркеров для выполнения задач агентов, изолированные неймспейсы для различных команд и выделенные ноды с GPU для LLM-инференса. Взаимодействие между Control Plane и Data Plane осуществляется через Kubernetes API и собственный scheduler Framework.

**Ключевые компоненты фазы Inside:**

- **Real-time Pulse** — потоковая обработка событий организации через Redis Streams и WebSocket-соединения с Dashboard. Каждое действие агента, каждое изменение статуса задачи и каждая метрика производительности попадает в пульс с задержкой < 100 мс.
- **Neural Map** — графовая визуализация связей между агентами, навыками и бизнес-процессами. Данные извлекаются из Qdrant (векторные представления навыков) и PostgreSQL (структурные связи), агрегируются в Dashboard и рендерятся через интерактивный force-directed graph.
- **Cross-functional Flows** — оркестрация процессов, затрагивающих несколько функциональных областей. Framework управляет маршрутизацией задач между агентами различной специализации, отслеживает SLA, обеспечивает эскалацию и компенсирующие транзакции при сбоях.

**Инфраструктурный стек:**
- Kubernetes (Control Plane + Data Plane)
- PostgreSQL (основное реляционное хранилище)
- Qdrant (векторный поиск по навыкам и профилям)
- Redis (кэш, pub/sub, streams)
- OpenBao (управление секретами и ключами API)
- Prometheus + Grafana (мониторинг и алертинг)
- Loki / ELK (централизованный сбор логов)
- Gitea (внутренний Git-репозиторий для артефактов агентов)
- ArgoCD (GitOps-деплой компонентов платформы)

#### 2.2. Фаза Talent: портал найма с управляемым доступом

Фаза Talent ориентирована на заказчиков, которым требуется доступ к каталогу AI-агентов без необходимости развёртывания полной платформы. В этой фазе заказчик получает customer-facing компоненты (Portal, Dashboard, Channels), тогда как Framework и основная Data Platform остаются на стороне Sreda и скрыты от конечного пользователя.

**Техническая реализация:**

Заказчик развёртывает у себя:
- **Portal** — белый лейбл с доменом и брендингом заказчика;
- **Dashboard** — read-only и управляемый доступ к метрикам агентов;
- **Channels** — интеграция с корпоративными коммуникациями заказчика;
- **Локальный кэш и реплика** — Redis и SQLite для офлайн-доступа к критичным данным.

Sreda предоставляет:
- **Framework-as-a-Service** — оркестрация агентов в мультиарендном режиме;
- **Data Platform (Sreda)** — хранение профилей агентов, истории найма, векторных индексов;
- **LLM Gateway** — единая точка доступа к моделям через OpenRouter / LiteLLM с биллингом и rate limiting.

**Механизм интеграции:**

Профили агентов хранятся в Sreda Data Platform (PostgreSQL + Qdrant) и экспонируются заказчику через защищённый REST API с аутентификацией по mTLS (SPIFFE/SPIRE) и авторизацией через OPA. Customer Dashboard выполняет KPI-запросы к Sreda API, получая агрегированные метрики без доступа к сырым данным других заказчиков. Мультиарендность изолируется на уровне неймспейсов Kubernetes, row-level security в PostgreSQL и политик Cerbos.

**Протоколы взаимодействия:**
- REST API для синхронных операций (получение профиля, запрос метрик);
- gRPC для высокопроизводительных потоков данных;
- WebSocket для real-time уведомлений о статусе найма;
- Message queue (Redis Streams / RabbitMQ) для асинхронных задач.

#### 2.3. Фаза Forge: изолированная песочница для проектной разработки

Фаза Forge предназначена для заказчиков, которым требуется выполнение проектов силами мультиагентных команд в полностью управляемой среде Sreda. В отличие от Inside, где платформа развёртывается у заказчика, и Talent, где заказчик видит каталог агентов, в Forge заказчик взаимодействует только через «окно прогресса проекта» — упрощённый интерфейс отслеживания статуса, результатов и артефактов.

**Техническая реализация:**

Все пять блоков развёртываются в изолированной sandbox-среде Sreda. Каждый проект заказчика получает выделенный namespace в Kubernetes с жёсткими ограничениями ресурсов (ResourceQuotas, LimitRanges, NetworkPolicies). Исполнение агентов изолируется на уровне контейнеров через gVisor или Firecracker microVMs, предотвращая побочный доступ к данным других проектов.

**Архитектура sandbox:**

- **Portal** — упрощённый интерфейс с единственным экраном: список проектов, статус выполнения, скачивание артефактов;
- **Framework** — полнофункциональный оркестратор, управляющий командами из 3–7 агентов, распределяющий задачи, разрешающий конфликты и мержирующий результаты;
- **Data Platform** — проектный инстанс PostgreSQL + Qdrant + Redis, удаляемый по завершении проекта (TTL-based cleanup);
- **Channels** — входящие запросы через API и webhook, исходящие — через email / API заказчика;
- **Dashboard** — read-only для заказчика, полный доступ для команды Sreda.

**Оркестрация мультиагентных команд:**

Framework в Forge-режиме активирует advanced scheduling: агенты назначаются на роли (architect, developer, reviewer, tester), взаимодействуют через shared state в Redis, проводят peer-review через внутренние gRPC-вызовы, а финальные артефакты (код, документация, конфигурации) коммитятся в Gitea и доставляются заказчику через Channels.

**Безопасность и изоляция:**
- Каждый проект — отдельный Kubernetes namespace;
- Контейнеры агентов — в gVisor sandbox (runsc) или Firecracker microVM;
- Сеть — изоляция через Cilium NetworkPolicies, запрет east-west трафика между проектами;
- Хранилище — отдельные PVC per проект, шифрование at-rest через OpenBao Transit;
- LLM-запросы — маршрутизация через LiteLLM с project-based rate limiting и аудитом.

---

### 3. Матрица взаимодействия компонентов

Ниже представлена матрица взаимодействия ключевых компонентов платформы с указанием протоколов, паттернов и назначения обмена данными.

| Источник → Приёмник | Протокол | Паттерн | Назначение |
|---------------------|----------|---------|------------|
| **Portal ↔ Framework** | REST + Message Queue | Асинхронный dispatch | Portal публикует задачи в очередь (Redis Streams / RabbitMQ); Framework подписывается и назначает агентов. Синхронный REST используется для оперативных запросов статуса. |
| **Framework ↔ Data Platform** | gRPC + SQL | Персистентность + поиск | Framework записывает обновления профилей агентов, аккумулирует навыки в PostgreSQL; выполняет векторный поиск по Qdrant через gRPC для подбора агентов под задачу. |
| **Framework ↔ LLM Gateway** | HTTP/REST (OpenAI-compatible) | Синхронный inference | Framework направляет запросы к LLM Gateway (OpenRouter / LiteLLM) с retry-логикой, circuit breaker и таймаутами. Gateway обеспечивает маршрутизацию между провайдерами, fallback и биллинг. |
| **Dashboard ↔ Data Platform** | REST + gRPC | KPI-запросы + потоки | Dashboard запрашивает агрегированные метрики через REST API; real-time потоки событий доставляются через gRPC streaming для пульса и нейронной карты. |
| **Channels ↔ Framework** | WebSocket + REST + MQ | Маршрутизация сообщений | Channels нормализует входящие сообщения из внешних систем и маршрутизирует их в Framework через очередь. Исходящие сообщения от агентов обратно проходят через Channels к конечным пунктам доставки. |
| **Framework ↔ Framework (multi-agent)** | gRPC (internal) | Peer-to-peer координация | Агенты внутри одной команды взаимодействуют через внутренний gRPC-сервис Framework, обмениваясь промежуточными результатами, запрашивая peer-review и синхронизируя shared state. |
| **Data Platform ↔ OpenBao** | HTTPS (Vault API) | Secrets management | Data Platform запрашивает у OpenBao ключи шифрования, credentials БД, API-ключи LLM-провайдеров. Ротация секретов — автоматическая, через dynamic secrets где возможно. |
| **All ↔ Keycloak** | OAuth 2.0 / OIDC | Аутентификация + авторизация | Все компоненты делегируют аутентификацию Keycloak. JWT-токены содержат claims для RBAC/ABAC. Keycloak интегрирован с корпоративными IdP заказчика через SAML / LDAP. |
| **All ↔ OPA / Cerbos** | HTTP / gRPC | Policy decision | Каждый авторизуемый запрос проходит через Policy Engine: OPA для Kubernetes admission control, Cerbos для application-level authorization. Decisions логируются для аудита. |
| **All ↔ SPIFFE/SPIRE** | mTLS (X.509 SVID) | Workload identity | Взаимная аутентификация сервисов через автоматически выданные SVID. Отказ от статических credentials, zero-trust на уровне сервис-му-сервис. |
| **Monitoring Stack** | Prometheus scrape / OTLP | Observability | Prometheus собирает метрики со всех компонентов; Loki / ELK — логи; Jaeger / Tempo — distributed tracing. Grafana — единая точка визуализации. |

**Детализация ключевых потоков:**

**Task Dispatch (Portal → Framework):**
Пользователь создаёт задачу в Portal. Запрос валидируется, обогащается контекстом (текущий пользователь, проект, приоритет) и публикуется в Redis Stream с ID корреляции. Framework-воркер из пула Data Plane выбирает задачу, выполняет matching агентов через Qdrant (векторный поиск по требуемым навыкам), назначает исполнителя и обновляет статус в PostgreSQL. Portal получает уведомление через WebSocket или Server-Sent Events.

**Profile Update (Framework → Data Platform):**
По завершении задачи Framework анализирует приобретённые агентом навыки, генерирует embedding через LLM Gateway, записывает вектор в Qdrant и обновляет реляционный профиль в PostgreSQL. Операция выполняется в транзакции: сначала PostgreSQL, затем Qdrant, с compensating rollback при сбое второго шага (SAGA-паттерн).

**Inference Request (Framework → LLM Gateway):**
Framework формирует prompt с контекстом из Redis (история диалога, retrieved skills) и отправляет HTTP-запрос к LiteLLM Gateway. Gateway применяет routing rules (стоимость, latency, качество), выбирает провайдера (OpenRouter, прямой Azure OpenAI, локальная модель), применяет rate limits и возвращает ответ с метаданными (model used, tokens consumed, latency). Framework кэширует часто запрашиваемые результаты в Redis.

**KPI Query (Dashboard → Data Platform):**
Dashboard выполняет parameterized SQL-запросы к read-replica PostgreSQL для агрегированных метрик (количество задач, среднее время выполнения, utilization агентов). Для real-time показателей используется gRPC streaming из Redis Streams. Доступ к данным фильтруется через Cerbos на основе JWT-claims пользователя (tenant isolation, role-based filtering).

**Message Routing (Channels ↔ Framework):**
Входящее сообщение из email / мессенджера попадает в Channels, где нормализуется в canonical message format (JSON Schema). Channels определяет intent и маршрутизует либо в Framework (если требуется действие агента), либо в Portal (если уведомление пользователю). Framework возвращает ответ, который Channels форматирует под канал доставки и отправляет.

---

### 4. Топология развёртывания

Платформа поддерживает три основных режима развёртывания: on-premise в инфраструктуре заказчика, SaaS в облаке Sreda, и гибридные схемы для фаз Talent и Forge. Ниже детализирована инфраструктурная реализация каждого режима.

#### 4.1. On-premise развёртывание

Рекомендуемая топология для фазы Inside в enterprise-средах с требованиями по суверенитету данных и compliance.

**Базовая топология:**

- **Control Plane**: 3 master-ноды Kubernetes (etcd, API server, scheduler, controller manager). Рекомендуется отказоустойчивая конфигурация с anti-affinity rules.
- **Data Plane**: 3+ worker-ноды для сервисов платформы, 2+ ноды с GPU (NVIDIA A100 / H100 или аналоги) для LLM-инференса, выделенные ноды для stateful-сервисов (PostgreSQL, Qdrant, Redis).
- **Storage**: Ceph RBD / NFS / enterprise SAN для PVC, отдельный SSD-tier для БД и векторного индекса.
- **Network**: Calico / Cilium CNI с NetworkPolicies для сегментации трафика, MetalLB / NGINX Ingress для входящего трафика.

**Helm-чарты:**

Поставка платформы осуществляется в виде набора Helm-чартов, развёртываемых через ArgoCD в GitOps-режиме:
- `sreda-infra` — CRD, operators, CNI plugins, storage classes;
- `sreda-data` — PostgreSQL (CloudNativePG operator), Qdrant, Redis (Redis Cluster operator), OpenBao;
- `sreda-core` — Framework, Portal, Dashboard, Channels;
- `sreda-observability` — Prometheus, Grafana, Loki, Alertmanager;
- `sreda-security` — Keycloak, OPA, SPIRE, Wazuh agents;
- `sreda-llm` — LiteLLM Gateway, vLLM / TGI для локальных моделей, GPU operator.

Каждый чарт параметризован через values.yaml с учётом окружения (dev / staging / prod). ArgoCD ApplicationSet обеспечивает мультикластерное развёртывание и автоматическую синхронизацию состояния с Git-репозиторием (Gitea).

**Air-gapped опция:**

Для заказчиков с физически изолированными сетями предусмотрен air-gapped режим:
- Все контейнерные образы предварительно загружаются в локальный registry (Harbor / Docker Registry);
- Helm-чарты и Git-репозитории поставляются как tar-архивы;
- LLM-модели кэшируются в локальное object storage (MinIO) или NFS-share;
- Обновления платформы доставляются через физические носители или защищённый канал передачи данных;
- Telemetry и логи накапливаются локально, периодически экспортируются в Sreda по согласованию (или не экспортируются вовсе).

#### 4.2. SaaS развёртывание

Мультиарендная инфраструктура Sreda, размещённая в Yandex Cloud.

**Инфраструктурный стек:**

- **Compute**: Yandex Managed Kubernetes для сервисных нод, Yandex Cloud DataSphere для GPU-пулов (инференс LLM, обучение embeddings);
- **Storage**: Yandex Managed PostgreSQL, self-managed Qdrant в Kubernetes, Yandex Managed Redis;
- **Network**: Yandex ALB (Application Load Balancer) для L7-роутинга, Yandex Network Load Balancer для TCP-трафика;
- **Security**: Yandex Lockbox для базовых секретов, OpenBao для application secrets, Yandex Certificate Manager для TLS;
- **Observability**: Yandex Monitoring + самостоятельный стек Prometheus/Grafana/Loki для tenant-specific метрик.

**Изоляция арендаторов:**

- **Namespace-level**: каждый заказчик — выделенный namespace в shared Kubernetes cluster;
- **Network-level**: Cilium NetworkPolicies запрещают межарендаторский трафик;
- **Data-level**: PostgreSQL row-level security (RLS), отдельные коллекции в Qdrant per tenant, Redis key prefixes с ACL;
- **Compute-level**: ResourceQuotas и LimitRanges предотвращают noisy neighbor effect;
- **Sandbox-level**: для Forge-проектов — gVisor / Firecracker изоляция контейнеров.

**GPU-пулы:**

SaaS-инфраструктура использует Yandex Cloud DataSphere для эластичного масштабирования GPU-ресурсов. LiteLLM Gateway маршрутизирует запросы между:
- DataSphere-инстансами (облачные GPU, pay-per-use);
- Shared on-prem GPU заказчика (через VPN / dedicated interconnect);
- Локальными CPU-only fallback-моделями (для некритичных задач).

#### 4.3. Пилотное развёртывание (single-host)

Для быстрого пилота на одном сервере заказчика (bare metal или VM) предусмотрен упрощённый деплой через Docker Compose / k3s.

**Спецификация single-host:**

- **OS**: Ubuntu 22.04 LTS / RHEL 9;
- **CPU**: 16+ cores;
- **RAM**: 64+ GB;
- **Storage**: 500+ GB SSD (NVMe preferred);
- **GPU**: опционально, 1× NVIDIA GPU с 24+ GB VRAM для локального инференса;
- **Network**: публичный IP или reverse tunnel для доступа Sreda.

**Процедура деплоя:**

1. Подготовка хоста (Docker, k3s, NVIDIA drivers + container toolkit);
2. Клонирование deployment-репозитория из Gitea;
3. Запуск bootstrap-скрипта (`./deploy-pilot.sh --env inside --domain pilot.customer.ru`);
4. Развёртывание через k3s + Helm в single-node режиме (tolerations для master-ноды);
5. Инициализация Keycloak realm, создание первого администратора;
6. Проверка health-check всех сервисов, smoke-тесты API;
7. Передача доступов заказчику, активация лицензии.

Пилотный режим поддерживает миграцию в полноценный Kubernetes-кластер без потери данных через backup/restore Data Platform.

#### 4.4. Sandbox-изоляция

Критичный элемент безопасности для фазы Forge и мультиарендного SaaS.

**gVisor:**

Контейнеры агентов выполняются через runtime `runsc` (gVisor), который перехватывает системные вызовы и эмулирует ядро Linux в userspace. Это предотвращает escape из контейнера, доступ к хостовой файловой системе и прямое использование хостовых ресурсов. gVisor интегрируется с containerd через RuntimeClass в Kubernetes.

**Firecracker:**

Для задач, требующих ещё более строгой изоляции (например, выполнение ненадёжного кода агентов-разработчиков), используются Firecracker microVMs. Каждый агент получает отдельную microVM с минимальным Linux-окружением, запускаемой через integration с Kubernetes (firecracker-containerd). Время холодного старта — < 125 мс, что приемлемо для batch-задач Forge.

**Сравнение изоляции:**

| Уровень | Технология | Накладные расходы | Применение |
|---------|-----------|-------------------|------------|
| Контейнер | runc (стандартный) | Минимальные | Доверенные сервисы платформы |
| Sandbox-контейнер | gVisor (runsc) | ~20-30% CPU, ~2× syscall latency | Агенты в multi-tenant SaaS |
| MicroVM | Firecracker | ~10-15% CPU, холодный старт 125 мс | Ненадёжный код, Forge-проекты |

**Network-изоляция:**

- Cilium в режиме strict L3/L4 enforcement;
- Запрет egress трафика из sandbox по умолчанию, разрешённые endpoint-ы — через CiliumNetworkPolicy;
- DNS-фильтрация через CoreDNS с блоклистами;
- LLM-трафик маршрутизируется исключительно через LiteLLM Gateway (прокси-режим, нет прямых вызовов провайдеров).

---

*Раздел 1 завершён. Следующие разделы: Модель данных и API (Раздел 2), Безопасность и compliance (Раздел 3), Масштабирование и производительность (Раздел 4).*
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
