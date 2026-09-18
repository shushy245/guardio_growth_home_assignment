# Python primer for a TypeScript reader

Written for the repo owner, who works in TypeScript and is new to Python. Every construct the
backend uses is mapped to the TypeScript idea you already know, with the honest caveats. Sections
are added as stories introduce new constructs, so this file grows with the code.

## The stack, side by side

| You know (TS) | We use (Python) | One-line why |
|---|---|---|
| pnpm / npm | **uv** | Package manager + lockfile + venv in one tool. `uv sync` = `pnpm install`, `uv run x` = `pnpm exec x`. |
| `tsc --strict` | **mypy --strict** | Static type checker. Python types are optional at runtime; mypy makes them mandatory at commit. |
| eslint + prettier | **ruff** | One tool that lints and formats. Rules live in `pyproject.toml`. |
| vitest | **pytest** | Test runner. A test is any `def test_*` function in a `test_*.py` file. |
| Express | **FastAPI** | HTTP framework. Routes are functions decorated with `@router.get(...)`. |
| Zod | **Pydantic** | Runtime validation from a declared schema. The model *is* the type; no `z.infer` step. |
| Drizzle | **SQLAlchemy 2** | Typed tables and a query builder. Heavier than Drizzle; we use a thin slice. |
| drizzle-kit | **Alembic** | Migrations: `alembic revision --autogenerate` then `alembic upgrade head`. Forward-only, same as the house rule. |
| axios | **httpx2** | HTTP client (successor to httpx; Starlette's test client requires it). Used sync. |
| pino | **structlog** | Structured JSON logging with bound context. |
| `interface` | **`typing.Protocol`** | Structural interface: anything with the right method signatures satisfies it, no `implements` keyword. This is how ports are declared. |
| `readonly` object type | **`@dataclass(frozen=True)`** | Immutable value with named fields. Assigning after construction raises. |
| `enum` | **`enum.StrEnum`** | String enum whose members compare equal to their string value. |
| `T \| undefined` | **`T \| None`** | Python's `None` is the one absence value. There is no separate `null`. |
| `async/await` | **`async def` / `await`** | Same idea, but this backend is sync: plain `def` routes run in FastAPI's threadpool. Only ASGI middleware is `async`. |
| `try/finally` resource cleanup | **`with ...:` context manager** | The block guarantees cleanup (closing a DB session, an HTTP client). |
| dependency injection via constructor | **FastAPI `Depends(...)`** | A route parameter whose value is produced by another function. Tests replace it with `app.dependency_overrides[real] = fake`. |

## Conventions that will look strange at first

- **Naming:** `snake_case` for functions and variables, `PascalCase` for classes, `UPPER_CASE`
  for constants. Files are modules; `app/breaches/router.py` is imported as `app.breaches.router`.
- **No braces, indentation is syntax.** Four spaces. ruff enforces it.
- **Explicit `self`.** Methods receive the instance as their first parameter. We rarely write
  classes, so you will mostly see plain functions.
- **`None` checks are `is None` / `is not None`**, never `== None`. Same spirit as your
  `=== undefined` rule.
- **Truthiness is broad** (`0`, `""`, `[]`, `None` are all falsy). The house rule "never use
  `undefined`/`null` as a falsy sentinel" carries over: we write `if x is None:` explicitly.
- **Keyword arguments** are Python's named-options object. `assign_variant(visitor_id=..., flag_key=...)`
  reads like `assignVariant({ visitorId, flagKey })`. We force keyword-only params with a bare `*`
  in the signature: `def f(*, visitor_id: str, flag_key: str)`.
- **Type hints everywhere.** `def f(x: int) -> str:`. mypy strict rejects a missing one.

## How to read a FastAPI route

```python
@router.get("/breaches", response_model=BreachPage)
def list_breaches(
    query: Annotated[BreachListQuery, Query()],   # Pydantic validates the query string first
    session: Annotated[Session, Depends(get_session)],  # injected, one transaction per request
) -> BreachPage:
    return list_breaches_page(session, query)
```

- `@router.get("/breaches")` registers the function as the handler, like `router.get('/breaches', handler)`.
- `Annotated[BreachListQuery, Query()]` says "parse the query string into this Pydantic model
  before calling me". Invalid input never reaches the function body; FastAPI returns 422 by
  default, which our exception handler rewrites to `400 { error }` to match the house contract.
- `Depends(get_session)` is the seam. In tests we override it with a rolled-back session.
- The return value is serialised through `response_model`, so the wire shape is declared, not implied.

## How to read a port and adapter

```python
# app/ports/breach_catalog.py — the interface. No I/O, no HIBP anywhere.
class BreachCatalogPort(Protocol):
    def fetch_all(self) -> list[Breach]: ...

# app/adapters/hibp/breach_catalog.py — the only file that knows HIBP exists.
class HibpBreachCatalog:
    def __init__(self, *, client: httpx2.Client, user_agent: str) -> None: ...
    def fetch_all(self) -> list[Breach]:
        response = self._client.get(HIBP_BREACHES_URL, headers={"User-Agent": self._user_agent})
        response.raise_for_status()
        return [to_breach(raw) for raw in response.json()]   # wire → our model

# tests/fakes/breach_catalog.py — same shape, in memory.
class FakeBreachCatalog:
    def __init__(self, breaches: list[Breach]) -> None: ...
    def fetch_all(self) -> list[Breach]: return list(self._breaches)
```

`HibpBreachCatalog` never says `implements BreachCatalogPort`; mypy checks structurally that it
satisfies the Protocol wherever one is expected. Swapping providers is a new adapter file and a
changed line in `app/main.py`.

## How to read a test

```python
def test_same_visitor_and_flag_always_get_the_same_variant() -> None:
    variants = [aVariant(key="calm", weight=50), aVariant(key="urgent", weight=50)]
    first = assign_variant(visitor_id="vis_1", flag_key="tone", variants=variants)
    second = assign_variant(visitor_id="vis_1", flag_key="tone", variants=variants)
    assert first == second
```

- `assert` is the whole assertion library for pure functions; pytest rewrites it to show both sides on failure.
- Fixtures (`def db_session(): ...` decorated with `@pytest.fixture`) are pytest's `beforeEach`
  with dependency injection: a test asks for one by naming it as a parameter.
- HTTP tests go through a driver (`tests/drivers/http.py`) with `given / get / post / then`
  namespaces (`then` for assertions), mirroring the frontend driver convention, so test bodies contain no raw client calls.

## Things to be suspicious of when reviewing my Python

You will struggle to validate details, so here is what to look for:

1. **A function without a return type annotation** — mypy strict should have rejected it; if it
   landed, the gate is misconfigured.
2. **`Any` anywhere** — the escape hatch equivalent to `as any`. Should not appear outside the
   HIBP wire-parsing boundary, and there it must be narrowed immediately by a Pydantic model.
3. **`except Exception:` swallowing errors** — a silent fallback. Every `except` should re-raise,
   return an explicit error response, or log with context and fail visibly.
4. **A route that touches `request.json()` directly** — bypasses Pydantic; the house rule says the
   handler never sees raw input.
5. **A second write to the same row in one handler** — the single-write-per-flow rule.
6. **A test that doesn't fail when the implementation is deleted** — ask me to demonstrate red
   before green on anything you doubt.

## Added in S1 — constructs that actually landed

- **Sync, not async.** Routes and ports are plain `def`. Only the ASGI middleware is `async` because the
  framework requires it. Mental model: like Express handlers before you learned promises.
- **`@dataclass(frozen=True)` builders** (`tests/builders/settings.py`): `replace(self, env=env)`
  returns a new object with one field changed, the Python spelling of `{ ...this.state, env }`.
- **`SecretStr`** (`app/config.py`): a Pydantic wrapper whose `repr` prints `**********`; the
  real value only comes out of `.get_secret_value()`. Use it for anything that must not leak
  into logs.
- **`StrEnum`** (`Env`, `LogFormat`): members compare equal to their string, so `Env("prod")`
  parses and `Env.PROD == "prod"` is true. The `_log_format_map` dict keyed by the enum is the
  house `*Map` lookup table.
- **`contextvars`** (`app/middleware/correlation_id.py`): per-task variables, the analogue of
  Node's AsyncLocalStorage. structlog binds the correlation id there so every log line in the
  request carries it without threading a parameter.
- **`Iterator[Session]` dependency with `yield`** (`app/db/session.py`): code before `yield` runs
  before the handler, code after runs after it. `with session_factory.begin() as session:`
  commits on normal exit and rolls back on exception, so one request is one transaction.
- **`request.app.state`**: FastAPI's bag for objects built once at startup (the session
  factory). Dependencies read from it; tests override the dependency instead.
