export let darkMode: string;
export namespace theme {
  let screens:
    | {
        [x: number]: string;
        length: number;
        toString(): string;
        toLocaleString(): string;
        toLocaleString(
          locales: string | string[],
          options?: Intl.NumberFormatOptions & Intl.DateTimeFormatOptions,
        ): string;
        pop(): string | undefined;
        push(...items: string[]): number;
        concat(...items: ConcatArray<string>[]): string[];
        concat(...items: (string | ConcatArray<string>)[]): string[];
        join(separator?: string): string;
        reverse(): string[];
        shift(): string | undefined;
        slice(start?: number, end?: number): string[];
        sort(
          compareFn?: ((a: string, b: string) => number) | undefined,
        ): string[] & Record<"sm" | "md" | "lg" | "xl" | "2xl", string>;
        splice(start: number, deleteCount?: number): string[];
        splice(
          start: number,
          deleteCount: number,
          ...items: string[]
        ): string[];
        unshift(...items: string[]): number;
        indexOf(searchElement: string, fromIndex?: number): number;
        lastIndexOf(searchElement: string, fromIndex?: number): number;
        every<S extends string>(
          predicate: (
            value: string,
            index: number,
            array: string[],
          ) => value is S,
          thisArg?: any,
        ): this is S[];
        every(
          predicate: (value: string, index: number, array: string[]) => unknown,
          thisArg?: any,
        ): boolean;
        some(
          predicate: (value: string, index: number, array: string[]) => unknown,
          thisArg?: any,
        ): boolean;
        forEach(
          callbackfn: (value: string, index: number, array: string[]) => void,
          thisArg?: any,
        ): void;
        map<U>(
          callbackfn: (value: string, index: number, array: string[]) => U,
          thisArg?: any,
        ): U[];
        filter<S extends string>(
          predicate: (
            value: string,
            index: number,
            array: string[],
          ) => value is S,
          thisArg?: any,
        ): S[];
        filter(
          predicate: (value: string, index: number, array: string[]) => unknown,
          thisArg?: any,
        ): string[];
        reduce(
          callbackfn: (
            previousValue: string,
            currentValue: string,
            currentIndex: number,
            array: string[],
          ) => string,
        ): string;
        reduce(
          callbackfn: (
            previousValue: string,
            currentValue: string,
            currentIndex: number,
            array: string[],
          ) => string,
          initialValue: string,
        ): string;
        reduce<U>(
          callbackfn: (
            previousValue: U,
            currentValue: string,
            currentIndex: number,
            array: string[],
          ) => U,
          initialValue: U,
        ): U;
        reduceRight(
          callbackfn: (
            previousValue: string,
            currentValue: string,
            currentIndex: number,
            array: string[],
          ) => string,
        ): string;
        reduceRight(
          callbackfn: (
            previousValue: string,
            currentValue: string,
            currentIndex: number,
            array: string[],
          ) => string,
          initialValue: string,
        ): string;
        reduceRight<U>(
          callbackfn: (
            previousValue: U,
            currentValue: string,
            currentIndex: number,
            array: string[],
          ) => U,
          initialValue: U,
        ): U;
        find<S extends string>(
          predicate: (
            value: string,
            index: number,
            obj: string[],
          ) => value is S,
          thisArg?: any,
        ): S | undefined;
        find(
          predicate: (value: string, index: number, obj: string[]) => unknown,
          thisArg?: any,
        ): string | undefined;
        findIndex(
          predicate: (value: string, index: number, obj: string[]) => unknown,
          thisArg?: any,
        ): number;
        fill(
          value: string,
          start?: number,
          end?: number,
        ): string[] & Record<"sm" | "md" | "lg" | "xl" | "2xl", string>;
        copyWithin(
          target: number,
          start: number,
          end?: number,
        ): string[] & Record<"sm" | "md" | "lg" | "xl" | "2xl", string>;
        entries(): IterableIterator<[number, string]>;
        keys(): IterableIterator<number>;
        values(): IterableIterator<string>;
        includes(searchElement: string, fromIndex?: number): boolean;
        flatMap<U, This = undefined>(
          callback: (
            this: This,
            value: string,
            index: number,
            array: string[],
          ) => U | readonly U[],
          thisArg?: This | undefined,
        ): U[];
        flat<A, D extends number = 1>(
          this: A,
          depth?: D | undefined,
        ): FlatArray<A, D>[];
        at(index: number): string | undefined;
        findLast<S extends string>(
          predicate: (
            value: string,
            index: number,
            array: string[],
          ) => value is S,
          thisArg?: any,
        ): S | undefined;
        findLast(
          predicate: (value: string, index: number, array: string[]) => unknown,
          thisArg?: any,
        ): string | undefined;
        findLastIndex(
          predicate: (value: string, index: number, array: string[]) => unknown,
          thisArg?: any,
        ): number;
        toReversed(): string[];
        toSorted(
          compareFn?: ((a: string, b: string) => number) | undefined,
        ): string[];
        toSpliced(
          start: number,
          deleteCount: number,
          ...items: string[]
        ): string[];
        toSpliced(start: number, deleteCount?: number): string[];
        with(index: number, value: string): string[];
        [Symbol.iterator](): IterableIterator<string>;
        [Symbol.unscopables]: {
          [x: number]: boolean | undefined;
          length?: boolean | undefined;
          toString?: boolean | undefined;
          toLocaleString?: boolean | undefined;
          pop?: boolean | undefined;
          push?: boolean | undefined;
          concat?: boolean | undefined;
          join?: boolean | undefined;
          reverse?: boolean | undefined;
          shift?: boolean | undefined;
          slice?: boolean | undefined;
          sort?: boolean | undefined;
          splice?: boolean | undefined;
          unshift?: boolean | undefined;
          indexOf?: boolean | undefined;
          lastIndexOf?: boolean | undefined;
          every?: boolean | undefined;
          some?: boolean | undefined;
          forEach?: boolean | undefined;
          map?: boolean | undefined;
          filter?: boolean | undefined;
          reduce?: boolean | undefined;
          reduceRight?: boolean | undefined;
          find?: boolean | undefined;
          findIndex?: boolean | undefined;
          fill?: boolean | undefined;
          copyWithin?: boolean | undefined;
          entries?: boolean | undefined;
          keys?: boolean | undefined;
          values?: boolean | undefined;
          includes?: boolean | undefined;
          flatMap?: boolean | undefined;
          flat?: boolean | undefined;
          at?: boolean | undefined;
          findLast?: boolean | undefined;
          findLastIndex?: boolean | undefined;
          toReversed?: boolean | undefined;
          toSorted?: boolean | undefined;
          toSpliced?: boolean | undefined;
          with?: boolean | undefined;
          [Symbol.iterator]?: boolean | undefined;
          readonly [Symbol.unscopables]?: boolean | undefined;
        };
        sm: string;
        md: string;
        lg: string;
        xl: string;
        "2xl": string;
      }
    | {
        [x: string]:
          | string
          | import("node_modules/tailwindcss/types/config").Screen
          | import("node_modules/tailwindcss/types/config").Screen[];
        sm: string;
        md: string;
        lg: string;
        xl: string;
        "2xl": string;
      }
    | {
        sm: string;
        md: string;
        lg: string;
        xl: string;
        "2xl": string;
      };
  namespace container {
    let center: boolean;
  }
  let aspectRatio:
    | {
        [x: string]: string;
        video: string;
        auto: string;
        square: string;
      }
    | {
        video: string;
        auto: string;
        square: string;
      };
  namespace fontFamily {
    let sans: string[];
    let serif: string[];
  }
  namespace extend {
    let screens_1: {
      xs: string;
      "8xl": string;
      "9xl": string;
      "10xl": string;
    };
    export { screens_1 as screens };
    export namespace colors {
      let scrapBlack: string;
      let scrapWhite: string;
      let scrapRed: string;
      let scrapYellow: string;
      let scrapOrange: string;
      let scrapGreen: string;
      let scrapBlue: string;
    }
    export namespace fontFamily_1 {
      let sans_1: string[];
      export { sans_1 as sans };
      let serif_1: string[];
      export { serif_1 as serif };
    }
    export { fontFamily_1 as fontFamily };
    export let maxWidth: {
      "8xl": string;
      "9xl": string;
      "10xl": string;
    };
    let aspectRatio_1: {
      "3/2": string;
      "4/3": string;
      "21/9": string;
      "16/9": string;
      "1/1": string;
    };
    export { aspectRatio_1 as aspectRatio };
    export let fontSize: {
      xs: (
        | string
        | {
            lineHeight: string;
          }
      )[];
      sm: (
        | string
        | {
            lineHeight: string;
          }
      )[];
      base: (
        | string
        | {
            lineHeight: string;
          }
      )[];
      lg: (
        | string
        | {
            lineHeight: string;
          }
      )[];
      xl: (
        | string
        | {
            lineHeight: string;
          }
      )[];
      "2xl": (
        | string
        | {
            lineHeight: string;
          }
      )[];
      "3xl": (
        | string
        | {
            lineHeight: string;
          }
      )[];
      "4xl": (
        | string
        | {
            lineHeight: string;
          }
      )[];
      "5xl": (
        | string
        | {
            lineHeight: string;
          }
      )[];
      "6xl": (
        | string
        | {
            lineHeight: string;
          }
      )[];
      "7xl": (
        | string
        | {
            lineHeight: string;
          }
      )[];
      "8xl": (
        | string
        | {
            lineHeight: string;
          }
      )[];
      "9xl": (
        | string
        | {
            lineHeight: string;
          }
      )[];
      "10xl": (
        | string
        | {
            lineHeight: string;
          }
      )[];
    };
  }
}
export let plugins: any[];
//# sourceMappingURL=tailwind.config.d.cts.map
