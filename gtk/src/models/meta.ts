import { Clock, SystemClock } from "./clock.js";
import { Timestamp } from "./timestamp.js";

export interface MetaFile {
  filename: string;
  filenameWithNanos: string;
  contents: string;
}

export class Meta {
  angaFilename = "";
  note = "";
  clock: Clock = new SystemClock();

  constructor(angaFilename: string, note: string, clock: Clock) {
    this.angaFilename = angaFilename;
    this.note = note;
    this.clock = clock;
  }

  toMetaFile(): MetaFile {
    const timestamp = new Timestamp(this.clock.now());
    // Replace triple single quotes with triple double quotes to prevent TOML parsing issues
    const sanitizedNote = this.note.replace(/'''/g, '"""');
    const tomlContent = `[anga]
filename = "${this.angaFilename}"

[meta]
note = '''${sanitizedNote}'''
`;
    return {
      filename: `${timestamp.plain}-note.toml`,
      filenameWithNanos: `${timestamp.withNanos}-note.toml`,
      contents: tomlContent,
    };
  }
}
