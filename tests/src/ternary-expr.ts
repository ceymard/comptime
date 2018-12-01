
export const fn = (a: string) => a + 3
export const value = Comptime.Debug ? fn('%error') : fn('OK')