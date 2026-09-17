# House conventions translated to Python

The global CLAUDE.md, `docs/testing-conventions.md` and `docs/backend-conventions.md` are written
for TypeScript and enforced there by ESLint. This backend has ruff and mypy strict, which cover
some of it, and **prose strength for the rest**: every rule below is checked at `/story-done`
review with `lint-index.md` applied to every angle (the untooled-repo override). When a rule is
enforced mechanically here, the tool is named; otherwise it is a review item.

## Tests

| House rule | Python form | Enforced by |
|---|---|---|
| Test names are behaviour sentences | `def test_same_visitor_and_flag_always_get_the_same_variant()` | review |
| Given / When / Then, each phase has one home | **Given**: fixture (`conftest.py`) for shared setup, `driver.given.*` for test-specific; **When**: `driver.get/post/patch.*` in the body, never in a fixture; **Then**: `driver.then.*` after the When. Blank line between phases. | review |
| No assertions or logic in test bodies | HTTP/DB tests: only driver calls. `assert` appears in `tests/drivers/**` only. | ruff `S101` is *allowed* only under `tests/**`; the narrower "drivers only" rule is review |
| Pure-function exemption | `tests/unit/test_<pure_module>.py` for a pure module (`ids.py`, `assignment.py`, `stats.py`, `summary.py`, `strip_html`) asserts with bare `assert`. No driver for a property read. | review |
| Driver namespaces | `given / get / post / patch / delete / when / then`. `then` replaces `assert` (Python keyword); `when` holds the rare action that is not one HTTP verb call (`when.two_overlapping_requests`). Methods return `None`, never a response or value. | review |
| Builders for all test data | `tests/builders/<entity>.py`: factory `a_breach(**overrides)`; builder class module-private (`_BreachBuilder`); `with_*` returns a **new** builder (`dataclasses.replace`), never mutates; `build()` returns the model. No `cast`/`Any`. | review |
| Fakes over mocks | Ports get in-memory fakes in `tests/fakes/` implementing the same `Protocol`. `unittest.mock` is not used for our own ports. | review |
| Real store only in integration tests | `tests/integration/**` hits the compose Postgres; each test runs inside a savepoint that is rolled back. Unit tests never open a DB connection. | `pytest_collection_modifyitems` in `tests/conftest.py` marks every test under `tests/integration/` `integration` **by location**, so `pytest -m "not integration"` is a real database-free run and a new integration test cannot forget the marker. A `pytestmark` in a conftest is inert — that is what this hook replaces. |
| Config: clearMocks + global setup | `conftest.py` fixtures are function-scoped by default, so state never leaks between tests. | pytest |
| Warnings are failures | `filterwarnings = ["error", …]` | pytest |

## Types (Hoare null / trust the type system)

| House rule | Python form | Enforced by |
|---|---|---|
| `strictNullChecks`, no `!` | mypy strict; `T \| None` declared explicitly; `if x is None: return/raise` guards, no `assert x is not None` in production code | mypy + review |
| No `as` casts, no `any` | No `typing.cast`, no `Any`, no `# type: ignore` in `app/**`. Wire input is narrowed by a Pydantic model at the boundary. | mypy `strict` (`disallow_any_*`, `warn_unused_ignores`) + review for `cast` |
| Never `null` in our code | `None` is the only absence value; DB `NULL` and JSON `null` become `None` at the boundary via Pydantic / SQLAlchemy `Optional` columns. | mypy |
| Discriminated unions over optional fields | `Literal["calm"] \| Literal["urgent"]` tags or a `StrEnum` discriminator on Pydantic models (`Field(discriminator=...)`); `is_*` predicates in a `selectors.py`-style module when narrowing is needed. | review |
| Enums, never string literals for a discriminated set | `class FunnelEventName(StrEnum)`. | ruff `PLR2004` (magic values) partially; review |
| Explicit optionality | `def f(x: int \| None)`, never a `None` default used as a sentinel. Optional dependency = forbidden; inject a fake. | review |
| No unused params | ruff `ARG` is not enabled (false positives on FastAPI signatures); underscore-prefix (`_request`) only when a framework signature forces it. | review |

