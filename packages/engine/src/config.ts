export type DeadHandDetectionMode = "auto" | "manual";

export type RuleConfig = {
  readonly charleston: {
    readonly allowBlindPasses: boolean;
    readonly courtesyPass: boolean;
    readonly allowJokersInCharleston: boolean;
  };
  readonly jokers: {
    readonly allowDiscardingJokers: boolean;
  };
  readonly play: {
    readonly deadHandDetection: DeadHandDetectionMode;
  };
};
