import { comptime } from 'comptime'
export const TEST = comptime.debug ? 'DEBUG' : 'PROD'