## Structure (functional core, Dijkstra, Beck)

| House rule | Python form | Enforced by |
|---|---|---|
| Functional core, imperative shell | Pure modules (`assignment.py`, `stats.py`, `summary.py`, `shared/html.py`) have no I/O and no imports from `db`, `adapters`, or `fastapi`. Routers are thin shells. | review (import check) |
| Guard clauses / early return | `RET` family; `max-depth` equivalent is `PLR1702` (too many nested blocks). | ruff |
| Named predicates | `def is_stale(fetched_at, *, now)`, `def can_assign(flag)`. Compound conditions in `if` are extracted. | review |
| Data-table lookups over if/else chains | `dict[Enum, Callable]` named `*_map` (`sort_column_map`). | review |
| Immutability | `@dataclass(frozen=True)` for value objects; Pydantic models `frozen=True` where they are values; never mutate an argument. | review |
| Named options over positional args | Keyword-only params after a bare `*` for any function with 2+ params (`def f(*, a, b)`). | review |
| No boolean parameters | An enum or two functions instead of `flag: bool`. | ruff `FBT` (added when the first case appears) |
| Expensive objects once | `httpx2.Client`, engine, Argon2 hasher built in the composition root and injected. | review |
| Wrap borrowed code once | `shared/ids.py` wraps ulid; `adapters/hibp/*` wraps httpx2 for HIBP; `signups/password_hash.py` wraps argon2. Nothing else imports those libraries. | review (grep) |
| Command–Query Separation | A function returns a value **or** has side effects. Repositories: `insert_*` returns `None` or the id; `find_*` has no side effects. | review |
| Error messages are on-call docs | `raise …("update_feature_flag: optimistic lock conflict — key=…, token=…")`; function name prefix + ids + expected-vs-found. | review |
| Delete aggressively | The S1 probe route is deleted in S2. | review |

## HTTP / API

| House rule | Python form | Enforced by |
|---|---|---|
| Validate at the boundary, not in the handler | Pydantic models in the route signature; handler never touches `request.json()`. | review |
| Error shape `{ error }` | `app/errors.py` handlers. | tests |
| Command endpoints return only what the client can't know | `201 { id, createdAt }`, `200 { updatedAt }`, `204`. | tests |
| List contract on the first list endpoint | `GET /api/breaches` ships with page/limit/sort/order/filters. | tests |
| Optimistic locking | `UPDATE … WHERE updated_at = :token`; `409` on zero rows. | tests |
| Idempotent consumer | `INSERT … ON CONFLICT DO NOTHING` on the client id. | tests |
| Composition root | `app/main.py` only; `Depends` for injection; `app.dependency_overrides` in tests. | review |
| Single write per entity per flow | One `INSERT`/`UPDATE` per entity per handler; transform before write. | review |

## Logging

| House rule | Python form | Enforced by |
|---|---|---|
| Structured, with correlation id | structlog JSON; `bind_contextvars(correlation_id=…)` per request. | tests |
| Function-name prefix, ids, transitions | `log.info("sync_breaches: completed", inserted=…, updated=…)`. | review |
| Never log sensitive values | No email/password/hash in log calls; ruff `S` family flags some. | review |

## Naming

| TS | Python |
|---|---|
| `handle*` event handlers | `handle_*` for consumers/hooks; routes are `get_*/list_*/create_*/update_*` |
| `*Map` lookup tables | `*_map` |
| verb-first pure utils | `calculate_*`, `apply_*`, `build_*` |
| `fromDTO` / `toAPI` | `to_<model>(raw)` in adapters; response models are Pydantic `*Response` |
| `*Model` domain types | dataclass `Breach`, `FeatureFlag` (no suffix; the module namespace disambiguates) |
| `is*/has*/can*` | `is_*/has_*/can_*` |
| ports `*.port.ts`, fakes `Fake*` | `app/ports/<name>.py` with `<Name>Port` Protocol; `tests/fakes/<name>.py` with `Fake<Name>` |
