// Ship the app to the live server over SSH: `pnpm live` (build + upload + migrate), `pnpm live --dry` (build the archives, upload nothing),
// `pnpm live --no-build` (reuse the last build). Needs the OpenSSH client (ssh, scp) and tar, which Windows 10/11 and Git Bash both have.
//
// What goes up: the Laravel app (every file git knows or would add, so no .env, vendor/, node_modules or storage data) into <appDir>, and the built
// frontend plus the other files in backend/public into <webDir>. The server keeps its own .env, its own web/index.php (its paths differ) and everything
// under storage/ (uploaded music, logs). Files deleted locally are not deleted on the server (shortcut: remove them by hand, or add a cleanup list).
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = new Set(process.argv.slice(2))
const dry = args.has('--dry')
const root = fileURLToPath(new URL('..', import.meta.url))

const configPath = join(root, 'deploy.config.json')
if (!existsSync(configPath)) {
  console.error('No deploy.config.json yet: copy deploy.config.example.json to deploy.config.json and fill it in.')
  process.exit(1)
}
const config = { port: 22, appDir: 'dnd-companion', webDir: 'web', php: 'php', composer: 'composer', ...JSON.parse(readFileSync(configPath, 'utf8')) }
// these end up in a remote shell command: only plain words, so a typo cannot turn into a different command
const plain = /^[\w./~ -]+$/
for (const key of ['appDir', 'webDir', 'php', 'composer']) {
  if (!plain.test(String(config[key]))) fail(`deploy.config.json: "${key}" may only hold letters, digits and . / ~ _ - (and spaces)`)
}
if (!/^[\w.-]+@[\w.-]+$|^[\w.-]+$/.test(String(config.host ?? ''))) fail('deploy.config.json: "host" must look like user@server (or the name of a Host in ~/.ssh/config)')
if (!Number.isInteger(config.port)) fail('deploy.config.json: "port" must be a number')

function fail(message) {
  console.error(message)
  process.exit(1)
}
function run(cmd, cmdArgs, options = {}) {
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: process.platform === 'win32' && cmd === 'pnpm', ...options })
  if (r.status !== 0) fail(`${cmd} ${cmdArgs.slice(0, 2).join(' ')} failed (${r.status ?? r.error?.message})`)
}

if (!args.has('--no-build')) run('pnpm', ['build'], { cwd: root })
if (!existsSync(join(root, 'backend/public/index.html'))) fail('backend/public/index.html is missing: run without --no-build first.')

// --- the app: tracked and not-yet-tracked files under backend/, minus the public folder (it goes to the web folder) and things the server does not need
const gitList = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z', 'backend'], { cwd: root, encoding: 'utf8' })
if (gitList.status !== 0) fail('git ls-files failed')
const skip = [/^backend\/public\//, /^backend\/tests\//, /^backend\/(CLAUDE|AGENTS)\.md$/, /^backend\/phpunit\.xml$/]
const appFiles = gitList.stdout
  .split('\0')
  .filter((f) => f && !skip.some((re) => re.test(f)) && existsSync(join(root, f)))
  .map((f) => f.replace(/^backend\//, ''))

// --- the web folder: the built app and the rest of backend/public. index.php stays as the server has it.
const publicDir = join(root, 'backend/public')
const webFiles = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full)
    else webFiles.push(relative(publicDir, full).replaceAll('\\', '/'))
  }
}
walk(publicDir)
const webUpload = webFiles.filter((f) => !/^(index\.php|hot)$|^(build|storage)\//.test(f))

console.log(`app: ${appFiles.length} files -> ~/${config.appDir}`)
console.log(`web: ${webUpload.length} files -> ~/${config.webDir} (index.php is left alone)`)

const tmp = mkdtempSync(join(tmpdir(), 'dnd-deploy-'))
try {
  // relative archive names + cwd: GNU tar on Windows reads "C:\..." as a remote host
  const pack = (name, base, files) => {
    writeFileSync(join(tmp, `${name}.list`), files.join('\n') + '\n')
    run('tar', ['-czf', `${name}.tgz`, '-C', base.replaceAll('\\', '/'), '-T', `${name}.list`], { cwd: tmp })
    console.log(`${name}.tgz: ${(statSync(join(tmp, `${name}.tgz`)).size / 1048576).toFixed(1)} MB`)
  }
  pack('dnd-app', join(root, 'backend'), appFiles)
  pack('dnd-web', publicDir, webUpload)

  if (dry) {
    console.log('dry run: nothing was uploaded.')
  } else {
    const target = config.host
    run('scp', ['-P', String(config.port), 'dnd-app.tgz', 'dnd-web.tgz', `${target}:`], { cwd: tmp })
    // unpack (-m: the files get today's date, so PHP's opcache notices them), refresh the assets, then Composer, migrations and the config cache
    const remote = [
      'set -e',
      `cd ${config.appDir}`,
      'tar -xmzf ~/dnd-app.tgz',
      `rm -rf ~/${config.webDir}/assets`,
      `tar -xmzf ~/dnd-web.tgz -C ~/${config.webDir}`,
      'rm -f ~/dnd-app.tgz ~/dnd-web.tgz',
      // --no-scripts: Composer would start artisan as a subprocess, and shared hosts disable proc_open; run the one script that matters directly
      `${config.composer} install --no-dev --optimize-autoloader --no-interaction --no-scripts`,
      `${config.php} artisan package:discover --ansi`,
      `${config.php} artisan migrate --force`,
      `${config.php} artisan config:cache`,
      'echo deployed',
    ].join(' && ')
    run('ssh', ['-p', String(config.port), target, remote])
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
