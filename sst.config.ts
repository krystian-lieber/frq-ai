import { type SSTConfig } from 'sst'
import { MainStack } from './stacks/MainStack'

export default {
  config (_input) {
    return {
      name: 'frq-generator',
      region: 'us-east-1',
      profile: 'klieber'
    }
  },
  stacks (app) {
    app.setDefaultFunctionProps(() => ({
      runtime: 'nodejs18.x',
      architecture: 'arm_64',
      timeout: 900
    }))
    app.stack(MainStack)
  }
} satisfies SSTConfig
