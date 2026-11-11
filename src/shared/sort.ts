const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function naturalCompare(a: string, b: string): number {
  return collator.compare(a, b);
}

export function sortByFilename<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => naturalCompare(a.name, b.name));
}

export function responseLabel(index: number): string {
  return String.fromCharCode(65 + index);
}
