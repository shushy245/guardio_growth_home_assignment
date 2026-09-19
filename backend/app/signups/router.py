"""HTTP shell for sign-up. Validation is the schema's job, hashing the hasher's, SQL the
repository's. Everything is looked up first and written last, once.

The visitor is the cookie, never the body — and unlike a funnel event, a missing or unknown
visitor is not a refusal. The funnel fails open when the visitor service is down (ADR-0004), so
the purchase step files the account with no visitor rather than turning a customer away; the
experiment simply cannot attribute them, which is true either way."""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.dependencies import get_password_hasher
from app.shared.ids import generate_unique_id
from app.signups import repository
from app.signups.password_hash import PasswordHasher
from app.signups.repository import NewSignup
from app.signups.schemas import SignupCreate, SignupCreated
from app.visitors import repository as visitor_repository
from app.visitors.cookie import VISITOR_COOKIE

log = structlog.get_logger()

router = APIRouter()


@router.post("/signups", status_code=status.HTTP_201_CREATED, response_model=SignupCreated)
def create_signup(
    signup: SignupCreate,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    hasher: Annotated[PasswordHasher, Depends(get_password_hasher)],
) -> SignupCreated:
    """Never logs the email, the password or its hash: an account is personal data and a
    credential, and a log line is neither the place nor the audience for them."""
    signup_id = generate_unique_id("sup")
    ctx = {
        "signup_id": signup_id,
        "plan": signup.plan,
        "password_was_pwned": signup.password_was_pwned,
    }
    log.info("create_signup: started", **ctx, has_cookie=VISITOR_COOKIE in request.cookies)

    visitor_id = _known_visitor(session=session, request=request)
    log.info("create_signup: attributing", **ctx, visitor_id=visitor_id)

    inserted = repository.insert_signup(
        session=session,
        signup=NewSignup(
            id=signup_id,
            visitor_id=visitor_id,
            email=signup.email,
            plan=signup.plan,
            password_hash=hasher.hash_password(signup.password.get_secret_value()),
            password_was_pwned=signup.password_was_pwned,
        ),
    )
    if inserted is None:
        log.info("create_signup: refused, email already has an account", **ctx)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="create_signup: that email already has an account",
        )

    return SignupCreated(id=inserted.id, created_at=inserted.created_at)


def _known_visitor(*, session: Session, request: Request) -> str | None:
    """The visitor the cookie names, if this server still knows them; otherwise nobody.

    A cookie naming a visitor the database lost is a browser outliving a reset, and the
    foreign key cannot point at nobody — so the account is filed without one, and says so."""
    visitor_id = request.cookies.get(VISITOR_COOKIE)
    if visitor_id is None:
        return None
    if visitor_repository.find_assignments(session=session, visitor_id=visitor_id) is None:
        log.info(
            "create_signup: cookie names an unknown visitor, filing with none",
            visitor_id=visitor_id,
        )

        return None

    return visitor_id
