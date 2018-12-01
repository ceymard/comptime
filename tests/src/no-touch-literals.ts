// none of these should be compiled away
export const value = 'hello !';

// Here, we should *not* touch to this expression.
/iPad|iPhone|iPod/.test(value)
