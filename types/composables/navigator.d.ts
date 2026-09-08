/**
 * Advanced navigation helper with smart back/forward detection
 */
export declare function useNavigator(): {
    goBackTo: (target: string | object) => Promise<void>;
    goNextTo: (target: string | object) => Promise<void>;
    goBack: () => void;
    goNext: () => void;
};
//# sourceMappingURL=navigator.d.ts.map