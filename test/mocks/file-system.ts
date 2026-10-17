/** Jest stand-in for expo-file-system's File/Directory API. Nothing touches disk in unit tests. */
export class File {
  uri: string;
  exists = false;
  size: number | null = null;
  name = '';
  constructor(...parts: unknown[]) {
    this.uri = parts.map(String).join('/');
  }
  copy() {}
  move() {}
  delete() {}
  write() {}
  async bytes() {
    return new Uint8Array();
  }
  async text() {
    return '';
  }
  async base64() {
    return '';
  }
  get parentDirectory() {
    return new Directory(this.uri.replace(/\/[^/]*$/, ''));
  }
}
export class Directory {
  uri: string;
  exists = false;
  constructor(...parts: unknown[]) {
    this.uri = parts.map(String).join('/');
  }
  create() {}
  list(): (File | Directory)[] {
    return [];
  }
}
export const Paths = { document: 'file:///documents', cache: 'file:///cache' };
