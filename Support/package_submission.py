"""Package tracked application files and a freshly built website for submission.

Run npm run build --prefix frontend before running this script from any folder.
"""
from pathlib import Path
import hashlib
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
tracked = subprocess.check_output(
    ['git', 'ls-files', '-z', '--', 'frontend', 'backend'], cwd=ROOT
).decode().split('\0')
source_files = [name for name in tracked if name and (ROOT / name).is_file()]
if not (ROOT / 'frontend/dist/index.html').is_file():
    raise SystemExit('Build the frontend first with npm run build --prefix frontend.')

def write_archive(relative_path, files):
    """Store only explicit application files, excluding local credentials and data."""
    destination = ROOT / relative_path
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in sorted(set(files)):
            parts = Path(name).parts
            if any(part in {'.venv', 'node_modules', 'uploads', '__pycache__'} for part in parts):
                raise ValueError('Private or generated directory in archive input: ' + name)
            if any(part.startswith('.env') and part != '.env.example' for part in parts):
                raise ValueError('Private environment file in archive input: ' + name)
            archive.write(ROOT / name, name)
    return destination

guides = ['README.md', 'Help/USER_MANUAL.md', 'Help/README.md', 'Support/README.md',
          'Program/README.md', 'Presentation/README.md', 'Documentation/README.md',
          'Documentation/SUBMISSION_CHECKLIST.md', 'Source Code/README.md']
source = write_archive('Source Code/CareerPilot_AI_Source.zip', source_files + guides)
program_files = [name for name in source_files if name.startswith('backend/')]
program_files += ['frontend/package.json', 'frontend/package-lock.json', 'frontend/vite.config.js', 'frontend/README.md']
program_files += [p.relative_to(ROOT).as_posix() for p in (ROOT / 'frontend/dist').rglob('*') if p.is_file()]
program = write_archive('Program/CareerPilot_AI_Local_Application.zip', program_files + guides)
with (ROOT / 'Support/SHA256SUMS.txt').open('w', encoding='utf-8') as output:
    for path in [source, program]:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        output.write(f'{digest}  {path.relative_to(ROOT).as_posix()}\n')
        print(f'Packaged {path.relative_to(ROOT)} ({path.stat().st_size:,} bytes)')