- **`app.dependency_overrides[real] = fake`**: the testing seam; the driver uses it to route
  requests through the test's rolled-back session.
- **pytest fixture scopes**: `scope="session"` runs once per test run (migrate the test
  database), default function scope runs per test (open and roll back a transaction).
- **`# type: ignore` is a code smell** here as `as any` is there; the one that appeared was
  removed by using Starlette's decorator form for exception handlers.

## Added in the S1 review-fix pass

- **`asyncio.run(coro)`** (`tests/drivers/http.py`): starts an event loop, runs one coroutine to
  completion, closes the loop. It is how a *sync* test body drives async code — the analogue of
  calling `await` at the top level of a Node script. A coroutine that is never awaited never runs.
- **`asyncio.gather(*coros)`**: starts every coroutine as its own task and waits for all of them,
  returning results in argument order — `Promise.all`. Two HTTP requests gathered this way
  interleave inside one loop, which is exactly the condition a per-request correlation id has to
  survive; a module-level variable fails it (proved by mutating the middleware before the fix).
- **`httpx2.ASGITransport(app)` + `AsyncClient`**: calls the ASGI app in-process, no socket and no
  worker thread, so the requests share the test's event loop. `TestClient` (Starlette's sync
  client) instead runs the app on *another thread*, which is why a test thread can never observe a
  request's contextvars — the reason the old "context was cleared" assertion was vacuous.
