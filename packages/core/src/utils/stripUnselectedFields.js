/**
 * Strips unselected fields from a document based on select configuration
 */
export const stripUnselectedFields = ({ field, select, siblingDoc, }) => {
    if (!select || typeof select !== 'object')
        return;
    const fieldName = field.name || '';
    if (!fieldName)
        return;
    const fieldValue = siblingDoc[fieldName];
    // Only process if field value is an object (not primitive types)
    if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
        const fieldValueRecord = fieldValue;
        for (const key of Object.keys(fieldValueRecord)) {
            if (!(key in select)) {
                Reflect.deleteProperty(fieldValueRecord, key);
            }
        }
    }
};
