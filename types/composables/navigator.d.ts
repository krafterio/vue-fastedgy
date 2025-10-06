/**
 * Advanced navigation helper with smart back/forward detection
 */
export function useNavigator(): {
    goBackTo: (target: string | any) => Promise<void>;
    goNextTo: (target: string | any) => Promise<void>;
    goBack: () => void;
    goNext: () => void;
};
//# sourceMappingURL=navigator.d.ts.map