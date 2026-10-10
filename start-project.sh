#!/bin/bash
# StudyPilot 本机启动；stop-project.sh 使用同一份进程管理逻辑。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PYTHON="$ROOT/ai-service/.venv/bin/python"
if [[ ! -x "$PYTHON" ]]; then
  echo "缺少 AI Python 虚拟环境：$PYTHON；请先按 ai-service/README.md 安装依赖。" >&2
  exit 1
fi
exec "$PYTHON" - "$ROOT" "${1:-start}" <<'PY'
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request

root = Path(sys.argv[1]).resolve()
mode = sys.argv[2]
backend_root = root.parent / 'project-minimax-task-33' / 'backend'
ai_root = root.parent / 'project-zcode-task-33' / 'ai-service'
web_root = root.parent / 'project-zcode-task-33' / 'web'
component_roots = (root, backend_root, ai_root, web_root)

runtime = root / '.studypilot-runtime'
runtime.mkdir(mode=0o700, exist_ok=True)
os.chmod(runtime, 0o700)
state_file = runtime / 'processes.json'
lock = (runtime / 'manager.lock').open('a')
try:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    sys.exit('另一个启动/关闭操作正在进行，请稍后再试。')


def save(state):
    temporary = state_file.with_suffix('.tmp')
    temporary.write_text(json.dumps(state, indent=2))
    os.chmod(temporary, 0o600)
    temporary.replace(state_file)


def processes():
    output = subprocess.check_output(
        ['ps', '-axo', 'pid=,pgid=,stat=,lstart='], text=True)
    result = {}
    for line in output.splitlines():
        parts = line.split()
        if len(parts) >= 8 and not parts[2].startswith('Z'):
            result[int(parts[0])] = (int(parts[1]), ' '.join(parts[3:]))
    return result


def members(record):
    return [pid for pid, info in processes().items() if info[0] == record['pgid']]


def owned(record):
    table = processes()
    leader = table.get(record['pid'])
    if leader:
        return leader == (record['pgid'], record['started'])
    # A crashed leader can leave children in the original session. Only stop
    # them when every remaining member still has its cwd in this project.
    remaining = [pid for pid, info in table.items() if info[0] == record['pgid']]
    for pid in remaining:
        result = subprocess.run(['lsof', '-a', '-p', str(pid), '-d', 'cwd', '-Fn'],
                                capture_output=True, text=True)
        paths = [line[1:] for line in result.stdout.splitlines() if line.startswith('n')]
        if not paths or not all(any(Path(p).resolve().is_relative_to(base) for base in component_roots) for p in paths):
            return False
    return True


def terminate(name, record):
    if not members(record):
        return
    if not owned(record):
        raise RuntimeError(f'{name} 的进程身份发生变化，拒绝关闭可能属于其他项目的进程。')
    os.killpg(record['pgid'], signal.SIGTERM)
    deadline = time.monotonic() + 20
    while members(record) and time.monotonic() < deadline:
        time.sleep(0.25)
    if members(record):
        if not owned(record):
            raise RuntimeError(f'{name} 的进程身份发生变化，停止强制关闭。')
        os.killpg(record['pgid'], signal.SIGKILL)
        deadline = time.monotonic() + 5
        while members(record) and time.monotonic() < deadline:
            time.sleep(0.1)
    if members(record):
        raise RuntimeError(f'{name} 仍有进程存活，请查看 {runtime}。')
    print(f'{name} 已关闭（含子进程）。', flush=True)


def port_busy(port):
    with socket.socket() as probe:
        probe.settimeout(0.5)
        return probe.connect_ex(('127.0.0.1', port)) == 0


