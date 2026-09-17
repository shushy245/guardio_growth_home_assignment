"""Turn HIBP's HTML breach descriptions into plain text.

HIBP sends `description` as HTML (anchors to the source article, the occasional line break). We
render it as text, so the markup is stripped once on the way in rather than trusted on the way
out — a stripped string cannot carry a script tag into the result screen. stdlib `html.parser`
does the work; no sanitiser dependency is warranted for read-only text extraction.
"""

from html.parser import HTMLParser

_BREAK_TAGS = frozenset({"br"})


def strip_html(markup: str) -> str:
    collector = _TextCollector()
    collector.feed(markup)
    # `close()` is not tidy-up, it is the last of the output. `HTMLParser` holds trailing text
    # back while it could still turn out to be a character reference or a tag, and a description
    # ending in a bare `&` is one buffered chunk — dropping it returns an empty string, not a
    # truncated one, and `description` is NOT NULL so the blank would be stored without an error.
    collector.close()

    return collector.text()


class _TextCollector(HTMLParser):
    """`convert_charrefs=True` (the default) means `handle_data` already sees decoded text."""

    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []

    def handle_data(self, data: str) -> None:
        self._chunks.append(data)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        """A break carries meaning the text loses: without a space the words either side merge.

        `handle_startendtag` delegates here, so this covers `<br>` and `<br/>` alike.
        """
        if tag in _BREAK_TAGS:
            self._chunks.append(" ")

    def text(self) -> str:
        """`split()` with no argument splits on any whitespace run, so the join normalises the
        source's own newlines and indentation along with the spaces this collector inserts."""
        return " ".join("".join(self._chunks).split())
