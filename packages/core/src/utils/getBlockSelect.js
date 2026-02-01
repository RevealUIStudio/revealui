/**
 * Gets the select configuration for a specific block
 */
export const getBlockSelect = ({ block, select, selectMode, }) => {
    if (!select || selectMode === 'exclude')
        return undefined;
    const blockSelect = select[block.slug];
    if (typeof blockSelect === 'object' && blockSelect !== null) {
        return blockSelect;
    }
    return undefined;
};