def clear_port(port):
    # Only target listeners and their descendants, never their process group:
    # an IDE-launched Java service can share its IDE's process group.
    parents = {}
    for line in subprocess.check_output(['ps', '-axo', 'pid=,ppid='], text=True).splitlines():
        pid, parent = map(int, line.split())
        parents[pid] = parent
    protected = {os.getpid()}
    ancestor = os.getpid()
    while parents.get(ancestor, 0):
        ancestor = parents[ancestor]
        protected.add(ancestor)
    for attempt in range(3):
        parents = {}
        for line in subprocess.check_output(['ps', '-axo', 'pid=,ppid='], text=True).splitlines():
            pid, parent = map(int, line.split())
            parents[pid] = parent
        result = subprocess.run(['lsof', '-nP', f'-iTCP:{port}', '-sTCP:LISTEN', '-t'],
                                capture_output=True, text=True)
        if result.returncode not in (0, 1):
            raise RuntimeError(f'无法查询端口 {port} 的占用进程。')
        listeners = {int(line) for line in result.stdout.splitlines() if line.isdigit()}
        if not listeners:
            if port_busy(port):
                raise RuntimeError(f'端口 {port} 仍占用，但无法定位监听进程。')
            return
        if listeners & protected or 1 in listeners:
            raise RuntimeError(f'端口 {port} 由启动脚本的父进程或系统初始化进程占用，无法自动关闭。')
        tree = set(listeners)
        while True:
            children = {pid for pid, parent in parents.items() if parent in tree}
            if children <= tree:
                break
            tree.update(children)
        identities = {pid: info for pid, info in processes().items() if pid in tree}
        print(f'端口 {port} 被占用，自动关闭监听进程 {sorted(listeners)} 及其子进程…', flush=True)
        def still_same():
            current = processes()
            return [pid for pid, identity in identities.items() if current.get(pid) == identity]
        for pid in still_same():
            try:
                os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        deadline = time.monotonic() + 10
        while still_same() and time.monotonic() < deadline:
            time.sleep(0.25)
        for pid in still_same():
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        deadline = time.monotonic() + 5
        while still_same() and time.monotonic() < deadline:
            time.sleep(0.1)
        if still_same():
            raise RuntimeError(f'端口 {port} 的占用进程未能退出。')
        check = subprocess.run(['lsof', '-nP', f'-iTCP:{port}', '-sTCP:LISTEN', '-t'],
                               capture_output=True, text=True)
        if check.returncode == 1 and not port_busy(port):
            return
    raise RuntimeError(f'端口 {port} 的程序持续自动重启，请先关闭其自动重启服务。')


def healthy(url, expected=None):
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            if response.status != 200:
                return False
            if expected:
                return json.load(response).get('status') == expected
            return True
    except Exception:
        return False


state = json.loads(state_file.read_text()) if state_file.exists() else {}
if mode == '--stop':
    errors = []
    for name in ('前端', 'AI 服务', '后端'):
        record = state.get(name)
        if not record:
            continue
        try:
            terminate(name, record)
            if port_busy(record['port']):
                raise RuntimeError(f"{name} 管理的进程已退出，但端口 {record['port']} 仍被占用。")
            del state[name]
            save(state)
        except Exception as error:
            errors.append(str(error))
    if errors:
        sys.exit('\n'.join(errors))
    print('StudyPilot 三个受管理服务均已停止；重复关闭不会影响其他项目。')
    sys.exit(0)
if mode != 'start':
    sys.exit('用法：./start-project.sh 或 ./stop-project.sh')

