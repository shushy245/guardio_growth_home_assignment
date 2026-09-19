"""Runnable scripts. A package so `scripts.simulate_traffic` is one module name, not two:
mypy sees the file as both a top-level module and a package member otherwise, and the parser
tests import it by the package path.
"""
