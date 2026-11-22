import type { DeploymentInput } from '@chain-protocol/casino-sdk';

export default {
  kind: 'casino',
  contract: {
    source: 'BorrowedAegisAuto.sol',
    name: 'BorrowedAegisAuto',
  },
} satisfies DeploymentInput;