new_services = []
try:
    from dotenv import dotenv_values
    env = dict(os.environ)
    # Existing stable keys stay in the ignored local .env; never print them.
    for key, value in dotenv_values(root / 'ai-service' / '.env').items():
        if value is not None:
            env.setdefault(key, value)
    for component in (backend_root, ai_root, web_root):
        if not component.is_dir():
            raise RuntimeError(f'缺少已验收组件目录：{component}')
    identities = {}
    for name, component in (('后端', backend_root), ('AI 服务', ai_root), ('前端', web_root)):
        revision = subprocess.check_output(['git', '-C', str(component), 'rev-parse', 'HEAD'], text=True).strip()
        source_hash = hashlib.sha256()
        paths = subprocess.check_output(
            ['git', '-C', str(component), 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '.'])
        for relative in sorted(set(paths.decode().split('\0')) - {''}):
            file = component / relative
            source_hash.update(relative.encode())
            source_hash.update(file.read_bytes() if file.is_file() else b'<missing>')
        identities[name] = {'cwd': str(component), 'revision': revision,
                            'sourceHash': source_hash.hexdigest()}
        print(f'{name}源码：{component} @ {revision[:12]}', flush=True)
    # Keep the existing encrypted conversation state and stable credentials.
    env.setdefault('AGENT_STATE_DB_PATH', str(root / 'ai-service/data/agent-state.sqlite3'))
    env.setdefault('QDRANT_PATH', str(root / 'ai-service/data/qdrant'))
    env.setdefault('FASTEMBED_CACHE_PATH', str(root / 'ai-service/data/fastembed'))
    ports = {name: int(os.environ.get(key, default)) for name, key, default in (
        ('后端', 'STUDYPILOT_BACKEND_PORT', '8080'),
        ('AI 服务', 'STUDYPILOT_AI_PORT', '8000'),
        ('前端', 'STUDYPILOT_WEB_PORT', '5173'))}
    if len(set(ports.values())) != 3 or any(not 1 <= p <= 65535 for p in ports.values()):
        raise RuntimeError('三个服务端口必须不同，且在 1–65535 内。')
    for name, port in ports.items():
        record = state.get(name)
        if record and members(record):
            if not owned(record) or record['port'] != port or record.get('component') != identities[name]:
                raise RuntimeError(f'{name} 已有不同配置的实例，请先运行关闭脚本。')
    if not (root / 'ai-service' / '.env').exists():
        raise RuntimeError('缺少 ai-service/.env，请按部署指南配置稳定密钥。')
    for key in ('INTERNAL_SERVICE_TOKEN', 'AI_CREDENTIAL_MASTER_KEY', 'LANGGRAPH_AES_KEY'):
        if not env.get(key):
            raise RuntimeError(f'未配置 {key}，请在 ai-service/.env 中填写已有稳定密钥。')
    node = shutil.which('node')
    if not node or not (web_root / 'node_modules/vite/bin/vite.js').exists():
        raise RuntimeError('缺少 Node.js 或前端依赖，请在 web 目录运行 npm ci。')
    if not env.get('JAVA_HOME') and sys.platform == 'darwin':
        java_home = subprocess.run(['/usr/libexec/java_home', '-v', '17'],
                                   capture_output=True, text=True)
        if java_home.returncode == 0:
            env['JAVA_HOME'] = java_home.stdout.strip()
    java = str(Path(env['JAVA_HOME']) / 'bin/java') if env.get('JAVA_HOME') else shutil.which('java')
    if not java:
        raise RuntimeError('未找到 Java，请安装 JDK 17。')
    env['JAVA_BACKEND_BASE_URL'] = f"http://127.0.0.1:{ports['后端']}"
    env['STUDYPILOT_AI_SERVICE_BASE_URL'] = f"http://127.0.0.1:{ports['AI 服务']}"
    env['VITE_API_BASE_URL'] = f"http://localhost:{ports['后端']}"
    env['CORS_ALLOWED_ORIGINS'] = f"http://localhost:{ports['前端']},http://127.0.0.1:{ports['前端']}"
    jar = backend_root / 'target/studypilot-backend-0.0.1-SNAPSHOT.jar'
    sources = [backend_root / 'pom.xml', *[p for p in (backend_root / 'src').rglob('*') if p.is_file()]]
    if not jar.exists() or any(p.stat().st_mtime > jar.stat().st_mtime for p in sources):
        print('准备后端运行包（首次或源码更新后构建）…', flush=True)
        with (runtime / 'build.log').open('w') as log:
            result = subprocess.run(['./mvnw', '-q', '-DskipTests', 'package'],
                                    cwd=backend_root, env=env, stdout=log, stderr=subprocess.STDOUT)
        if result.returncode:
            raise RuntimeError(f'后端构建失败，请查看 {runtime / "build.log"}。')
    specs = (
        ('后端', [java, '-jar', str(jar), '--spring.profiles.active=local',
                  f"--server.port={ports['后端']}",
                  f"--studypilot.ai-service-base-url=http://127.0.0.1:{ports['AI 服务']}"],
         backend_root, '/actuator/health', 'UP', 120),
        ('AI 服务', [sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1',
                     '--port', str(ports['AI 服务']), '--timeout-graceful-shutdown', '15'],
         ai_root, '/health', 'UP', 90),
        ('前端', [node, str(web_root / 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1',
                  '--port', str(ports['前端']), '--strictPort'], web_root, '/', None, 30))
    for name, command, cwd, health_path, expected, timeout in specs:
        port = ports[name]
        record = state.get(name)
        url = f'http://127.0.0.1:{port}{health_path}'
        if record and members(record):
            if not healthy(url, expected):
                raise RuntimeError(f'{name} 进程存在但健康检查失败，请先关闭后重新启动。')
            print(f'{name} 已在运行，复用现有进程。', flush=True)
            continue
        clear_port(port)
        print(f'启动{name}（端口 {port}）…', flush=True)
        log_path = runtime / {'后端': 'backend.log', 'AI 服务': 'ai.log', '前端': 'web.log'}[name]
        with log_path.open('w') as log:
            child = subprocess.Popen(command, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                     stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        time.sleep(0.1)
        info = processes().get(child.pid)
        if not info:
            raise RuntimeError(f'{name} 启动后立即退出，请查看 {log_path}。')
        record = {'pid': child.pid, 'pgid': info[0], 'started': info[1], 'port': port, 'component': identities[name]}
        state[name] = record
        new_services.append(name)
        save(state)
        deadline = time.monotonic() + timeout
        while not healthy(url, expected):
            if child.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError(f'{name} 未通过健康检查，请查看 {log_path}。')
            time.sleep(1)
        print(f'{name} 健康检查通过。', flush=True)
    print(f"StudyPilot 已就绪：http://localhost:{ports['前端']}\n日志：{runtime}\n关闭：{root / 'stop-project.sh'}")
except (Exception, KeyboardInterrupt) as error:
    print(f'启动失败：{error}', file=sys.stderr, flush=True)
    for name in reversed(new_services):
        try:
            terminate(name, state[name])
            del state[name]
            save(state)
        except Exception as cleanup_error:
            print(f'回滚失败：{cleanup_error}', file=sys.stderr)
    sys.exit(1)
PY
