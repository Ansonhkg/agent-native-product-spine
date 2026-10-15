#!/usr/bin/env python3
"""Portable conformance reporter. Python standard library only; no test execution."""
import argparse
import hashlib
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

STATUSES = {'passed', 'failed', 'blocked', 'unrun'}


def required_text(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'{label} must be nonempty text')
    return value


def triple(row):
    return tuple(required_text(row.get(k), k) for k in ('action', 'surface', 'check'))


def prepare(data, source):
    run = data['run']
    for field in ('id', 'at', 'revision', 'environment', 'profile'):
        required_text(run.get(field), 'run.' + field)
    if not re.fullmatch(r'[A-Za-z0-9_-]+', run['id']):
        raise ValueError('run.id must contain letters, digits, underscores, or hyphens')
    parsed = datetime.fromisoformat(run['at'].replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('run.at must include a timezone')
    if run.get('mode') not in ('new', 'existing'):
        raise ValueError('run.mode must be new or existing')
    if 'illustrative' in run and not isinstance(run['illustrative'], bool):
        raise ValueError('run.illustrative must be a boolean')
    actions = data['actions']
    if not actions:
        raise ValueError('inventory must contain at least one action')
    ids, obligations = set(), {}
    for action in actions:
        for field in ('id', 'domain', 'label', 'kind'):
            required_text(action.get(field), 'action.' + field)
        if action['id'] in ids:
            raise ValueError('duplicate action: ' + action['id'])
        ids.add(action['id'])
        if action['kind'] not in ('product', 'local', 'host', 'external'):
            raise ValueError('unknown action classification')
        if action['kind'] == 'product':
            required_text(action.get('operation'), 'product.operation')
            required_text(action.get('scope'), 'product.scope')
        if not action.get('expectations'):
            raise ValueError('action needs required expectations: ' + action['id'])
        for expectation in action['expectations']:
            key = triple({'action': action['id'], **expectation})
            if key[0] != action['id'] or key in obligations:
                raise ValueError('duplicate or invalid expectation')
            obligations[key] = None
    results = {}
    files = {}
    for result in data.get('results', []):
        key = triple(result)
        if key not in obligations or key in results:
            raise ValueError('unknown or duplicate result: ' + str(key))
        if result.get('status') not in STATUSES:
            raise ValueError('invalid result status')
        if result['status'] == 'passed':
            required_text(result.get('testId'), 'passed.testId')
            required_text(result.get('evidence'), 'passed.evidence')
        if result.get('evidence'):
            rel = Path(result['evidence'])
            if rel.is_absolute() or '..' in rel.parts or not rel.parts or rel.parts[0] not in ('logs', 'evidence'):
                raise ValueError('evidence must be a relative logs/ or evidence/ file')
            resolved = (source / rel).resolve()
            if not resolved.is_relative_to(source.resolve()) or not resolved.is_file():
                raise ValueError('missing or escaping evidence: ' + str(rel))
            files[str(rel)] = resolved
        results[key] = {**result}
    normalized = []
    for key in obligations:
        normalized.append(results.get(key, dict(zip(('action', 'surface', 'check'), key), status='unrun', message='No executable result recorded.')))
    baseline = {}
    for debt in data.get('baseline', []):
        key = triple(debt)
        for field in ('reason', 'owner'):
            required_text(debt.get(field), 'baseline.' + field)
        if key in baseline:
            raise ValueError('duplicate baseline entry')
        baseline[key] = debt
    if run['mode'] == 'new' and baseline:
        raise ValueError('new apps cannot carry baseline debt')
    unresolved = {triple(row) for row in normalized if row['status'] != 'passed'}
    issues = ['Unresolved requirement: ' + ' / '.join(key) for key in sorted(unresolved - baseline.keys())]
    issues += ['Stale baseline entry: ' + ' / '.join(key) for key in sorted(baseline.keys() - unresolved)]
    if run.get('illustrative', False):
        issues.append('Illustrative data cannot pass a production gate.')
    digest = hashlib.sha256(json.dumps(sorted(obligations), separators=(',', ':')).encode()).hexdigest()
    signature = hashlib.sha256(json.dumps(actions, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    return {**data, 'results': normalized, 'obligationsDigest': digest, 'inventoryDigest': signature,
            'gatePassed': not issues, 'releaseConformant': not unresolved and not run.get('illustrative', False),
            'gateIssues': issues}, files


def save_report(data, source, output):
    prepared, files = prepare(data, source)
    run = prepared['run']
    stamp = datetime.fromisoformat(run['at'].replace('Z', '+00:00')).astimezone(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    directory = output / 'runs' / (stamp + '-' + run['id'])
    previous = None
    history = []
    if (output / 'runs').exists():
        candidates = []
        for p in (output / 'runs').glob('*/run.json'):
            meta = json.loads(p.read_text())
            candidates.append((meta['run']['at'], p.parent))
            history.append({'id': meta['run']['id'], 'at': meta['run']['at'], 'directory': p.parent.name})
        if candidates:
            prior = max(candidates)[1]
            previous = json.loads((prior / 'input.json').read_text())
            previous['results'] = json.loads((prior / 'results.json').read_text())
    prepared['history'] = sorted(history, key=lambda r: r['at'], reverse=True)
    prepared['comparison'] = {'comparable': False, 'changes': [], 'message': 'No previous run.'}
    if previous:
        same = all(previous.get(k) == prepared.get(k) for k in ('obligationsDigest', 'inventoryDigest'))
        same = same and all(previous['run'].get(k) == run.get(k) for k in ('profile', 'environment', 'illustrative'))
        if same:
            prior_results = {triple(r): r['status'] for r in previous['results']}
            changes = [{'action': r['action'], 'surface': r['surface'], 'check': r['check'], 'before': prior_results.get(triple(r), 'unrun'), 'after': r['status']} for r in prepared['results'] if prior_results.get(triple(r)) != r['status']]
            prepared['comparison'] = {'comparable': True, 'changes': changes, 'message': 'Compared with ' + previous['run']['id']}
        else:
            prepared['comparison']['message'] = 'Previous run is not comparable: inventory, obligations, environment, or profile changed.'
    directory.mkdir(parents=True, exist_ok=False)
    try:
        for rel, path in files.items():
            dest = directory / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, dest)
        json_write(directory / 'run.json', {k: prepared[k] for k in ('run', 'obligationsDigest', 'inventoryDigest', 'gatePassed', 'releaseConformant', 'gateIssues')})
        json_write(directory / 'input.json', {k: v for k, v in prepared.items() if k != 'results'})
        json_write(directory / 'results.json', prepared['results'])
        template = (Path(__file__).resolve().parent.parent / 'assets' / 'report.html').read_text()
        payload = json.dumps(prepared).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
        (directory / 'report.html').write_text(template.replace('__DATA__', payload).replace('__EVIDENCE_BASE__', './'))
        output.mkdir(parents=True, exist_ok=True)
        latest = template.replace('__DATA__', payload).replace('__EVIDENCE_BASE__', './runs/' + directory.name + '/')
        temporary = output / '.index.html.tmp'
        temporary.write_text(latest)
        temporary.replace(output / 'index.html')
    except Exception:
        shutil.rmtree(directory)
        raise
    print(f"Report: {directory / 'report.html'}")
    print(f"Migration gate: {'passed' if prepared['gatePassed'] else 'failed'}; release conformance: {'passed' if prepared['releaseConformant'] else 'incomplete'}")
    return prepared


def json_write(path, data):
    path.write_text(json.dumps(data, indent=2) + '\n')


def demo(output):
    import tempfile
    import uuid
    from datetime import timedelta
    demo_id = uuid.uuid4().hex[:8]
    started = datetime.now(timezone.utc)
    actions = []
    for id_, label, domain, kind, surfaces in [
        ('items.list', 'List items', 'Items', 'product', ['ui', 'http', 'cli', 'mcp']),
        ('items.create', 'Create item', 'Items', 'product', ['ui', 'http', 'cli', 'mcp']),
        ('items.delete', 'Delete item', 'Items', 'product', ['ui', 'http', 'cli', 'mcp']),
        ('exports.download', 'Download export', 'Exports', 'product', ['ui', 'http', 'cli']),
        ('appearance.theme', 'Change appearance', 'Preferences', 'local', ['ui'])]:
        checks = ['contract', 'wiring', 'execution']
        if kind == 'product':
            checks += ['scope-denial']
        if id_ in ('items.create', 'items.delete'):
            checks += ['atomic-commit', 'live-update']
        actions.append({'id': id_, 'label': label, 'domain': domain, 'kind': kind, 'operation': id_ if kind == 'product' else None, 'scope': 'workspace' if kind == 'product' else 'local', 'expectations': [{'surface': s, 'check': c} for s in surfaces for c in checks]})
    with tempfile.TemporaryDirectory() as temp:
        source = Path(temp)
        (source / 'logs').mkdir()
        (source / 'logs' / 'illustrative.txt').write_text('ILLUSTRATIVE DATA ONLY. No application tests were executed.\nThese records demonstrate conformance report presentation.\n')
        for number in (1, 2):
            results = []
            for a in actions:
                for e in a['expectations']:
                    status = 'passed'
                    if a['id'] == 'items.delete' and e['surface'] == 'mcp':
                        status = 'unrun'
                    if a['id'] == 'exports.download' and e['surface'] == 'cli':
                        status = 'blocked'
                    if a['id'] == 'items.create' and e['check'] == 'live-update' and e['surface'] == 'cli' and number == 1:
                        status = 'failed'
                    if a['id'] == 'items.delete' and e['check'] == 'scope-denial' and e['surface'] == 'http' and number == 2:
                        status = 'failed'
                    results.append({'action': a['id'], **e, 'status': status, 'testId': 'illustrative.' + a['id'] + '.' + e['surface'] + '.' + e['check'], 'evidence': 'logs/illustrative.txt', 'message': {'passed': 'Illustrative successful assertion.', 'failed': 'Illustrative assertion failure.', 'blocked': 'Illustrative unavailable runtime.', 'unrun': 'Illustrative missing executable proof.'}[status]})
            save_report({'run': {'id': 'demo-' + demo_id + '-' + str(number), 'at': (started + timedelta(seconds=number)).isoformat(), 'revision': 'illustrative-revision-' + str(number), 'environment': 'illustrative-example', 'profile': 'core-product', 'mode': 'new', 'illustrative': True}, 'actions': actions, 'results': results, 'baseline': []}, source, output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--input', type=Path)
    group.add_argument('--demo', action='store_true')
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--check', action='store_true', help='Exit 1 if the gate fails, after saving the report')
    args = parser.parse_args()
    try:
        if args.demo:
            demo(args.output.resolve())
            return 1 if args.check else 0
        input_path = args.input.resolve()
        prepared = save_report(json.loads(input_path.read_text()), input_path.parent, args.output.resolve())
        return 1 if args.check and not prepared['gatePassed'] else 0
    except (ValueError, KeyError, TypeError, OSError) as error:
        print('Conformance report error: ' + str(error), file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
