// Loads one language file and shapes it for the UI. The JSON itself is never changed.
const cache = new Map();

function fillParam(description, progress) {
    return description.replaceAll('{param0}', String(progress));
}

export function compareVersions(a, b) {
    const [aMajor, aMinor] = a.split('.').map(Number);
    const [bMajor, bMinor] = b.split('.').map(Number);
    return aMajor - bMajor || aMinor - bMinor;
}

function shapeItem(raw) {
    const rawStages = raw.id.map((_, index) => raw[`stage${index + 1}`]);
    const stages = rawStages.map((stage, index) => ({
        id: raw.id[index],
        index,
        title: stage.title,
        titleDiffers: stage.title !== raw.name,
        description: fillParam(stage.description, stage.progress),
        reward: stage.reward?.count ?? 0,
    }));

    // Stages only share one description line when their text is the same apart from {param0}.
    const sameText = new Set(rawStages.map((stage) => stage.description)).size === 1;
    const vertical = stages.some((stage) => stage.titleDiffers) || !sameText;

    let description = stages[0].description;
    if (!vertical && stages.length > 1 && rawStages[0].description.includes('{param0}')) {
        description = fillParam(rawStages[0].description, rawStages.map((stage) => stage.progress).join(' / '));
    }

    return {
        key: raw.id[0],
        name: raw.name,
        alias: raw.dupealias ?? null, // Only tells duplicate names apart in the bulk mark report.
        groupId: raw.achievementGroupId,
        groupName: raw.achievementGroupName,
        hidden: raw.isHidden === true,
        sortOrder: raw.sortOrder,
        version: raw.version,
        stages,
        vertical,
        description,
        totalReward: stages.reduce((sum, stage) => sum + stage.reward, 0),
    };
}

function shapeCatalog(rawItems) {
    const items = rawItems.map(shapeItem);
    const groups = new Map();
    for (const item of items) {
        if (!groups.has(item.groupId)) {
            groups.set(item.groupId, { id: item.groupId, name: item.groupName, items: [] });
        }
        groups.get(item.groupId).items.push(item);
    }
    for (const group of groups.values()) {
        group.items.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    const stageIndex = new Map();
    items.forEach((item) => item.stages.forEach((stage) => stageIndex.set(stage.id, { item, index: stage.index })));
    return {
        items,
        itemByKey: new Map(items.map((item) => [item.key, item])),
        stageIndex,
        groups: [...groups.values()],
        totalReward: items.reduce((sum, item) => sum + item.totalReward, 0),
        versions: [...new Set(items.map((item) => item.version))].sort(compareVersions).reverse(),
    };
}

export function isCatalogLoaded(lang) {
    return cache.has(lang);
}

export async function loadCatalog(lang) {
    if (!cache.has(lang)) {
        const response = await fetch(`data/achievements.${lang}.json`);
        if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
        cache.set(lang, shapeCatalog(await response.json()));
    }
    return cache.get(lang);
}
