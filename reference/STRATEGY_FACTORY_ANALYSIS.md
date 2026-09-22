# Strategy Factory Reference and Licence Boundary

## Known context

The public `moyger/strategy_factory` repository was discussed as a potential technical reference and private proof-of-concept aid. Previous review identified a "For personal use" statement in its README; this package does not independently reproduce that review or assert a legal conclusion.

## Working boundary

- It may be studied for high-level architecture, experiment design, and questions to validate.
- Do not copy repository code, bundled assets, or substantial implementation patterns into this project for commercial use without a separate licence and dependency audit.
- Third-party dependencies used by any reference project have their own licences; their presence does not grant rights to the reference project’s code.
- Record source, version/commit, licence evidence, attribution needs, and approval before adopting an external dependency.

## PoC use

A separate local, private PoC can be useful to test whether particular analysis workflows are feasible. Keep it separate from this repository and label its outputs as exploratory. It must not become an undeclared codebase foundation.

## Future audit checklist

1. Locate the repository licence and terms at a pinned revision.
2. Inventory direct and transitive dependencies.
3. Classify each component: safe to use, attribution required, permission required, or prohibited/unknown.
4. Preserve evidence and seek qualified legal advice before commercial release decisions.
