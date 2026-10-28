"""Smoke E2E against local Mattermost: seed roles, verify TA-01 API facts."""
import json, secrets, sys, urllib.request, urllib.error
from pathlib import Path
BASE = 'http://localhost:8065/api/v4'
creds_file = Path(sys.argv[1])
def call(method, path, body=None, token=None, raw=False):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header('Content-Type', 'application/json')
    if token: req.add_header('Authorization', 'Bearer ' + token)
    try:
        with urllib.request.urlopen(req) as r:
            data = r.read(); return (r.status, r.headers, json.loads(data) if data else None)
    except urllib.error.HTTPError as e:
        return (e.code, e.headers, json.loads(e.read() or b'null'))
creds = json.loads(creds_file.read_text()) if creds_file.exists() else {}
def user(name):
    if name not in creds:
        creds[name] = 'Pw-' + secrets.token_urlsafe(12) + '1!'
    st, _, u = call('POST', '/users', dict(email=f'{name}@example.test', username=name, password=creds[name]), token=tokens.get('sysadmin'))
    st, h, me = call('POST', '/users/login', dict(login_id=name, password=creds[name]))
    assert st == 200, (name, st, me)
    tokens[name] = h['Token']; return me
tokens = {}
sa = user('sysadmin')                       # primer usuario: System Admin
assert 'system_admin' in sa['roles'], sa['roles']
others = {n: user(n) for n in ('tadmin', 'member1', 'member2', 'otheradmin', 'sa_teamadmin')}
creds_file.write_text(json.dumps(creds, indent=2)); creds_file.chmod(0o600)
T = tokens['sysadmin']
def team(name):
    st, _, t = call('POST', '/teams', dict(name=name, display_name=name, type='O'), token=T)
    if st != 201: t = call('GET', f'/teams/name/{name}', token=T)[2]
    return t
t1, t2 = team('pswe07-equipo'), team('pswe07-otro')
for n in ('tadmin', 'member1', 'member2', 'otheradmin', 'sa_teamadmin'):
    call('POST', f'/teams/{t1["id"]}/members', dict(team_id=t1['id'], user_id=others[n]['id']), token=T)
call('POST', f'/teams/{t2["id"]}/members', dict(team_id=t2['id'], user_id=others['otheradmin']['id']), token=T)
call('PUT', f'/users/{others["sa_teamadmin"]["id"]}/roles', dict(roles='system_user system_admin'), token=T)
for team_id, n in ((t1['id'], 'tadmin'), (t1['id'], 'sa_teamadmin'), (t2['id'], 'otheradmin')):
    st, _, _ = call('PUT', f'/teams/{team_id}/members/{others[n]["id"]}/schemeRoles', dict(scheme_admin=True, scheme_user=True), token=T)
    assert st == 200, st
ids = {v['id']: k for k, v in {**others, 'sysadmin': sa}.items()}
M = tokens['member1']
results = []
def check(name, ok, detail):
    results.append((name, ok, detail)); print(('PASS' if ok else 'FAIL'), name, '|', detail)
st, _, members = call('GET', f'/teams/{t1["id"]}/members?per_page=200', token=M)
seen = {ids.get(m['user_id'], m['user_id']): m['scheme_admin'] for m in members}
check('S1 miembro: /teams/{id}/members oculta scheme_admin de otros', st == 200 and seen.get('tadmin') is False, f'tadmin.scheme_admin={seen.get("tadmin")}')
st, _, members = call('GET', f'/teams/{t1["id"]}/members?per_page=200', token=T)
seen = {ids.get(m['user_id'], m['user_id']): m['scheme_admin'] for m in members}
check('S2 admin: /teams/{id}/members muestra scheme_admin', seen.get('tadmin') is True, f'tadmin.scheme_admin={seen.get("tadmin")}')
st, _, us = call('GET', f'/users?in_team={t1["id"]}&team_roles=team_admin&per_page=200', token=M)
names = sorted(ids.get(u['id'], u['id']) for u in us) if st == 200 else us
check('S3 miembro: team_roles=team_admin devuelve Team Admins del equipo, sin System Admin ni admin de otro equipo', names == ['tadmin'], f'status={st} -> {names}')
st, _, us = call('GET', f'/users?in_team={t1["id"]}&team_roles=team_admin&roles=system_admin&per_page=200', token=M)
names = sorted(ids.get(u['id'], u['id']) for u in us) if st == 200 else us
check('S4 miembro: team_roles=team_admin&roles=system_admin une Team Admins y System Admins miembros del equipo (sysadmin es miembro por crear el equipo)', st == 200 and set(names) == {'tadmin', 'sa_teamadmin', 'sysadmin'} and 'otheradmin' not in names, f'status={st} -> {names}')
st, _, us = call('GET', f'/users?in_team={t1["id"]}&team_roles=team_admin&per_page=1&page=0', token=M)
check('S5 paginación con filtro (per_page=1)', st == 200 and len(us) == 1, f'status={st} n={len(us) if st==200 else us}')
st, _, us = call('POST', '/users/search', dict(term='member', team_id=t1['id'], team_roles=['team_admin']), token=M)
check('S6 búsqueda + filtro sin coincidencias devuelve lista vacía', st == 200 and us == [], f'status={st} -> {us if st!=200 else [u["username"] for u in us]}')
st, _, us = call('GET', f'/users?in_team={t1["id"]}&per_page=200', token=M)
roles = {u['username']: u.get('roles') for u in us} if st == 200 else {}
check('S7 miembro ve user.roles de otros (para etiqueta System Admin)', 'system_admin' in (roles.get('sa_teamadmin') or ''), f'sa_teamadmin.roles={roles.get("sa_teamadmin")!r}')
st, _, stats = call('GET', f'/users/stats/filtered?in_team={t1["id"]}&team_roles=team_admin', token=M)
check('S8 miembro: /users/stats/filtered exige sysconsole_read_user_management_users (no usable para el conteo)', st == 403, f'status={st} -> {stats}')
st, _, _ = call('GET', f'/users?in_team={t2["id"]}&team_roles=team_admin', token=M)
check('S9 no miembro de otro equipo: rechazado', st == 403, f'status={st}')
print(f'\n{sum(r[1] for r in results)}/{len(results)} comprobaciones OK')
