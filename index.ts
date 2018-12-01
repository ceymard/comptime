
declare namespace comptime {

  export const env: {[name: string]: string | undefined}

  export const pkg: {
    version: string
    name: string
    [name: string]: any
  }

}
