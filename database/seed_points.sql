-- =============================================================================
-- Default point rules and badge milestones.
-- INSERT IGNORE: re-running this file never overwrites values an Administrator
-- has changed in Points Settings; it only adds missing defaults.
-- =============================================================================

INSERT IGNORE INTO point_rules (event_key, label, points, is_active) VALUES
    ('tutorial_published_new',    'New tutorial approved',                    10, 1),
    ('tutorial_published_update', 'Updated tutorial version approved',         3, 1),
    ('translation_added',         'New language added in an approved version', 5, 1);

INSERT IGNORE INTO badges (badge_key, title, min_points, sort_order, is_active) VALUES
    ('wayfinder',           'Wayfinder',           10,   1, 1),
    ('trailblazer',         'Trailblazer',         50,   2, 1),
    ('seasoned_guide',      'Seasoned Guide',      150,  3, 1),
    ('master_cartographer', 'Master Cartographer', 400,  4, 1),
    ('legend_of_teyvat',    'Legend of Teyvat',    1000, 5, 1);
