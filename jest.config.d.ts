declare const _default: {
    extensionsToTreatAsEsm: string[];
    transform: {
        ["^.+\\.m?tsx?$"]: ["ts-jest", {
            useESM: true;
        } & import("ts-jest").DefaultEsmTransformOptions];
    };
};
export default _default;
//# sourceMappingURL=jest.config.d.ts.map