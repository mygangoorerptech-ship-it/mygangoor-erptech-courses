// mygf/src/components/join/utils.ts
export function classNames(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}
