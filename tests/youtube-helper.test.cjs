const assert = require('node:assert/strict');
const { after, test } = require('node:test');
const childProcess = require('node:child_process');

require('ts-node/register/transpile-only');

// Run the real Python argument parser, replacing only the network handlers.
// This keeps YouTube requests and audio downloads out of the regression test.
const parserProbe = `
import argparse
import ast
import json
import sys
from pathlib import Path

script_path = sys.argv.pop(1)
module = ast.parse(Path(script_path).read_text())
main = next(node for node in module.body
            if isinstance(node, ast.FunctionDef) and node.name == "main")

def handle_transcript(args):
    print(json.dumps({"ok": True, "data": {
        "text": f"Transcript for {args.video_id} ({args.language})"
    }}))

def handle_download_audio(args):
    assert args.output_template.endswith(".%(ext)s")
    print(json.dumps({"ok": True, "data": {
        "file_path": f"/audio/{args.video_id}.mp3"
    }}))

exec(compile(ast.Module(body=[main], type_ignores=[]), script_path, "exec"))
main()
`;

const originalSpawn = childProcess.spawn;
childProcess.spawn = (command, args, options) => {
  const helperIndex = args.findIndex((arg) =>
    arg.endsWith('youtube_helper.py')
  );
  if (helperIndex === -1) return originalSpawn(command, args, options);
  return originalSpawn(
    command,
    [
      ...args.slice(0, helperIndex),
      '-c',
      parserProbe,
      ...args.slice(helperIndex),
    ],
    options
  );
};
after(() => {
  childProcess.spawn = originalSpawn;
});

const { getVideoTranscript, downloadAudio } = require('../src/youtube.ts');

for (const videoId of ['9_P-Zf8mDsk', '-ciSTkEVy30', '-mWWsvv19jE']) {
  test(`fetches captions for video ID ${videoId}`, async () => {
    assert.equal(
      await getVideoTranscript(videoId),
      `Transcript for ${videoId} (en)`
    );
  });

  test(`downloads fallback audio for video ID ${videoId}`, async () => {
    assert.equal(await downloadAudio(videoId), `/audio/${videoId}.mp3`);
  });
}
