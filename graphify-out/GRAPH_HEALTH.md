[graphify] MultiDiGraph edge-collapse diagnostic
input: <in-memory>
input_stage: provided JSON (normal graph.json is post-build)
effective_directed: <direct-call>
nodes: 852
unverified_code_nodes: 0
raw_edges: 2420
valid_candidate_edges: 2404
missing_endpoint_edges: 0
dangling_endpoint_edges: 3
external_reference_edges: 13
self_loop_edges: 2
exact_duplicate_edges: 1
directed_unique_endpoint_pairs: 2329
directed_same_endpoint_collapsed_edges: 75
undirected_unique_endpoint_pairs: 2329
undirected_same_endpoint_collapsed_edges: 75
same_endpoint_group_count: 71
relation_variant_groups: 55
source_file_variant_groups: 0
source_location_variant_groups: 15
context_variant_groups: 0
post_build_graph_type: Graph
post_build_edges: 2345
producer_suppression_sites: 12
producer_suppression_examples:
  - L1902 seen_ids arity=unknown
  - L2597 seen_ids arity=unknown
  - L2599 seen_doc_refs arity=unknown
  - L3266 seen_ids arity=unknown
  - L3413 seen_ids arity=unknown
  - L5148 seen_keys arity=unknown
  - L5334 seen_keys arity=unknown
  - L9853 seen_ids arity=unknown
examples:
  - github_workflows_ci_verify_steps -> github_workflows_ci_steps_run edges=6 relations=['contains'] locations=['L17', 'L18', 'L19', 'L20', 'L22', 'L23'] contexts=['']
  - github_workflows_ci_verify_steps -> github_workflows_ci_steps_uses edges=2 relations=['contains'] locations=['L12', 'L13'] contexts=['']
  - eslint_config -> ref_eslint_config_next edges=2 relations=['imports_from'] locations=['L2', 'L3'] contexts=['import']
  - src_app_api_api_routes_test -> src_app_api_api_routes_test_configureauthenticateduser edges=2 relations=['calls', 'contains'] locations=['L49', 'L63'] contexts=['', 'call']
  - src_app_dashboard_billing_page_billingpage -> src_app_dashboard_billing_page_billingpage_load edges=2 relations=['calls', 'contains'] locations=['L25', 'L36'] contexts=['', 'call']
note: normal graph.json is post-build; raw producer loss must be measured earlier.