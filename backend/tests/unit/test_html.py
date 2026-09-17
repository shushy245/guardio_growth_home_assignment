"""`strip_html` is pure, so it is asserted directly — no driver (docs/python-conventions.md)."""

from app.shared.html import strip_html


def test_strip_html_removes_tags_and_keeps_their_text() -> None:
    assert strip_html('<a href="x">Hi</a> there') == "Hi there"


def test_strip_html_keeps_a_line_break_tag_from_merging_the_words_around_it() -> None:
    assert strip_html("Passwords were exposed<br/>Emails were not") == (
        "Passwords were exposed Emails were not"
    )


def test_strip_html_collapses_whitespace_runs_including_the_ones_it_introduces() -> None:
    markup = "Emails were exposed. <br/> Passwords were not.\n    Read the source."

    assert strip_html(markup) == "Emails were exposed. Passwords were not. Read the source."


def test_strip_html_decodes_character_entities() -> None:
    """HIBP descriptions carry `&amp;` and `&quot;`; raw entities would reach the screen."""
    assert strip_html("Ashley &amp; Madison, the &quot;affairs&quot; site") == (
        'Ashley & Madison, the "affairs" site'
    )


def test_strip_html_keeps_a_description_that_ends_in_a_bare_ampersand() -> None:
    """`HTMLParser` holds a trailing `&` back in case it opens a character reference. Without a
    `close()` that buffer is discarded — and because the whole string is one data chunk, the
    description does not lose its tail, it comes back empty."""
    assert (
        strip_html("Emails and passwords were exposed &") == "Emails and passwords were exposed &"
    )


def test_strip_html_keeps_a_description_that_ends_in_an_unfinished_entity() -> None:
    assert (
        strip_html("Ends with a half-written entity &am") == "Ends with a half-written entity &am"
    )
