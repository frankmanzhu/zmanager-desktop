const TREE_DEPTH_CLASSES = [
  "!pl-[6px]",
  "!pl-[18px]",
  "!pl-[30px]",
  "!pl-[42px]",
  "!pl-[54px]",
  "!pl-[66px]",
  "!pl-[78px]",
  "!pl-[90px]",
  "!pl-[102px]",
  "!pl-[114px]",
  "!pl-[126px]",
  "!pl-[138px]",
  "!pl-[150px]",
  "!pl-[162px]",
  "!pl-[174px]",
  "!pl-[186px]",
] as const;

export function treeDepthClass(depth: number): string {
  const index = Math.max(
    0,
    Math.min(Math.trunc(depth), TREE_DEPTH_CLASSES.length - 1),
  );
  return TREE_DEPTH_CLASSES[index];
}
