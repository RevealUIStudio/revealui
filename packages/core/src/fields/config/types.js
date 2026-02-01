/**
 * Utility functions for field types
 */
export const fieldHasMaxDepth = (field) => {
    return 'maxDepth' in field && typeof field.maxDepth === 'number';
};
export const fieldShouldBeLocalized = ({ field, parentIsLocalized, }) => {
    if (parentIsLocalized)
        return true;
    return field.localized === true;
};
export const fieldSupportsMany = (field) => {
    return 'hasMany' in field && field.hasMany === true;
};
export const fieldAffectsData = (field) => {
    return field.type !== 'ui' && field.type !== 'tab';
};
export const tabHasName = (tab) => {
    return 'name' in tab && typeof tab.name === 'string';
};
