"""Process entrypoint for uvicorn: `uvicorn app.asgi:app`.

The outermost composition root: the one place the real environment is read and the one place a
real adapter is named. Tests never import this module.
"""

import os

from app.adapters.hibp.breach_catalog import (
    HibpBreachCatalog,
    build_hibp_client,
    build_hibp_transport,
)
from app.adapters.hibp.pwned_password_range import (
    HibpPwnedPasswordRange,
    build_pwned_passwords_client,
    build_pwned_passwords_transport,
)
from app.config import load_settings
from app.main import create_app

settings = load_settings(os.environ)
catalog = HibpBreachCatalog(
    client=build_hibp_client(user_agent=settings.hibp_user_agent, transport=build_hibp_transport())
)
pwned_passwords = HibpPwnedPasswordRange(
    client=build_pwned_passwords_client(
        user_agent=settings.hibp_user_agent, transport=build_pwned_passwords_transport()
    )
)
app = create_app(settings, catalog=catalog, pwned_passwords=pwned_passwords)
