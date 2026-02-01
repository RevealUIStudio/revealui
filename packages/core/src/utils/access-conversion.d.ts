import type { RevealUIAccessContext, RevealUIAccessResult, RevealUIAccessRule, RevealUIPermission } from '../types/index.js';
export declare function createRevealUIAccessRule(options: {
    tenant?: string;
    user?: string;
    permissions?: RevealUIPermission[];
    condition?: (context: RevealUIAccessContext) => RevealUIAccessResult;
}): RevealUIAccessRule;
export declare function convertToRevealUIAccessRule(permissions: RevealUIPermission[]): RevealUIAccessRule;
export declare function createEnhancedAccessRule(options: {
    permissions: RevealUIPermission[];
    tenantScoped?: boolean;
    allowSuperAdmin?: boolean;
    customCondition?: (context: RevealUIAccessContext) => RevealUIAccessResult;
}): RevealUIAccessRule;
export declare function evaluateRevealUIAccessRule(rule: RevealUIAccessRule, context: RevealUIAccessContext): RevealUIAccessResult;
export declare function combineRevealUIAccessRules(rules: RevealUIAccessRule[], operator?: 'AND' | 'OR'): RevealUIAccessRule;
//# sourceMappingURL=access-conversion.d.ts.map