- **`zip(a, b, strict=True)`**: pairs two sequences and raises if their lengths differ, instead of
  silently truncating like the default. Use `strict=True` every time; the silent truncation is the
  kind of bug that only shows up as missing data.
- **`@field_validator("name")` + `@classmethod`** (`app/config.py`): Pydantic's per-field check, run
  when the model is built. Raising a plain `ValueError` inside it is how you fail validation;
  Pydantic catches it and folds the message into the same `ValidationError` as a missing field, so
  `load_settings` turns both into one `SettingsError` naming the variable. The Zod `.refine()`
  analogue. The `@classmethod` line is required and must sit *below* the decorator.
- **`urllib.parse.urlsplit`** (`app/config.py`): the stdlib URL parser — `scheme`, `netloc`, `path`,
  `query`, `fragment`. Standard-library-first: no package needed to tell an origin from a URL.

## Added in S2b — constructs that actually landed

- **`threading.Lock` with `acquire(blocking=False)`** (`app/breaches/refresh.py`): the non-blocking
  form returns `False` at once if someone else holds the lock, instead of waiting. That is the
  single-flight idiom — "if a refresh is running, do nothing" — and the `try/finally` around the
  work is what guarantees `release()` even when the work raises. `lock.locked()` is a read-only
  peek the handler uses to avoid scheduling a task at all. JS has no equivalent because JS has no
  preemptive threads; the nearest mental model is a `let inFlight = false` flag that is atomic.
- **`threading.Event`** (`tests/fakes/breach_catalog.py`): a boolean other threads can `wait()` on,
  with a timeout. The fake's fetch blocks on one until the test calls `release()` — a slow HIBP you
  control — and a second event signals "the fetch has started" so the test overlaps it *for sure*
  rather than by sleeping and hoping. Always pass a timeout to `wait()`: a test that can hang
  forever is worse than one that fails.
- **`threading.Thread(target=fn, args=(…,), daemon=True)` + `join(timeout)`** (`tests/drivers/
  catalog_refresh.py`): a real OS thread. `daemon=True` means the process will not wait for it at
  exit; `join(timeout)` waits for it to finish, and `is_alive()` afterwards tells you whether it
  did. The driver joins before the test thread touches the shared database connection again —
  SQLAlchemy `Connection` objects are not thread-safe, and the red run of R7 showed what two
  threads on one connection do to a savepoint stack.
- **FastAPI `BackgroundTasks`**: declare it as a handler parameter and `add_task(fn, **kwargs)`;
  Starlette runs the tasks after the response body has been sent, a sync function on a worker
  thread. The request's DB session is closed by then, so a task opens its own transaction from the
  app-level factory. Two gotchas this story hit: tasks ride on the *response object*, so a
  handler that raises `HTTPException` loses them (hence `carry_background_tasks` in
  `app/errors.py`); and a router-level `dependencies=[Depends(…)]` runs *before* the handler's own
  parameters are validated, so a `?page=0` would hit the database before its 400 — which is why the
  revalidation is a plain call at the top of each handler.
- **`request.state`** vs **`request.app.state`**: the first is a per-request bag (lives and dies
  with one request), the second the process-wide one (session factory, refresher). `setattr` /
  `getattr(obj, name, default)` with a module-level constant for the key keeps the attribute name
  in one place; a bare `request.state.foo` on a request that never set it raises `AttributeError`.
- **`max(generator)`** (`app/breaches/summary.py`): `max(b.fetched_at for b in breaches)` — a
  generator expression is an iterable, so no intermediate list. `max` on an empty iterable raises;
  here the empty case returned `None` earlier, so the guard is the existing one.
