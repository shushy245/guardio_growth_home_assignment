"""Process entrypoint for uvicorn: `uvicorn app.asgi:app`.

The one place the real environment is read. Tests never import this module.
"""

import os

from app.config import load_settings
from app.main import create_app

app = create_app(load_settings(os.environ))
