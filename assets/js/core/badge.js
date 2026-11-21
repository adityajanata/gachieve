// Contributor badges (DESIGN 3.10). Badges are data, so a key added in Points Settings falls back to a plain tier.
import { el, icon } from './dom.js';

const TIERS = {
    wayfinder: ['ph-compass', 1],
    trailblazer: ['ph-path', 2],
    seasoned_guide: ['ph-map-trifold', 3],
    master_cartographer: ['ph-globe-hemisphere-west', 4],
    legend_of_teyvat: ['ph-crown-simple', 5],
};

const FALLBACK = ['ph-medal', 1];

export function badgeIconClasses(badgeKey) {
    return `ph-fill ${(TIERS[badgeKey] ?? FALLBACK)[0]}`;
}

export function badgePill(badgeKey, title) {
    const [iconName, tier] = TIERS[badgeKey] ?? FALLBACK;
    return el('span', { className: `ui-badge ui-badge-tier-${tier}` }, [icon(`ph ${iconName}`), el('span', { text: title })]);
}
