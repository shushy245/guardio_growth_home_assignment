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
from app.config import load_settings
from app.main import create_app

settings = load_settings(os.environ)
catalog = HibpBreachCatalog(
    client=build_hibp_client(user_agent=settings.hibp_user_agent, transport=build_hibp_transport())
)
app = create_app(settings, catalog=catalog)