- **`datetime.fromisoformat("…Z")`** (`tests/drivers/breaches_api.py`): since Python 3.11 the
  stdlib parser accepts the `Z` suffix Pydantic emits. Compare instants as datetimes, never as
  strings — `Z` and `+00:00` are the same instant spelled two ways.

## Added in S3 — constructs that actually landed

- **`hashlib.sha256(...).digest()` + `int.from_bytes(...)`** (`app/feature_flags/assignment.py`):
  the stdlib hash, returning raw bytes, turned into an integer to take a modulus. The thing to be
  suspicious of is the *alternative*: Python's built-in `hash()` is seeded with a random salt at
  process start (PYTHONHASHSEED), so `hash("abc") % 100` gives a different answer in every
  process. It is the obvious-looking way to write this and it is wrong for anything that must be
  reproducible. The TypeScript instinct — "a hash is a hash" — does not carry over.
- **`SecretStr`** (`app/config.py`, now with a second user): a Pydantic string whose `repr` is
  `**********`. `settings.admin_token` prints as stars in a traceback or a settings dump; the
  real value only comes out of `.get_secret_value()`, which is a single grep-able call site.
- **`hmac.compare_digest(a, b)`** (`app/feature_flags/admin.py`): compares two byte strings in
  time that does not depend on how many leading bytes matched. A plain `==` on a secret leaks the
  answer one byte at a time to anyone who can measure response times. Same idea as Node's
  `crypto.timingSafeEqual`. It takes bytes, hence the `.encode()` on both sides.
- **`Annotated[str | None, Header()]` with a `None` default** (`app/feature_flags/admin.py`):
  FastAPI reads a request header into a parameter. Declaring it *optional* is deliberate — a
  required header that is missing is a 422→400 "malformed request", and a missing credential is
  a 401. The framework's default would have given the wrong status code.
- **`dependencies=[Depends(require_admin_token)]` on a route decorator**: a dependency run for
  its side effect (raise or return `None`), not its value. The Express analogue is a middleware
  mounted on one route. Contrast with S2b's lesson: a dependency listed at the **router** level
  runs before the handler's own parameters are validated — fine here, because the gate should
  answer 401 before it reads a body at all.
- **`update(...).where(...).values(...).returning(...)`** (`app/feature_flags/repository.py`):
  SQLAlchemy's `UPDATE … RETURNING`, executed with `.scalar_one_or_none()` — the new token, or
  `None` when no row matched. One statement does the lock check, the write and the read of the
  new token; splitting it into a SELECT-then-UPDATE would be the race the lock exists to prevent.
- **`func.clock_timestamp()` vs `func.now()`**: `func.X` writes the SQL function `X` into the
  statement. Postgres's `now()` is the **transaction** start time and does not move inside one
  transaction; `clock_timestamp()` is the actual wall clock and does. Every ORM tutorial reaches
  for `now()`. Here it would mean two saves in one transaction mint the same lock token — and
  every integration test in this repo runs inside one transaction, which is how the test caught it.
- **`insert(Table).values([{...}, {...}])`** (`app/visitors/repository.py`): one multi-row INSERT
  from a list of dicts, rather than a loop of inserts.
- **`select(A.x, B.y).outerjoin(B, B.a_id == A.id)`** (`app/visitors/repository.py`): a LEFT JOIN.
  It is what lets "this visitor exists but has no assignments" be an empty mapping rather than
  indistinguishable from "no such visitor" — the difference between a 200 and a 404.
- **`TypeAdapter(list[Model])`** (`app/feature_flags/repository.py`): a validator for a type that
  is not itself a model — here the JSONB column's list of variants. Built once at module level,
  because constructing one compiles a validator and this runs on every visitor creation.
- **`@field_validator("variants")` returning the value** (`app/feature_flags/schemas.py`): the
  same Zod-`.refine()` analogue as S1's, but on a list field, and it must **return** the value it
  validated — a validator that falls off the end returns `None`, and Pydantic then stores `None`
  in a field whose declared type is `list[...]`. Not an empty list: a value the type says cannot
  be there, which every later reader will trip over instead of quietly seeing nothing.
- **ruff `S105`**: bandit flags a *name* containing `TOKEN`/`PASSWORD` assigned a string literal
  as a hardcoded credential. `ADMIN_TOKEN_HEADER = "X-Admin-Token"` trips it even though the value
  is a header name. The fix is the name (`ADMIN_HEADER_NAME`), never a suppression comment.
