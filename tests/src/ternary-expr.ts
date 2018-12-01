import { comptime } from 'comptime'

export const fn = (a: string) => a + 3
export const value = comptime.debug ? fn('%error') : fn('OK')
