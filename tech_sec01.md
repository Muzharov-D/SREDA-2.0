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
