# H02 MiniMax fifth independent review

Status: CHANGES_REQUESTED. HEAD a354f5a7f64cf12e795c3482387c7c1d38056386; implementation 50544d505cefd30fc5550f6247c8175aa0ccb57b.

Independent Node suites: 42/42 passed, zero skips. Previous targeted not/conditional/false/complete-registration fixes: 5/5 expected outcomes passed in round5-probes.json. These findings are closed.

New round5-extra-probes.json/mjs: typed baseline accepted; all three invalid cases accepted incorrectly. A local $ref to an integer definition accepts a string, an unresolved $ref accepts a value, and schema-valued additionalProperties accepts a string against integer. Keyword allowlisting does not implement validation. No production execution or real data used.

R-M11: Resolve supported schema references in correct root context and reject unresolved/unsupported references; execute schema-valued additionalProperties, or reject unsupported constructs before validation. Apply consistent behavior to compiler and verifier, including nested schemas. Add meaningful RED/GREEN cases and legal controls; do not patch sentinel names. Review the advertised keyword set for other accepted-but-ignored assertions and fail closed if unsupported. Correct personal report claims that all allowed keywords execute. Do not overwrite historical Codex JSON; use fresh result paths.

Only original Owner files may change. No production/H01/other-lane changes, push/merge/deploy/model keys/service restart. H02 full cross-lane gate remains pending; H03 unauthorized. Current descriptors and typed fixtures are synthetic/offline contract evidence, not business/model proof.
